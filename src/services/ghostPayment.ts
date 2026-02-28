import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  createCloseAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { USDC_MINT, USDC_DECIMALS } from '../utils/constants';

// NOTE: react-native-get-random-values polyfill is handled in the app entry point.
// Do NOT import it here. Keypair.generate() works because the polyfill loads first.

const SESSION_KEY = 'ghost_session_key'; // legacy — migrated on first load
const UNCLAIMED_KEY = 'ghost_unclaimed_payments';

export type UnclaimedPayment = {
  id: string;
  secretKey: number[];
  ephemeralPubkey: string;
  amount: number;
  receivedAmount?: number;
  createdAt: number;
  status: 'pending' | 'received' | 'claiming' | 'failed';
};

export function generateEphemeralKeypair(): { publicKey: string; secretKey: number[] } {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKey: Array.from(kp.secretKey),
  };
}

// --- Multi-slot unclaimed payment storage ---

async function migrateLegacySession(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const secretKey: number[] = JSON.parse(raw);
    const kp = Keypair.fromSecretKey(new Uint8Array(secretKey));
    const payment: UnclaimedPayment = {
      id: `legacy-${Date.now()}`,
      secretKey,
      ephemeralPubkey: kp.publicKey.toBase58(),
      amount: 0, // unknown from legacy
      createdAt: Date.now(),
      status: 'received', // assume it has funds if key was saved
    };
    const existing = await getUnclaimedPayments();
    existing.push(payment);
    await AsyncStorage.setItem(UNCLAIMED_KEY, JSON.stringify(existing));
    await AsyncStorage.removeItem(SESSION_KEY);
    console.log('[GhostPay] migrated legacy session key');
  } catch (e) {
    console.warn('[GhostPay] legacy migration failed:', e);
  }
}

let migrated = false;
async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  migrated = true;
  await migrateLegacySession();
}

export async function getUnclaimedPayments(): Promise<UnclaimedPayment[]> {
  await ensureMigrated();
  try {
    const raw = await AsyncStorage.getItem(UNCLAIMED_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveUnclaimedPayment(payment: UnclaimedPayment): Promise<void> {
  const list = await getUnclaimedPayments();
  list.push(payment);
  await AsyncStorage.setItem(UNCLAIMED_KEY, JSON.stringify(list));
}

export async function updateUnclaimedPayment(
  id: string,
  updates: Partial<Pick<UnclaimedPayment, 'status' | 'receivedAmount'>>,
): Promise<void> {
  const list = await getUnclaimedPayments();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates };
  await AsyncStorage.setItem(UNCLAIMED_KEY, JSON.stringify(list));
}

export async function clearAllUnclaimed(): Promise<void> {
  await AsyncStorage.removeItem(UNCLAIMED_KEY);
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function removeUnclaimedPayment(id: string): Promise<void> {
  const list = await getUnclaimedPayments();
  const filtered = list.filter((p) => p.id !== id);
  await AsyncStorage.setItem(UNCLAIMED_KEY, JSON.stringify(filtered));
}

export function keypairFromUnclaimed(payment: UnclaimedPayment): Keypair {
  return Keypair.fromSecretKey(new Uint8Array(payment.secretKey));
}

// --- Legacy single-key API (kept for backward compat during transition) ---

export async function saveSessionKey(secretKey: number[]): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(secretKey));
}

export async function loadSessionKey(): Promise<Keypair | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export async function clearSessionKey(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// --- Transaction building ---

export async function buildSweepTx(
  connection: Connection,
  ephemeralKeypair: Keypair,
  merchantPubkey: PublicKey,
  prefetchedBlockhash?: { blockhash: string; lastValidBlockHeight: number } | null,
): Promise<{ tx: Transaction; amount: bigint }> {
  const usdcMint = new PublicKey(USDC_MINT);
  const sourceATA = getAssociatedTokenAddressSync(usdcMint, ephemeralKeypair.publicKey);
  const destATA = getAssociatedTokenAddressSync(usdcMint, merchantPubkey);

  const [sourceAccount, blockhashInfo] = await Promise.all([
    getAccount(connection, sourceATA),
    prefetchedBlockhash
      ? Promise.resolve(prefetchedBlockhash)
      : connection.getLatestBlockhash('confirmed'),
  ]);
  const amount = sourceAccount.amount;
  if (amount === 0n) throw new Error('No USDC to claim');

  const { blockhash, lastValidBlockHeight } = blockhashInfo;
  const tx = new Transaction({ feePayer: merchantPubkey, blockhash, lastValidBlockHeight });

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));

  // Create merchant USDC ATA if it doesn't exist (idempotent — safe to call if it does)
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      merchantPubkey, // payer for ATA rent
      destATA,
      merchantPubkey,
      usdcMint,
    ),
  );

  // Transfer all USDC from ephemeral ATA -> merchant ATA
  tx.add(
    createTransferCheckedInstruction(
      sourceATA,
      usdcMint,
      destATA,
      ephemeralKeypair.publicKey, // authority (owner of sourceATA)
      amount,
      USDC_DECIMALS,
    ),
  );

  // Close ephemeral ATA — reclaims ~0.002 SOL rent back to merchant
  tx.add(
    createCloseAccountInstruction(
      sourceATA,                    // account to close
      merchantPubkey,               // rent destination
      ephemeralKeypair.publicKey,   // authority (owner)
    ),
  );

  return { tx, amount };
}

/**
 * Polls every 3s for USDC arriving at the ephemeral ATA.
 * Times out at 3 minutes.
 * Returns a cleanup function — call it to cancel polling early.
 */
export function pollForPayment(
  connection: Connection,
  ephemeralPubkey: string,
  expectedAmount: number,
  onReceived: (rawAmount: bigint) => void,
  onTimeout: () => void,
): () => void {
  const owner = new PublicKey(ephemeralPubkey);
  const usdcMint = new PublicKey(USDC_MINT);
  const ata = getAssociatedTokenAddressSync(usdcMint, owner);
  const expectedRaw = BigInt(Math.round(expectedAmount * 10 ** USDC_DECIMALS));

  let cancelled = false;

  const timeoutId = setTimeout(() => {
    if (!cancelled) {
      cancelled = true;
      clearInterval(intervalId);
      onTimeout();
    }
  }, 3 * 60 * 1000);

  const intervalId = setInterval(async () => {
    if (cancelled) return;
    try {
      const account = await getAccount(connection, ata);
      if (account.amount >= expectedRaw) {
        cancelled = true;
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        onReceived(account.amount);
      }
    } catch (e) {
      if (!(e instanceof TokenAccountNotFoundError)) {
        // Unexpected error — log but keep polling
        console.warn('[GhostPay] pollForPayment error:', e);
      }
      // TokenAccountNotFoundError = ATA not yet created = no payment yet — keep polling
    }
  }, 3000);

  return () => {
    cancelled = true;
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  };
}
