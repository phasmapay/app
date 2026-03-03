import { Buffer } from 'buffer';
import { useState, useCallback } from 'react';
import { Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getConnection } from '../utils/solana';
import { buildUsdcTransferTx, executePayment, PaymentResult } from '../services/payment';
import { optimizePayment, OptimizationResult } from '../services/agent';
import { calculateCashback, getSkrTier } from '../services/skr';
import { saveTransaction } from '../services/storage';
import { trackPaymentWithTorque } from '../services/torque';
import { USDC_MINT } from '../utils/constants';
import { NfcPaymentData } from '../services/nfc';
import { signAndSendMwa } from '../services/signer';
import { assessRecipient, GuardianVerdict } from '../services/guardian';
import {
  getVaultConfig, canSpend, recordSpend, buildVaultPaymentTx, getVaultBalance,
} from '../services/vault';
import { distributeCashback } from '../services/skrStaking';

function getTreasuryKeypair(): Keypair | null {
  try {
    const secret = process.env.EXPO_PUBLIC_SKR_TREASURY_SECRET;
    if (!secret) return null;
    return Keypair.fromSecretKey(bs58.decode(secret));
  } catch {
    return null;
  }
}

export type PaymentState =
  | { status: 'idle' }
  | { status: 'optimizing' }
  | { status: 'guarding' }
  | {
      status: 'awaiting_approval';
      optimization: OptimizationResult;
      paymentData: NfcPaymentData;
      guardian: GuardianVerdict;
      vaultEligible: boolean;
      vaultRemaining: number;
    }
  | { status: 'signing' }
  | { status: 'confirming'; signature: string }
  | { status: 'success'; result: PaymentResult; cashback: number; savedGas: number; cashbackSig?: string }
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
          connection, senderPubkey, paymentData.recipient, paymentData.amount, usdcMint
        );

        if (optimization.strategy === 'insufficient') {
          setState({ status: 'error', message: optimization.reason });
          return;
        }

        // Guardian assessment
        setState({ status: 'guarding' });
        const skrStatus = getSkrTier(skrBalance);
        const guardian = await assessRecipient(
          connection, paymentData.recipient, paymentData.amount, walletAddress, skrStatus.tier
        );

        // Vault eligibility
        let vaultEligible = false;
        let vaultRemaining = 0;
        const vaultConfig = await getVaultConfig();
        if (vaultConfig?.enabled) {
          const spendCheck = canSpend(vaultConfig, paymentData.amount);
          const vaultBal = await getVaultBalance(connection);
          vaultEligible = spendCheck.allowed && vaultBal >= paymentData.amount;
          vaultRemaining = spendCheck.remaining;
        }

        // Auto-approve: tier threshold met + vault available
        if (guardian.autoApprove && vaultEligible) {
          // Skip confirmation entirely — instant payment
          setState({ status: 'signing' });
          const result = await executeVaultPayment(connection, paymentData, walletAddress);
          await recordSpend(paymentData.amount);
          const cashback = calculateCashback(paymentData.amount, skrBalance);
          await saveTransaction({
            ...result, savedGas: optimization.savedGas, cashback,
            strategy: 'direct', type: 'sent',
          });
          trackPaymentWithTorque(result.signature, paymentData.amount).catch(() => {});
          // Fire-and-forget SKR cashback
          const treasury = getTreasuryKeypair();
          let cashbackSig: string | undefined;
          if (treasury && cashback > 0) {
            cashbackSig = await distributeCashback(
              connection, treasury, new PublicKey(walletAddress), paymentData.amount, skrBalance
            ) ?? undefined;
          }
          setState({ status: 'success', result, cashback, savedGas: optimization.savedGas, cashbackSig });
          return;
        }

        setState({
          status: 'awaiting_approval', optimization, paymentData, guardian,
          vaultEligible, vaultRemaining,
        });
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to prepare payment',
        });
      }
    },
    [walletAddress, authToken, skrBalance]
  );

  const confirm = useCallback(async (useVault = false) => {
    if (state.status !== 'awaiting_approval') return;
    const { paymentData, optimization } = state;

    setState({ status: 'signing' });
    try {
      let result: PaymentResult;

      if (useVault) {
        const connection = getConnection();
        result = await executeVaultPayment(connection, paymentData, walletAddress!);
        await recordSpend(paymentData.amount);
      } else if (optimization.strategy === 'swap' && optimization.swapTxData) {
        const { swapTransaction } = optimization.swapTxData;
        const signature = await signAndSendMwa(swapTransaction);
        result = {
          signature, sender: walletAddress!, recipient: paymentData.recipient,
          amount: paymentData.amount, timestamp: Date.now(),
        };
      } else if (optimization.strategy === 'direct' && optimization.txBase64) {
        const signature = await signAndSendMwa(optimization.txBase64);
        result = {
          signature, sender: walletAddress!, recipient: paymentData.recipient,
          amount: paymentData.amount, timestamp: Date.now(),
        };
      } else {
        const connection = getConnection();
        const usdcMint = new PublicKey(USDC_MINT);
        result = await executePayment(
          connection, paymentData.recipient, paymentData.amount,
          usdcMint, undefined, walletAddress!,
        );
      }

      setState({ status: 'confirming', signature: result.signature });

      const cashback = calculateCashback(paymentData.amount, skrBalance);

      await saveTransaction({
        ...result, savedGas: optimization.savedGas, cashback,
        strategy: optimization.strategy as 'direct' | 'swap', type: 'sent',
      });

      trackPaymentWithTorque(result.signature, paymentData.amount).catch(() => {});

      // Fire-and-forget SKR cashback
      const treasury = getTreasuryKeypair();
      let cashbackSig: string | undefined;
      if (treasury && cashback > 0) {
        cashbackSig = await distributeCashback(
          connection, treasury, new PublicKey(walletAddress!), paymentData.amount, skrBalance
        ).catch(() => null) ?? undefined;
      }

      setState({ status: 'success', result, cashback, savedGas: optimization.savedGas, cashbackSig });
    } catch (err) {
      console.warn('[Payment] confirm failed:', err);
      const raw = err instanceof Error ? err.message : String(err);
      const userCancelled =
        raw.includes('CLOSED') || raw.includes('closed') ||
        raw.includes('cancelled') || raw.includes('canceled') ||
        raw.includes('user rejected') || raw.includes('User rejected');
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

async function executeVaultPayment(
  connection: ReturnType<typeof getConnection>,
  paymentData: NfcPaymentData,
  sender: string,
): Promise<PaymentResult> {
  const { tx, keypair } = await buildVaultPaymentTx(
    connection, paymentData.recipient, paymentData.amount
  );
  tx.sign(keypair);
  const rawTx = tx.serialize();
  const signature = await connection.sendRawTransaction(rawTx, { skipPreflight: false });
  return {
    signature, sender, recipient: paymentData.recipient,
    amount: paymentData.amount, timestamp: Date.now(),
  };
}
