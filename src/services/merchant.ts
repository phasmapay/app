import { Connection, PublicKey } from '@solana/web3.js';

export type MerchantConfig = {
  enabled: boolean;
  businessName: string;
};

export function pollForPaymentByReference(
  connection: Connection,
  referencePubkey: PublicKey,
  onReceived: (signature: string) => void,
  onTimeout: () => void,
  pollIntervalMs = 1500,
  timeoutMs = 180_000,
): () => void {
  let cancelled = false;

  const timeoutId = setTimeout(() => {
    if (!cancelled) {
      cancelled = true;
      clearInterval(intervalId);
      onTimeout();
    }
  }, timeoutMs);

  const intervalId = setInterval(async () => {
    if (cancelled) return;
    try {
      const signatures = await connection.getSignaturesForAddress(referencePubkey, { limit: 1 });
      if (signatures.length > 0) {
        cancelled = true;
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        onReceived(signatures[0].signature);
      }
    } catch (e) {
      console.warn('[Merchant] polling error:', e);
    }
  }, pollIntervalMs);

  return () => {
    cancelled = true;
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  };
}
