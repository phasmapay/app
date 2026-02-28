import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  generateEphemeralKeypair,
  saveUnclaimedPayment,
  updateUnclaimedPayment,
  removeUnclaimedPayment,
  getUnclaimedPayments,
  keypairFromUnclaimed,
  buildSweepTx,
  pollForPayment,
  UnclaimedPayment,
} from '../services/ghostPayment';
import { writePaymentTag, buildSolanaPayUrl } from '../services/nfc';
import { startHce, stopHce } from '../services/hce';
import { saveTransaction } from '../services/storage';
import { APP_IDENTITY } from '../utils/constants';
import { getConnection } from '../utils/solana';

export type GhostReceiveStatus =
  | 'idle'
  | 'generating'
  | 'writing'
  | 'polling'
  | 'received'
  | 'claiming'
  | 'done'
  | 'error';

export type GhostReceiveState = {
  status: GhostReceiveStatus;
  ephemeralPubkey?: string;
  receivedAmount?: bigint;
  claimSignature?: string;
  message?: string;
  currentPaymentId?: string;
};

export function useGhostReceive() {
  const [state, setState] = useState<GhostReceiveState>({ status: 'idle' });
  const [unclaimedPayments, setUnclaimedPayments] = useState<UnclaimedPayment[]>([]);
  const cleanupPollRef = useRef<(() => void) | null>(null);
  const prefetchedBlockhashRef = useRef<{ blockhash: string; lastValidBlockHeight: number } | null>(null);

  const cancelPolling = () => {
    if (cleanupPollRef.current) {
      cleanupPollRef.current();
      cleanupPollRef.current = null;
    }
  };

  const refreshUnclaimed = useCallback(async () => {
    const list = await getUnclaimedPayments();
    const claimable = list.filter((p) => p.status === 'received' || p.status === 'failed');
    setUnclaimedPayments(claimable);
    return claimable;
  }, []);

  const start = useCallback(
    async (amount: number, merchantPubkey: string, _authToken: string) => {
      cancelPolling();

      try {
        // Step 1: generate ephemeral keypair
        setState({ status: 'generating' });
        const { publicKey: ephPubkey, secretKey } = generateEphemeralKeypair();

        // Step 2: persist to unclaimed list (not overwriting old ones)
        const paymentId = `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const payment: UnclaimedPayment = {
          id: paymentId,
          secretKey,
          ephemeralPubkey: ephPubkey,
          amount,
          createdAt: Date.now(),
          status: 'pending',
        };
        await saveUnclaimedPayment(payment);

        // Step 3: start HCE emulation (phone acts as NFC tag for phone-to-phone)
        setState({ status: 'writing', ephemeralPubkey: ephPubkey, currentPaymentId: paymentId });
        const payUrl = buildSolanaPayUrl(ephPubkey, amount, 'Ghost Pay');
        try {
          await startHce(payUrl);
        } catch {
          // HCE not available — fall back to writing a physical NFC tag
          await writePaymentTag(ephPubkey, amount, 'Ghost Pay');
        }

        // Step 4: start polling for payment
        setState({ status: 'polling', ephemeralPubkey: ephPubkey, currentPaymentId: paymentId });

        const connection = getConnection();
        const cleanup = pollForPayment(
          connection,
          ephPubkey,
          amount,
          (rawAmount) => {
            cleanupPollRef.current = null;
            // Update storage with received status
            updateUnclaimedPayment(paymentId, { status: 'received', receivedAmount: Number(rawAmount) }).catch(() => {});
            // Pre-fetch blockhash so claim is faster
            getConnection().getLatestBlockhash('confirmed')
              .then((bh) => { prefetchedBlockhashRef.current = bh; })
              .catch(() => {});
            setState({ status: 'received', ephemeralPubkey: ephPubkey, receivedAmount: rawAmount, currentPaymentId: paymentId });
          },
          () => {
            cleanupPollRef.current = null;
            setState({
              status: 'error',
              ephemeralPubkey: ephPubkey,
              currentPaymentId: paymentId,
              message: 'Payment timed out after 3 minutes. Tap Retry to wait again.',
            });
          },
        );
        cleanupPollRef.current = cleanup;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useGhostReceive] start failed:', err);
        setState({ status: 'error', message });
      }
    },
    [],
  );

  const claim = useCallback(
    async (connection: Connection, merchantPubkeyStr: string, authToken: string, paymentId?: string) => {
      setState((prev) => ({ ...prev, status: 'claiming' }));
      try {
        console.log('[useGhostReceive] claim started, paymentId:', paymentId);

        // Resolve the ephemeral keypair — either from paymentId or current state
        let ephemeralKeypair: Keypair;
        let resolvedPaymentId = paymentId;

        if (paymentId) {
          const list = await getUnclaimedPayments();
          const payment = list.find((p) => p.id === paymentId);
          if (!payment) throw new Error('Unclaimed payment not found');
          ephemeralKeypair = keypairFromUnclaimed(payment);
          await updateUnclaimedPayment(paymentId, { status: 'claiming' });
        } else {
          // Fallback: find the most recent received/failed payment
          const list = await getUnclaimedPayments();
          const payment = list.find((p) => p.status === 'received' || p.status === 'failed');
          if (!payment) throw new Error('No unclaimed payment found');
          ephemeralKeypair = keypairFromUnclaimed(payment);
          resolvedPaymentId = payment.id;
          await updateUnclaimedPayment(payment.id, { status: 'claiming' });
        }

        console.log('[useGhostReceive] ephemeral loaded:', ephemeralKeypair.publicKey.toBase58());

        const merchantPubkey = new PublicKey(merchantPubkeyStr);

        // Build tx BEFORE opening MWA — RPC calls happen while PhasmaPay is in foreground
        console.log('[useGhostReceive] building sweep tx...');
        const { tx, amount } = await buildSweepTx(connection, ephemeralKeypair, merchantPubkey, null);
        console.log('[useGhostReceive] sweep tx built, amount:', amount.toString());

        // MWA session: only auth + sign + send (no RPC calls inside — keeps it fast)
        const signature = await transact(async (wallet) => {
          try {
            await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
          } catch {
            await wallet.authorize({ cluster: 'solana:devnet' as any, identity: APP_IDENTITY });
          }

          console.log('[useGhostReceive] MWA authorized, signing...');
          const results = await wallet.signTransactions({ transactions: [tx] });
          if (!results || results.length === 0) {
            throw new Error('Wallet returned empty results — tx may have been rejected');
          }
          const signedTx = results[0];

          // Add ephemeral signature + send immediately
          signedTx.partialSign(ephemeralKeypair);
          const rawTx = signedTx.serialize();
          const sig = await connection.sendRawTransaction(rawTx, {
            skipPreflight: true,
            maxRetries: 3,
          });
          console.log('[useGhostReceive] sent raw tx, signature:', sig);
          return sig;
        });

        // Confirm outside MWA — tolerate slow devnet confirmation
        try {
          await connection.confirmTransaction({
            signature,
            blockhash: tx.recentBlockhash!,
            lastValidBlockHeight: tx.lastValidBlockHeight!,
          }, 'confirmed');
        } catch (confirmErr: unknown) {
          const status = await connection.getSignatureStatus(signature);
          if (!status?.value?.confirmationStatus) {
            throw confirmErr;
          }
          console.log('[useGhostReceive] tx confirmed via fallback check');
        }
        console.log('[useGhostReceive] tx confirmed');

        // Cleanup: remove from unclaimed list
        if (resolvedPaymentId) {
          removeUnclaimedPayment(resolvedPaymentId).catch(() => {});
        }
        saveTransaction({
          signature,
          sender: ephemeralKeypair.publicKey.toBase58(),
          recipient: merchantPubkeyStr,
          amount: Number(amount) / 1_000_000,
          timestamp: Date.now(),
          savedGas: 0,
          cashback: 0,
          strategy: 'received',
          type: 'received',
        }).catch(() => {});

        setState({
          status: 'done',
          receivedAmount: amount,
          claimSignature: signature,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useGhostReceive] claim failed:', err);
        // Mark as failed so it stays claimable
        if (paymentId) {
          updateUnclaimedPayment(paymentId, { status: 'failed' }).catch(() => {});
        }
        Alert.alert('Claim Failed', message);
        setState((prev) => ({ ...prev, status: 'error', message }));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    cancelPolling();
    stopHce().catch(() => {});
    setState({ status: 'idle' });
    // Refresh unclaimed list when returning to idle
    refreshUnclaimed().catch(() => {});
  }, [refreshUnclaimed]);

  return { state, unclaimedPayments, start, claim, reset, refreshUnclaimed };
}
