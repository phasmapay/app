import { Buffer } from 'buffer';
import { useState, useCallback } from 'react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { getConnection } from '../utils/solana';
import { executePayment, PaymentResult } from '../services/payment';
import { optimizePayment, OptimizationResult } from '../services/agent';
import { calculateCashback } from '../services/skr';
import { saveTransaction } from '../services/storage';
import { trackPaymentWithTorque } from '../services/torque';
import { USDC_MINT } from '../utils/constants';
import { NfcPaymentData } from '../services/nfc';
import { signTransaction } from '../services/signer';

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
      let result: PaymentResult;

      if (optimization.strategy === 'swap' && optimization.swapTxData) {
        const { swapTransaction } = optimization.swapTxData;
        const connection = getConnection();

        // Jupiter v6 returns a VersionedTransaction even with asLegacyTransaction:true.
        // Deserialize as legacy Transaction for MWA/SeedVault signing compatibility.
        const txBuffer = Buffer.from(swapTransaction, 'base64');
        let tx: Transaction;
        try {
          tx = Transaction.from(txBuffer);
        } catch {
          // Fallback: deserialize as VersionedTransaction and extract legacy message
          const vtx = VersionedTransaction.deserialize(txBuffer);
          const legacyMsg = vtx.message;
          // Re-serialize the inner legacy message bytes as a Transaction
          tx = Transaction.from(Buffer.from(legacyMsg.serialize()));
        }
        const signed = await signTransaction(tx);
        const signature = await connection.sendRawTransaction(signed.serialize());

        result = {
          signature,
          sender: walletAddress!,
          recipient: paymentData.recipient,
          amount: paymentData.amount,
          timestamp: Date.now(),
        };
      } else {
        const connection = getConnection();
        const usdcMint = new PublicKey(USDC_MINT);
        result = await executePayment(
          connection,
          paymentData.recipient,
          paymentData.amount,
          usdcMint,
          undefined,
          walletAddress!
        );
      }

      setState({ status: 'confirming', signature: result.signature });

      const cashback = calculateCashback(paymentData.amount, skrBalance);

      await saveTransaction({
        ...result,
        savedGas: optimization.savedGas,
        cashback,
        strategy: optimization.strategy as 'direct' | 'swap',
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
      console.error('[Payment] confirm failed:', err);
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Payment failed',
      });
    }
  }, [state, walletAddress, skrBalance]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return { state, prepare, confirm, reset };
}
