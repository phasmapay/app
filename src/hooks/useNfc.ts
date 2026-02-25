import { useState, useCallback, useEffect } from 'react';
import { initNfc, readPaymentTag, writePaymentTag, cleanupNfc, NfcPaymentData } from '../services/nfc';

export type NfcState =
  | { status: 'idle' }
  | { status: 'initializing' }
  | { status: 'ready' }
  | { status: 'scanning' }
  | { status: 'writing' }
  | { status: 'success'; data: NfcPaymentData }
  | { status: 'written' }
  | { status: 'error'; message: string }
  | { status: 'unsupported' };

export function useNfc() {
  const [state, setState] = useState<NfcState>({ status: 'idle' });
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setState({ status: 'initializing' });
    initNfc().then((supported) => {
      setIsSupported(supported);
      setState(supported ? { status: 'ready' } : { status: 'unsupported' });
    });

    return () => {
      cleanupNfc();
    };
  }, []);

  const startScan = useCallback(async () => {
    if (!isSupported) return;

    setState({ status: 'scanning' });
    try {
      const data = await readPaymentTag();
      if (data) {
        setState({ status: 'success', data });
      } else {
        setState({ status: 'error', message: 'No valid payment data found on tag' });
      }
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'NFC scan failed',
      });
    }
  }, [isSupported]);

  const writeTag = useCallback(
    async (recipientAddress: string, amount: number, label?: string) => {
      if (!isSupported) return;

      setState({ status: 'writing' });
      try {
        await writePaymentTag(recipientAddress, amount, label);
        setState({ status: 'written' });
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'NFC write failed',
        });
      }
    },
    [isSupported]
  );

  const reset = useCallback(() => {
    setState(isSupported ? { status: 'ready' } : { status: 'unsupported' });
  }, [isSupported]);

  return { state, isSupported, startScan, writeTag, reset };
}
