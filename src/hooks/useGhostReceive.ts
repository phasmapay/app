import { useCallback, useRef, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  generateEphemeralKeypair,
  saveSessionKey,
  loadSessionKey,
  clearSessionKey,
  buildSweepTx,
  pollForPayment,
} from '../services/ghostPayment';
import { writePaymentTag, buildSolanaPayUrl } from '../services/nfc';
import { startHce, stopHce } from '../services/hce';
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
};

export function useGhostReceive() {
  const [state, setState] = useState<GhostReceiveState>({ status: 'idle' });
  const cleanupPollRef = useRef<(() => void) | null>(null);

  const cancelPolling = () => {
    if (cleanupPollRef.current) {
      cleanupPollRef.current();
      cleanupPollRef.current = null;
    }
  };

  const start = useCallback(
    async (amount: number, merchantPubkey: string, _authToken: string) => {
      cancelPolling();

      try {
        // Step 1: generate ephemeral keypair
        setState({ status: 'generating' });
        const { publicKey: ephPubkey, secretKey } = generateEphemeralKeypair();

        // Step 2: persist to storage BEFORE writing NFC tag (crash-safe)
        await saveSessionKey(secretKey);

        // Step 3: start HCE emulation (phone acts as NFC tag for phone-to-phone)
        setState({ status: 'writing', ephemeralPubkey: ephPubkey });
        const payUrl = buildSolanaPayUrl(ephPubkey, amount, 'Ghost Pay');
        try {
          await startHce(payUrl);
        } catch {
          // HCE not available — fall back to writing a physical NFC tag
          await writePaymentTag(ephPubkey, amount, 'Ghost Pay');
        }

        // Step 4: start polling for payment
        setState({ status: 'polling', ephemeralPubkey: ephPubkey });

        const connection = getConnection();
        const cleanup = pollForPayment(
          connection,
          ephPubkey,
          amount,
          (rawAmount) => {
            cleanupPollRef.current = null;
            setState({ status: 'received', ephemeralPubkey: ephPubkey, receivedAmount: rawAmount });
          },
          () => {
            cleanupPollRef.current = null;
            setState({
              status: 'error',
              ephemeralPubkey: ephPubkey,
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
    async (connection: Connection, merchantPubkeyStr: string, authToken: string) => {
      setState((prev) => ({ ...prev, status: 'claiming' }));
      try {
        const ephemeralKeypair = await loadSessionKey();
        if (!ephemeralKeypair) throw new Error('Session key not found — cannot claim');

        const merchantPubkey = new PublicKey(merchantPubkeyStr);
        const { tx, amount } = await buildSweepTx(connection, ephemeralKeypair, merchantPubkey);

        // Partial sign with ephemeral keypair locally (it is the authority over source ATA)
        tx.partialSign(ephemeralKeypair);

        const signature: string = await transact(async (wallet) => {
          // Reauthorize — re-use existing session token
          try {
            await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
          } catch {
            await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
          }

          // MWA expects Transaction objects, not raw buffers
          const results = await wallet.signAndSendTransactions({
            transactions: [tx],
            minContextSlot: 0,
          });
          const sig = results[0];
          return typeof sig === 'string' ? sig : bs58.encode(sig as Uint8Array);
        });

        await clearSessionKey();
        setState({
          status: 'done',
          receivedAmount: amount,
          claimSignature: signature,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useGhostReceive] claim failed:', err);
        setState((prev) => ({ ...prev, status: 'error', message }));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    cancelPolling();
    stopHce().catch(() => {});
    setState({ status: 'idle' });
  }, []);

  return { state, start, claim, reset };
}
