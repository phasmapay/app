import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../utils/solana';
import { getUsdcBalance, getSolBalance } from '../services/payment';
import { getSkrBalance, getSkrTier, SkrStatus } from '../services/skr';
import { PublicKey as SolPublicKey } from '@solana/web3.js';
import { USDC_MINT } from '../utils/constants';

export type Balances = {
  usdc: number;
  sol: number;
  skrStatus: SkrStatus;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

export function useBalances(walletAddress: string | null): Balances {
  const [usdc, setUsdc] = useState(0);
  const [sol, setSol] = useState(0);
  const [skrStatus, setSkrStatus] = useState<SkrStatus>({
    balance: 0,
    tier: 'Ghost',
    cashbackPct: 0.005,
    nextTier: 'Bronze',
    nextTierRequirement: 100,
  });
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    try {
      const connection = getConnection();
      const pubkey = new PublicKey(walletAddress);
      const usdcMint = new PublicKey(USDC_MINT);

      const [usdcBal, solBal, skrBal] = await Promise.all([
        getUsdcBalance(connection, pubkey, usdcMint),
        getSolBalance(connection, pubkey),
        getSkrBalance(connection, pubkey),
      ]);

      setUsdc(usdcBal);
      setSol(solBal);
      setSkrStatus(getSkrTier(skrBal));
    } catch (err) {
      console.error('Balance fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usdc, sol, skrStatus, isLoading, refresh };
}
