import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../utils/solana';
import { executePayment, PaymentResult } from '../services/payment';
import { optimizePayment, OptimizationResult } from '../services/agent';
import { calculateCashback } from '../services/skr';
import { saveTransaction } from '../services/storage';
import { USDC_MINT } from '../utils/constants';
import { NfcPaymentData } from '../services/nfc';

export type PaymentState =
  | { status: 'idle' }
  | { status: 'optimizing' }
  | { status: 'awaiting_approval'; optimization: OptimizationResult; paymentData: NfcPaymentData }
  | { status: 'signing' }
  | { status: 'confirming'; signature: string }
  | { status: 'success'; result: PaymentResult; cashback: number; savedGas: number }
  | { status: 'error'; message: string };

export function usePayment(
  walletAddress: string | null,
  authToken: string | null,
  skrBalance: number
) {
  const [state, setState] = useState<PaymentState>({ status: 'idle' });

  const prepare = useCallback(
    async (paymentData: NfcPaymentData) => {
      if (!walletAddress || !authToken) {
        setState({ status: 'error', message: 'Wallet not connected' });
        return;
      }

      setState({ status: 'optimizing' });
      try {
        const connection = getConnection();
        const senderPubkey = new PublicKey(walletAddress);
        const usdcMint = new PublicKey(USDC_MINT);

        const optimization = await optimizePayment(
          connection,
          senderPubkey,
          paymentData.recipient,
          paymentData.amount,
          usdcMint
        );

        if (optimization.strategy === 'insufficient') {
          setState({ status: 'error', message: optimization.reason });
          return;
        }

        setState({ status: 'awaiting_approval', optimization, paymentData });
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to prepare payment',
        });
      }
    },
    [walletAddress, authToken]
  );

  const confirm = useCallback(async () => {
    if (state.status !== 'awaiting_approval') return;
    const { paymentData, optimization } = state;

    setState({ status: 'signing' });
    try {
      const connection = getConnection();
      const usdcMint = new PublicKey(USDC_MINT);

      const result = await executePayment(
        connection,
        paymentData.recipient,
        paymentData.amount,
        usdcMint,
        authToken!
      );

      setState({ status: 'confirming', signature: result.signature });

      const cashback = calculateCashback(paymentData.amount, skrBalance);

      await saveTransaction({
        ...result,
        savedGas: optimization.savedGas,
        cashback,
        strategy: optimization.strategy as 'direct' | 'swap',
      });

      setState({
        status: 'success',
        result,
        cashback,
        savedGas: optimization.savedGas,
      });
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Payment failed',
      });
    }
  }, [state, authToken, skrBalance]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, prepare, confirm, reset };
}
