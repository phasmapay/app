import { useState, useCallback, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../utils/solana';
import { writePaymentTag, cleanupNfc } from '../services/nfc';
import { pollForPaymentByReference } from '../services/merchant';
import { saveMerchantTransaction } from '../services/storage';
import { hapticPatterns } from '../utils/haptics';

type MerchantReceiveState =
  | { status: 'idle' }
  | { status: 'writing'; amount: number }
  | { status: 'waiting'; amount: number; reference: string }
  | { status: 'received'; amount: number; signature: string }
  | { status: 'error'; message: string };

export function useMerchantReceive(walletAddress: string | null) {
  const [state, setState] = useState<MerchantReceiveState>({ status: 'idle' });
  const cleanupRef = useRef<(() => void) | null>(null);

  const startReceive = useCallback(async (amount: number) => {
    if (!walletAddress) {
      setState({ status: 'error', message: 'Wallet not connected' });
      return;
    }

    setState({ status: 'writing', amount });
    try {
      const reference = await writePaymentTag(walletAddress, amount);
      hapticPatterns.nfcTap();

      setState({ status: 'waiting', amount, reference });

      const connection = getConnection();
      const referencePubkey = new PublicKey(reference);

      cleanupRef.current = pollForPaymentByReference(
        connection,
        referencePubkey,
        async (signature) => {
          hapticPatterns.paymentSuccess();
          await saveMerchantTransaction({
            signature,
            sender: 'unknown',
            amount,
            timestamp: Date.now(),
            reference,
            confirmed: true,
          });
          setState({ status: 'received', amount, signature });
        },
        () => {
          setState({ status: 'error', message: 'Payment timed out' });
        },
      );
    } catch (err) {
      setState({ status: 'error', message: err instanceof Error ? err.message : 'NFC write failed' });
    }
  }, [walletAddress]);

  const reset = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    cleanupNfc().catch(() => {});
    setState({ status: 'idle' });
  }, []);

  return { state, startReceive, reset };
}
