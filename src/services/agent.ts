import { Connection, PublicKey } from '@solana/web3.js';
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
  tx?: Awaited<ReturnType<typeof buildUsdcTransferTx>>;
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
  // Check USDC balance
  const senderAta = getAssociatedTokenAddressSync(usdcMint, senderPubkey);
  let usdcBalance = 0;
  try {
    const balance = await connection.getTokenAccountBalance(senderAta);
    usdcBalance = Number(balance.value.uiAmount ?? 0);
  } catch {
    // ATA doesn't exist → 0 USDC
    usdcBalance = 0;
  }

  if (usdcBalance >= usdcAmount) {
    // Direct USDC path — cheapest
    const tx = await buildUsdcTransferTx(
      connection,
      senderPubkey,
      new PublicKey(recipientAddress),
      usdcAmount,
      usdcMint
    );
    return {
      strategy: 'direct',
      savedGas: SWAP_OVERHEAD_USD, // savings vs swap route
      estimatedFee: DIRECT_TRANSFER_FEE_USD,
      tx,
      reason: `Direct USDC transfer (balance: $${usdcBalance.toFixed(2)})`,
    };
  }

  // Check SOL balance for swap
  const solBalance = await connection.getBalance(senderPubkey);
  const solBalanceUi = solBalance / 1_000_000_000;

  if (solBalanceUi > 0.01) {
    // Attempt SOL → USDC swap
    try {
      const swapQuote = await getSolToUsdcQuote(solBalanceUi * 0.99, usdcMint.toString());
      const swapOutputUsdc = Number(swapQuote.outAmount) / 10 ** USDC_DECIMALS;

      if (swapOutputUsdc >= usdcAmount) {
        const swapTxData = await buildSwapTx(swapQuote, senderPubkey.toBase58());
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
