import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import { USDC_DECIMALS } from '../utils/constants';
import { usdcToRaw } from '../utils/solana';
import { signAndSendMwa, getPublicKey as signerPubkey } from './signer';

export type PaymentResult = {
  signature: string;
  sender: string;
  recipient: string;
  amount: number;
  timestamp: number;
};

export async function buildUsdcTransferTx(
  connection: Connection,
  sender: PublicKey,
  recipient: PublicKey,
  usdcAmount: number,
  usdcMint: PublicKey
): Promise<Transaction> {
  const senderAta = getAssociatedTokenAddressSync(usdcMint, sender);
  const recipientAta = getAssociatedTokenAddressSync(usdcMint, recipient);
  const rawAmount = usdcToRaw(usdcAmount);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction({
    feePayer: sender,
    blockhash,
    lastValidBlockHeight,
  });

  // Optimized compute budget
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));

  // Idempotent ATA creation — safe whether ATA exists or not
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      sender,
      recipientAta,
      recipient,
      usdcMint
    )
  );

  // Transfer with decimal verification
  tx.add(
    createTransferCheckedInstruction(
      senderAta,
      usdcMint,
      recipientAta,
      sender,
      rawAmount,
      USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  return tx;
}

export async function executePayment(
  connection: Connection,
  recipientAddress: string,
  amount: number,
  usdcMint: PublicKey,
  _authToken?: string,
  senderAddress?: string
): Promise<PaymentResult> {
  const senderPubkey = senderAddress
    ? new PublicKey(senderAddress)
    : signerPubkey()!;

  if (!senderPubkey) throw new Error('Wallet not connected');

  const recipientPubkey = new PublicKey(recipientAddress);

  // Build tx with all RPC calls BEFORE signing (stays in foreground)
  const tx = await buildUsdcTransferTx(connection, senderPubkey, recipientPubkey, amount, usdcMint);

  // Sign + send via MWA in one session — Phantom returns to app immediately
  const signature = await signAndSendMwa(tx);

  return {
    signature,
    sender: senderPubkey.toBase58(),
    recipient: recipientAddress,
    amount,
    timestamp: Date.now(),
  };
}

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  console.log('[RPC] endpoint:', url.slice(0, 40), 'method:', method);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  console.log('[RPC] response:', JSON.stringify(json).slice(0, 120));
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

export async function getUsdcBalance(
  connection: Connection,
  wallet: PublicKey,
  usdcMint: PublicKey
): Promise<number> {
  try {
    const ata = getAssociatedTokenAddressSync(usdcMint, wallet);
    console.log('[USDC] ATA:', ata.toBase58(), 'mint:', usdcMint.toBase58());
    const result = await rpcCall(connection.rpcEndpoint, 'getTokenAccountBalance', [ata.toBase58()]) as { value?: { uiAmount?: number } };
    const bal = result?.value?.uiAmount ?? 0;
    console.log('[USDC] balance:', bal);
    return bal;
  } catch (e) {
    console.log('[USDC] error:', String(e));
    return 0;
  }
}

export async function getSolBalance(
  connection: Connection,
  wallet: PublicKey
): Promise<number> {
  try {
    console.log('[SOL] wallet:', wallet.toBase58());
    const result = await rpcCall(connection.rpcEndpoint, 'getBalance', [wallet.toBase58(), { commitment: 'confirmed' }]) as { value?: number };
    const bal = (result?.value ?? 0) / 1_000_000_000;
    console.log('[SOL] balance:', bal);
    return bal;
  } catch (e) {
    console.log('[SOL] error:', String(e));
    return 0;
  }
}

export async function confirmTransaction(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<boolean> {
  try {
    const result = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );
    return !result.value.err;
  } catch {
    return false;
  }
}
