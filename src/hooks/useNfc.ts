import { useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { initNfc, checkNfcEnabled, readPaymentTag, writePaymentTag, cleanupNfc, buildSolanaPayUrl, NfcPaymentData } from '../services/nfc';
import { startHce, stopHce } from '../services/hce';

export type NfcState =
  | { status: 'idle' }
  | { status: 'initializing' }
  | { status: 'ready' }
  | { status: 'scanning' }
  | { status: 'writing' }
  | { status: 'success'; data: NfcPaymentData }
  | { status: 'written' }
  | { status: 'emulating' }
  | { status: 'error'; message: string }
  | { status: 'disabled' }
  | { status: 'unsupported' };

export function useNfc() {
  const [state, setState] = useState<NfcState>({ status: 'idle' });
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setState({ status: 'initializing' });
    initNfc().then((result) => {
      const supported = result !== 'unsupported';
      setIsSupported(supported);
      if (result === 'ready') setState({ status: 'ready' });
      else if (result === 'disabled') setState({ status: 'disabled' });
      else setState({ status: 'unsupported' });
    });

    // Re-check NFC when app comes back from settings
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkNfcEnabled().then((enabled) => {
          if (enabled) {
            setIsSupported(true);
            setState((prev) =>
              prev.status === 'disabled' || prev.status === 'unsupported'
                ? { status: 'ready' }
                : prev
            );
          }
        });
      }
    });

    return () => {
      sub.remove();
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

  const startEmulation = useCallback(
    async (recipientAddress: string, amount: number, label?: string) => {
      const url = buildSolanaPayUrl(recipientAddress, amount, label);
      try {
        await startHce(url);
        setState({ status: 'emulating' });
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'HCE failed',
        });
      }
    },
    []
  );

  const stopEmulation = useCallback(async () => {
    await stopHce();
    setState(isSupported ? { status: 'ready' } : { status: 'disabled' });
  }, [isSupported]);

  const reset = useCallback(() => {
    stopHce().catch(() => {});
    setState(isSupported ? { status: 'ready' } : { status: 'disabled' });
  }, [isSupported]);

  return { state, isSupported, startScan, writeTag, startEmulation, stopEmulation, reset };
}
