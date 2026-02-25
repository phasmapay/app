import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { USDC_MINT, APP_IDENTITY } from '../utils/constants';

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

export async function initNfc(): Promise<boolean> {
  try {
    await NfcManager.start();
    const isSupported = await NfcManager.isSupported();
    const isEnabled = await NfcManager.isEnabled();
    return isSupported && isEnabled;
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
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

export async function readPaymentTag(): Promise<NfcPaymentData | null> {
  await NfcManager.requestTechnology(NfcTech.Ndef);
  try {
    const tag = await NfcManager.getTag();
    const record = tag?.ndefMessage?.[0];
    if (!record) return null;

    // URI records: first byte is URI prefix code, rest is the URI
    const payload = new Uint8Array(record.payload);
    // Skip the URI prefix byte (index 0)
    const uriString = String.fromCharCode(...payload.slice(1));
    return parseSolanaPayUrl(uriString);
  } finally {
    await NfcManager.cancelTechnologyRequest();
  }
}

export async function cleanupNfc(): Promise<void> {
  await NfcManager.cancelTechnologyRequest().catch(() => {});
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
