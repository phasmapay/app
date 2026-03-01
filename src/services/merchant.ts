import { Connection, PublicKey } from '@solana/web3.js';

export function pollForPaymentByReference(
  connection: Connection,
  referencePubkey: PublicKey,
  onReceived: (signature: string) => void,
  onTimeout: () => void,
  pollIntervalMs = 1500,
  timeoutMs = 180_000,
): () => void {
  let stopped = false;
  let intervalId: ReturnType<typeof setInterval>;
  let timeoutId: ReturnType<typeof setTimeout>;

  const cleanup = () => {
    stopped = true;
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  };

  timeoutId = setTimeout(() => {
    if (!stopped) {
      cleanup();
      onTimeout();
    }
  }, timeoutMs);

  const poll = async () => {
    if (stopped) return;
    try {
      const sigs = await connection.getSignaturesForAddress(referencePubkey, { limit: 5 }, 'confirmed');
      if (sigs.length > 0 && !stopped) {
        cleanup();
        onReceived(sigs[0].signature);
      }
    } catch {
      // Network error — keep polling
    }
  };

  // First poll immediately, then on interval
  poll();
  intervalId = setInterval(poll, pollIntervalMs);

  return cleanup;
}
