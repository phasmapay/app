import { Buffer } from 'buffer';
import { PublicKey, Transaction } from '@solana/web3.js';
import { NativeModules } from 'react-native';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { SeedVault } from '@solana-mobile/seed-vault-lib';
import bs58 from 'bs58';
import { APP_IDENTITY } from '../utils/constants';
import { loadAuthToken, saveAuthToken } from './storage';

export type SignerType = 'seed-vault' | 'mwa';

type SignerState = {
  type: SignerType;
  publicKey: PublicKey;
  // Seed Vault fields
  svAuthToken?: number;
  svDerivationPath?: string;
  // MWA fields
  mwaAuthToken?: string;
};

let cachedSigner: SignerState | null = null;

// Check if Seed Vault is available (Seeker device or simulator)
export async function isSeedVaultAvailable(): Promise<boolean> {
  try {
    return await SeedVault.isSeedVaultAvailable(true); // true = allow simulated
  } catch {
    return false;
  }
}

// Connect via Seed Vault — authorize seed + get first account pubkey
async function connectSeedVault(): Promise<SignerState> {
  // Authorize a seed (shows biometric prompt)
  const { authToken } = await SeedVault.authorizeNewSeed();

  // Get accounts for this seed
  const accounts = await SeedVault.getAccounts(authToken, null, null);
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts found in Seed Vault');
  }

  const account = accounts[0];
  const pubkeyBytes = Buffer.from(account.publicKeyEncoded, 'base64');
  const publicKey = new PublicKey(pubkeyBytes);
  const derivationPath = account.derivationPath;

  return {
    type: 'seed-vault',
    publicKey,
    svAuthToken: authToken,
    svDerivationPath: derivationPath,
  };
}

// Connect via MWA (existing flow)
async function connectMwa(): Promise<SignerState> {
  // Try stored token first
  const stored = await loadAuthToken();

  return await transact(async (wallet) => {
    let auth;
    if (stored) {
      try {
        auth = await wallet.reauthorize({ auth_token: stored.token, identity: APP_IDENTITY });
      } catch {
        auth = await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
      }
    } else {
      auth = await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
    }

    const account = auth.accounts[0];
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(account.address);
    } catch {
      publicKey = new PublicKey(Buffer.from(account.address, 'base64'));
    }

    await saveAuthToken(auth.auth_token, publicKey.toBase58());

    return {
      type: 'mwa' as SignerType,
      publicKey,
      mwaAuthToken: auth.auth_token,
    };
  });
}

// Auto-connect: try Seed Vault first, fall back to MWA
export async function connect(): Promise<{ publicKey: PublicKey; type: SignerType }> {
  if (cachedSigner) {
    return { publicKey: cachedSigner.publicKey, type: cachedSigner.type };
  }

  const svAvailable = await isSeedVaultAvailable();
  if (svAvailable) {
    try {
      cachedSigner = await connectSeedVault();
      return { publicKey: cachedSigner.publicKey, type: cachedSigner.type };
    } catch (e) {
      console.warn('[Signer] Seed Vault connect failed, falling back to MWA:', e);
    }
  }

  cachedSigner = await connectMwa();
  return { publicKey: cachedSigner.publicKey, type: cachedSigner.type };
}

// Sign a transaction — Seed Vault signs in-process, MWA opens wallet app
export async function signTransaction(tx: Transaction): Promise<Transaction> {
  // Seed Vault path (Seeker) — in-process, no app switch needed
  if (cachedSigner?.type === 'seed-vault') {
    const serialized = tx.serializeMessage();
    const base64Tx = Buffer.from(serialized).toString('base64');
    const result = await SeedVault.signTransaction(
      cachedSigner.svAuthToken!,
      cachedSigner.svDerivationPath!,
      base64Tx
    );
    const sigBytes = Buffer.from(result.signatures[0], 'base64');
    tx.addSignature(cachedSigner.publicKey, sigBytes);
    return tx;
  }

  // MWA path — authorize + sign in ONE transact() session to avoid CLOSED error
  return await transact(async (wallet) => {
    let auth;
    const storedToken = cachedSigner?.mwaAuthToken;
    if (storedToken) {
      try {
        auth = await wallet.reauthorize({ auth_token: storedToken, identity: APP_IDENTITY });
      } catch {
        auth = await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
      }
    } else {
      auth = await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
    }

    const account = auth.accounts[0];
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(account.address);
    } catch {
      publicKey = new PublicKey(Buffer.from(account.address, 'base64'));
    }

    cachedSigner = { type: 'mwa', publicKey, mwaAuthToken: auth.auth_token };
    await saveAuthToken(auth.auth_token, publicKey.toBase58());

    const signed = await wallet.signTransactions({ transactions: [tx] });
    return signed[0];
  });
}

// Sign + send in one MWA session — reauthorize with stored token to skip account reconnect UI
export async function signAndSendMwa(tx: Transaction | string): Promise<string> {
  // MWA web3js wrapper expects Transaction objects, not raw buffers
  let txObj: Transaction;
  if (typeof tx === 'string') {
    txObj = Transaction.from(Buffer.from(tx, 'base64'));
  } else if (tx && typeof tx.serialize === 'function') {
    txObj = tx;
  } else {
    throw new Error(`signAndSendMwa: tx is invalid (${typeof tx})`);
  }

  const extractPubkey = (account: { address: string }): PublicKey => {
    try {
      return new PublicKey(account.address);
    } catch {
      return new PublicKey(Buffer.from(account.address, 'base64'));
    }
  };

  return await transact(async (wallet) => {
    const storedToken = cachedSigner?.mwaAuthToken;
    console.log('[MWA] signAndSend — storedToken:', storedToken ? 'yes' : 'no');

    let auth;
    if (storedToken) {
      try {
        auth = await wallet.reauthorize({ auth_token: storedToken, identity: APP_IDENTITY });
        console.log('[MWA] reauthorize OK');
      } catch (e) {
        console.warn('[MWA] reauthorize failed:', e);
        // Fall back to authorize — needed if token expired
        auth = await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
        console.log('[MWA] authorize fallback OK');
      }
    } else {
      console.log('[MWA] no stored token, full authorize');
      auth = await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
    }

    const publicKey = extractPubkey(auth.accounts[0]);
    cachedSigner = { type: 'mwa', publicKey, mwaAuthToken: auth.auth_token };
    await saveAuthToken(auth.auth_token, publicKey.toBase58());

    console.log('[MWA] sending tx for signing...');
    const results = await wallet.signAndSendTransactions({
      transactions: [txObj],
      minContextSlot: 0,
    });
    const sig = results[0];
    console.log('[MWA] tx signed, sig type:', typeof sig, sig);
    // MWA returns signature as Uint8Array or base64 string depending on version
    if (typeof sig === 'string') {
      // Already a base58 or base64 signature string
      return sig;
    }
    return bs58.encode(sig as Uint8Array);
  });
}

// Sign and send — build tx before, sign, then send ourselves
export async function signAndSendTransaction(
  tx: Transaction,
  sendRawTransaction: (raw: Buffer) => Promise<string>
): Promise<string> {
  const signed = await signTransaction(tx);
  const raw = signed.serialize();
  return await sendRawTransaction(Buffer.from(raw));
}

export function disconnect() {
  if (cachedSigner?.type === 'seed-vault' && cachedSigner.svAuthToken) {
    SeedVault.deauthorizeSeed(cachedSigner.svAuthToken).catch(() => {});
  }
  cachedSigner = null;
}

// Restore cachedSigner from stored session data (no wallet popup)
export function restoreFromStorage(address: string, mwaAuthToken: string) {
  cachedSigner = {
    type: 'mwa',
    publicKey: new PublicKey(address),
    mwaAuthToken,
  };
}

export function getSignerType(): SignerType | null {
  return cachedSigner?.type ?? null;
}

export function getPublicKey(): PublicKey | null {
  return cachedSigner?.publicKey ?? null;
}
