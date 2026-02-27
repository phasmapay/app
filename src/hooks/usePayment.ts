import { Buffer } from 'buffer';
import { useState, useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { getConnection } from '../utils/solana';
import { buildUsdcTransferTx, executePayment, PaymentResult } from '../services/payment';
import { optimizePayment, OptimizationResult } from '../services/agent';
import { calculateCashback } from '../services/skr';
import { saveTransaction } from '../services/storage';
import { trackPaymentWithTorque } from '../services/torque';
import { USDC_MINT } from '../utils/constants';
import { NfcPaymentData } from '../services/nfc';
import { signAndSendMwa } from '../services/signer';

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
      if (!walletAddress) {
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
      let result: PaymentResult;

      if (optimization.strategy === 'swap' && optimization.swapTxData) {
        const { swapTransaction } = optimization.swapTxData;
        // Pass base64 directly — avoids deserialization losing class methods
        const signature = await signAndSendMwa(swapTransaction);
        result = {
          signature,
          sender: walletAddress!,
          recipient: paymentData.recipient,
          amount: paymentData.amount,
          timestamp: Date.now(),
        };
      } else if (optimization.strategy === 'direct' && optimization.txBase64) {
        // Pass base64 directly — avoids Transaction deserialization losing class methods
        const signature = await signAndSendMwa(optimization.txBase64);
        result = {
          signature,
          sender: walletAddress!,
          recipient: paymentData.recipient,
          amount: paymentData.amount,
          timestamp: Date.now(),
        };
      } else {
        // Fallback: rebuild tx (should not normally reach here)
        const connection = getConnection();
        const usdcMint = new PublicKey(USDC_MINT);
        result = await executePayment(
          connection,
          paymentData.recipient,
          paymentData.amount,
          usdcMint,
          undefined,
          walletAddress!,
        );
      }

      setState({ status: 'confirming', signature: result.signature });

      const cashback = calculateCashback(paymentData.amount, skrBalance);

      await saveTransaction({
        ...result,
        savedGas: optimization.savedGas,
        cashback,
        strategy: optimization.strategy as 'direct' | 'swap',
        type: 'sent',
      });

      // Track payment with Torque loyalty (non-blocking)
      trackPaymentWithTorque(result.signature, paymentData.amount).catch(() => {});

      setState({
        status: 'success',
        result,
        cashback,
        savedGas: optimization.savedGas,
      });
    } catch (err) {
      console.warn('[Payment] confirm failed:', err);
      const raw = err instanceof Error ? err.message : String(err);
      // MWA session closed = user cancelled in wallet
      const userCancelled =
        raw.includes('CLOSED') ||
        raw.includes('closed') ||
        raw.includes('cancelled') ||
        raw.includes('canceled') ||
        raw.includes('user rejected') ||
        raw.includes('User rejected');
      setState({
        status: 'error',
        message: userCancelled ? 'Payment cancelled — tap Try Again to retry' : raw,
      });
    }
  }, [state, walletAddress, skrBalance]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, prepare, confirm, reset };
}
