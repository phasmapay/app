import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { USDC_MINT, APP_IDENTITY } from '../utils/constants';

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    ),
  ]);
}

export type NfcPaymentData = {
  recipient: string;
  amount: number;
  label: string;
  splToken: string;
};

export function buildSolanaPayUrl(
  recipientAddress: string,
  usdcAmount: number,
  label: string = APP_IDENTITY.name
): string {
  const params = new URLSearchParams({
    amount: usdcAmount.toString(),
    'spl-token': USDC_MINT,
    label,
    message: 'PhasmaPay NFC Payment',
  });
  return `solana:${recipientAddress}?${params.toString()}`;
}

export function parseSolanaPayUrl(url: string): NfcPaymentData | null {
  try {
    // Handle solana: scheme
    const withoutScheme = url.replace(/^solana:/, '');
    const [recipient, queryString] = withoutScheme.split('?');
    if (!recipient) return null;

    const params = new URLSearchParams(queryString ?? '');
    return {
      recipient,
      amount: parseFloat(params.get('amount') ?? '0'),
      label: params.get('label') ?? 'Unknown',
      splToken: params.get('spl-token') ?? USDC_MINT,
    };
  } catch {
    return null;
  }
}

let nfcStarted = false;

export async function initNfc(): Promise<'ready' | 'disabled' | 'unsupported'> {
  try {
    const isSupported = await NfcManager.isSupported();
    if (!isSupported) return 'unsupported';
    if (!nfcStarted) {
      await NfcManager.start();
      nfcStarted = true;
    }
    const isEnabled = await NfcManager.isEnabled();
    return isEnabled ? 'ready' : 'disabled';
  } catch {
    return 'unsupported';
  }
}

export async function checkNfcEnabled(): Promise<boolean> {
  try {
    return await NfcManager.isEnabled();
  } catch {
    return false;
  }
}

export async function writePaymentTag(
  recipientAddress: string,
  usdcAmount: number,
  label: string = APP_IDENTITY.name
): Promise<void> {
  const url = buildSolanaPayUrl(recipientAddress, usdcAmount, label);
  // Cancel any stale request before starting a new one
  await NfcManager.cancelTechnologyRequest().catch(() => {});
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } catch (err) {
    console.warn('[NFC] writePaymentTag failed:', err);
    throw err;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

export async function readPaymentTag(): Promise<NfcPaymentData | null> {
  await NfcManager.cancelTechnologyRequest().catch(() => {});
  await withTimeout(
    NfcManager.requestTechnology(NfcTech.Ndef),
    30_000,
    'NFC scan timed out — hold tag closer'
  );
  try {
    const tag = await NfcManager.getTag();
    const record = tag?.ndefMessage?.[0];
    if (!record) return null;

    // URI records: first byte is URI prefix code, rest is the URI
    const payload = record.payload;
    let uriString: string;
    if (typeof payload === 'string') {
      // Some Android versions return string directly
      uriString = payload.startsWith('\x00') ? payload.slice(1) : payload;
    } else {
      const bytes = new Uint8Array(payload);
      // Index 0 is the URI prefix identifier byte — skip it
      const uriBytes = bytes.slice(1);
      try {
        uriString = new TextDecoder('utf-8').decode(uriBytes);
      } catch {
        uriString = String.fromCharCode(...uriBytes);
      }
    }
    console.log('[NFC] decoded URI:', uriString);
    const parsed = parseSolanaPayUrl(uriString);
    if (!parsed) {
      console.warn('[NFC] parseSolanaPayUrl returned null for:', uriString);
    }
    return parsed;
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

export async function cleanupNfc(): Promise<void> {
  await NfcManager.cancelTechnologyRequest().catch(() => {});
}

/**
 * Claim exclusive NFC foreground dispatch — suppresses the system app chooser
 * (ShopeePay, OVO, etc.) while PhasmaPay is in foreground.
 * Call this when entering Receive/Ghost Receive screens.
 */
export async function enableForegroundNfc(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    // registerTagEvent claims foreground dispatch — Android routes all NFC to our app
    await NfcManager.registerTagEvent();
  } catch (e) {
    console.warn('[NFC] enableForegroundNfc failed:', e);
  }
}

/**
 * Release foreground dispatch. Call when leaving Receive screens.
 */
export async function disableForegroundNfc(): Promise<void> {
  try {
    await NfcManager.unregisterTagEvent();
  } catch (e) {
    console.warn('[NFC] disableForegroundNfc failed:', e);
  }
}

// Mock for dev/emulator testing
export function mockNfcRead(recipientAddress: string, amount: number): NfcPaymentData {
  return {
    recipient: recipientAddress,
    amount,
    label: 'Mock Merchant',
    splToken: USDC_MINT,
  };
}
