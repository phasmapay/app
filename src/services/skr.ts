import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { SKR_MINT, SKR_TIERS } from '../utils/constants';

export type SkrTier = 'Gold' | 'Silver' | 'Bronze' | 'Ghost';

export type SkrStatus = {
  balance: number;
  tier: SkrTier;
  cashbackPct: number;
  nextTier: SkrTier | null;
  nextTierRequirement: number;
};

export async function getSkrBalance(
  connection: Connection,
  wallet: PublicKey
): Promise<number> {
  try {
    const skrAta = getAssociatedTokenAddressSync(
      new PublicKey(SKR_MINT),
      wallet
    );
    const balance = await connection.getTokenAccountBalance(skrAta);
    return Number(balance.value.uiAmount ?? 0);
  } catch {
    return 0;
  }
}

export function getSkrTier(skrStaked: number): SkrStatus {
  if (skrStaked >= SKR_TIERS.GOLD.minStaked) {
    return {
      balance: skrStaked,
      tier: 'Gold',
      cashbackPct: SKR_TIERS.GOLD.cashbackPct,
      nextTier: null,
      nextTierRequirement: 0,
    };
  }
  if (skrStaked >= SKR_TIERS.SILVER.minStaked) {
    return {
      balance: skrStaked,
      tier: 'Silver',
      cashbackPct: SKR_TIERS.SILVER.cashbackPct,
      nextTier: 'Gold',
      nextTierRequirement: SKR_TIERS.GOLD.minStaked - skrStaked,
    };
  }
  if (skrStaked >= SKR_TIERS.BRONZE.minStaked) {
    return {
      balance: skrStaked,
      tier: 'Bronze',
      cashbackPct: SKR_TIERS.BRONZE.cashbackPct,
      nextTier: 'Silver',
      nextTierRequirement: SKR_TIERS.SILVER.minStaked - skrStaked,
    };
  }
  return {
    balance: skrStaked,
    tier: 'Ghost',
    cashbackPct: SKR_TIERS.BASE.cashbackPct,
    nextTier: 'Bronze',
    nextTierRequirement: SKR_TIERS.BRONZE.minStaked - skrStaked,
  };
}

export function calculateCashback(
  paymentAmount: number,
  skrStaked: number
): number {
  const { cashbackPct } = getSkrTier(skrStaked);
  return paymentAmount * cashbackPct;
}

export function getTierColor(tier: SkrTier): string {
  switch (tier) {
    case 'Gold': return '#FFD700';
    case 'Silver': return '#C0C0C0';
    case 'Bronze': return '#CD7F32';
    case 'Ghost': return '#9945FF';
  }
}

export function getTierEmoji(tier: SkrTier): string {
  switch (tier) {
    case 'Gold': return '🥇';
    case 'Silver': return '🥈';
    case 'Bronze': return '🥉';
    case 'Ghost': return '👻';
  }
}
