import { Buffer } from 'buffer';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { buildUsdcTransferTx } from './payment';
import { getSwapQuote, getSolToUsdcQuote, buildSwapTx } from './jupiter';
import { SOL_MINT, USDC_DECIMALS } from '../utils/constants';

export type PaymentStrategy = 'direct' | 'swap' | 'insufficient';

export type OptimizationResult = {
  strategy: PaymentStrategy;
  savedGas: number; // in USD
  estimatedFee: number; // in USD
  swapQuote?: Awaited<ReturnType<typeof getSwapQuote>>;
  swapTxData?: { swapTransaction: string; lastValidBlockHeight: number };
  txBase64?: string; // serialized Transaction — survives React state (class instances don't)
  reason: string;
};

const DIRECT_TRANSFER_FEE_USD = 0.00025;
const SWAP_OVERHEAD_USD = 0.00037;

export async function optimizePayment(
  connection: Connection,
  senderPubkey: PublicKey,
  recipientAddress: string,
  usdcAmount: number,
  usdcMint: PublicKey
): Promise<OptimizationResult> {
  const t0 = Date.now();
  // Fetch USDC + SOL balances in parallel
  const senderAta = getAssociatedTokenAddressSync(usdcMint, senderPubkey);
  const [usdcBalance, solBalance] = await Promise.all([
    connection.getTokenAccountBalance(senderAta)
      .then(b => Number(b.value.uiAmount ?? 0))
      .catch(() => 0),
    connection.getBalance(senderPubkey),
  ]);
  console.log(`[Optimize] balances in ${Date.now() - t0}ms — USDC: ${usdcBalance}, SOL: ${solBalance / 1e9}`);

  if (usdcBalance >= usdcAmount) {
    // Direct USDC path — cheapest
    const tx = await buildUsdcTransferTx(
      connection,
      senderPubkey,
      new PublicKey(recipientAddress),
      usdcAmount,
      usdcMint
    );
    const txBase64 = Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString('base64');
    console.log(`[Optimize] direct tx built in ${Date.now() - t0}ms`);
    return {
      strategy: 'direct',
      savedGas: SWAP_OVERHEAD_USD,
      estimatedFee: DIRECT_TRANSFER_FEE_USD,
      txBase64,
      reason: `Direct USDC transfer (balance: $${usdcBalance.toFixed(2)})`,
    };
  }

  const solBalanceUi = solBalance / 1_000_000_000;

  if (solBalanceUi > 0.01) {
    // Attempt SOL → USDC swap (5s timeout — Jupiter can be slow on devnet)
    try {
      const timeoutMs = 5000;
      const swapQuote = await Promise.race([
        getSolToUsdcQuote(solBalanceUi * 0.99, usdcMint.toString()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Jupiter timeout')), timeoutMs)),
      ]);
      const swapOutputUsdc = Number(swapQuote.outAmount) / 10 ** USDC_DECIMALS;

      if (swapOutputUsdc >= usdcAmount) {
        const swapTxData = await Promise.race([
          buildSwapTx(swapQuote, senderPubkey.toBase58()),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Jupiter tx timeout')), timeoutMs)),
        ]);
        return {
          strategy: 'swap',
          savedGas: 0, // swap is more expensive but necessary
          estimatedFee: DIRECT_TRANSFER_FEE_USD + SWAP_OVERHEAD_USD,
          swapQuote,
          swapTxData,
          reason: `Auto-swap SOL→USDC (${solBalanceUi.toFixed(4)} SOL available)`,
        };
      }
    } catch {
      // Jupiter unavailable or no route
    }
  }

  return {
    strategy: 'insufficient',
    savedGas: 0,
    estimatedFee: 0,
    reason: `Insufficient funds (USDC: $${usdcBalance.toFixed(2)}, SOL: ${solBalanceUi.toFixed(4)})`,
  };
}

export function formatSavings(savedGas: number): string {
  if (savedGas <= 0) return '';
  // savedGas is in USD (e.g. 0.00037) — display as fractional cents
  return `AI saved you $${savedGas.toFixed(5)} in gas`;
}
