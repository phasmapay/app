export const SOLANA_NETWORK = (process.env.EXPO_PUBLIC_SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta';

export const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';

export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'; // Circle devnet USDC
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SKR_DECIMALS = 6;
export const SKR_TREASURY = process.env.EXPO_PUBLIC_SKR_TREASURY ?? '';

export const SKR_MINT = process.env.EXPO_PUBLIC_SKR_MINT ?? 'AD4ereCFKqgRCp77sU5q771oeNrrisxaEbqG9Ni9foyS';

export const USDC_MINT = SOLANA_NETWORK === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
export const USDC_DECIMALS = 6;

export const APP_IDENTITY = {
  name: 'PhasmaPay',
  uri: 'https://phasmapay.app',
  icon: 'icon.png',
} as const;

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

export const JUPITER_V6_QUOTE = 'https://quote-api.jup.ag/v6/quote';
export const JUPITER_V6_SWAP = 'https://quote-api.jup.ag/v6/swap';

export const SKR_TIERS = {
  GOLD: { minStaked: 1000, cashbackPct: 0.03, label: 'Gold' },
  SILVER: { minStaked: 100, cashbackPct: 0.02, label: 'Silver' },
  BRONZE: { minStaked: 10, cashbackPct: 0.01, label: 'Bronze' },
  BASE: { minStaked: 0, cashbackPct: 0.005, label: 'Ghost' },
} as const;

// Vault daily limit ceiling per SKR tier
export const SKR_VAULT_CEILINGS = {
  Gold: 500,
  Silver: 100,
  Bronze: 25,
  Ghost: 10,
} as const;
