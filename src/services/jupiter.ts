import { JUPITER_V6_QUOTE, JUPITER_V6_SWAP, SOL_MINT } from '../utils/constants';

export type SwapQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: unknown[];
};

export type SwapTransaction = {
  swapTransaction: string; // base64 serialized VersionedTransaction
  lastValidBlockHeight: number;
};

export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
    onlyDirectRoutes: 'false',
    asLegacyTransaction: 'true', // MWA compatibility
  });

  const res = await fetch(`${JUPITER_V6_QUOTE}?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jupiter quote failed: ${err}`);
  }
  return res.json();
}

export async function buildSwapTx(
  quoteResponse: SwapQuote,
  userPublicKey: string
): Promise<SwapTransaction> {
  const res = await fetch(JUPITER_V6_SWAP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      asLegacyTransaction: true, // MWA compatibility
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jupiter swap build failed: ${err}`);
  }
  return res.json();
}

export async function getSolToUsdcQuote(
  solAmount: number,
  usdcMint: string
): Promise<SwapQuote> {
  const lamports = Math.round(solAmount * 1_000_000_000);
  return getSwapQuote(SOL_MINT, usdcMint, lamports);
}

export function estimateSwapOutput(quote: SwapQuote): number {
  return Number(quote.outAmount) / 1_000_000; // USDC has 6 decimals
}
