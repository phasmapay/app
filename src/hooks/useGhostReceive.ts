import { useCallback, useRef, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  generateEphemeralKeypair,
  saveSessionKey,
  loadSessionKey,
  clearSessionKey,
  buildSweepTx,
  pollForPayment,
} from '../services/ghostPayment';
import { writePaymentTag } from '../services/nfc';
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

        // Step 3: write NFC tag with Solana Pay URL pointing at ephemeral address
        setState({ status: 'writing', ephemeralPubkey: ephPubkey });
        await writePaymentTag(ephPubkey, amount, 'Ghost Pay');

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

        // Encode the partially-signed tx for MWA
        const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

        const signature: string = await transact(async (wallet) => {
          // Reauthorize — re-use existing session token
          try {
            await wallet.reauthorize({ auth_token: authToken, identity: APP_IDENTITY });
          } catch {
            // If reauth fails, authorize fresh (user taps approve in wallet)
            await wallet.authorize({ cluster: 'solana:devnet', identity: APP_IDENTITY });
          }

          // signAndSendTransactions sends the tx and returns signatures
          const results = await wallet.signAndSendTransactions({
            transactions: [serialized],
          });
          return results[0] as unknown as string;
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
    setState({ status: 'idle' });
  }, []);

  return { state, start, claim, reset };
}
