import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getConnection, resetConnection, getFallbackConnection } from '../utils/solana';
import { getUsdcBalance, getSolBalance } from '../services/payment';
import { getSkrBalance, getSkrTier, SkrStatus } from '../services/skr';
import { USDC_MINT } from '../utils/constants';

export type Balances = {
  usdc: number;
  sol: number;
  skrStatus: SkrStatus;
  isLoading: boolean;
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async (connection: ReturnType<typeof getConnection>, walletAddress: string) => {
    const pubkey = new PublicKey(walletAddress);
    const usdcMint = new PublicKey(USDC_MINT);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Balance fetch timeout')), 15000)
    );
    return Promise.race([
      Promise.all([
        getUsdcBalance(connection, pubkey, usdcMint),
        getSolBalance(connection, pubkey),
        getSkrBalance(connection, pubkey),
      ]),
      timeout,
    ]);
  };

  const refresh = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoading(true);
    setError(null);
    try {
      const connection = getConnection();
      const [usdcBal, solBal, skrBal] = await fetchBalances(connection, walletAddress);
      setUsdc(usdcBal);
      setSol(solBal);
      setSkrStatus(getSkrTier(skrBal));
    } catch (err) {
      console.warn('Balance fetch failed (primary RPC):', err);
      // Retry with public devnet RPC as fallback
      resetConnection();
      try {
        const fallbackConnection = getFallbackConnection();
        const [usdcBal, solBal, skrBal] = await fetchBalances(fallbackConnection, walletAddress);
        setUsdc(usdcBal);
        setSol(solBal);
        setSkrStatus(getSkrTier(skrBal));
      } catch (retryErr) {
        console.warn('Balance fetch failed (retry):', retryErr);
        setUsdc(0);
        setSol(0);
        setError('RPC unavailable — pull to retry');
      }
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usdc, sol, skrStatus, isLoading, error, refresh };
}
