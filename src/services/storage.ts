import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredTransaction = {
  signature: string;
  sender: string;
  recipient: string;
  amount: number;
  timestamp: number;
  savedGas: number;
  cashback: number;
  strategy: 'direct' | 'swap';
};

const KEYS = {
  AUTH_TOKEN: 'phasma:auth_token',
  WALLET_ADDRESS: 'phasma:wallet_address',
  TRANSACTIONS: 'phasma:transactions',
  TOTAL_CASHBACK: 'phasma:total_cashback',
  TOTAL_SAVED_GAS: 'phasma:total_saved_gas',
} as const;

export async function saveAuthToken(token: string, address: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.AUTH_TOKEN, token),
    AsyncStorage.setItem(KEYS.WALLET_ADDRESS, address),
  ]);
}

export async function loadAuthToken(): Promise<{ token: string; address: string } | null> {
  const [token, address] = await Promise.all([
    AsyncStorage.getItem(KEYS.AUTH_TOKEN),
    AsyncStorage.getItem(KEYS.WALLET_ADDRESS),
  ]);
  if (!token || !address) return null;
  return { token, address };
}

export async function clearAuthToken(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.AUTH_TOKEN),
    AsyncStorage.removeItem(KEYS.WALLET_ADDRESS),
  ]);
}

export async function saveTransaction(tx: StoredTransaction): Promise<void> {
  const existing = await getTransactions();
  const updated = [tx, ...existing].slice(0, 100); // keep last 100
  await AsyncStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(updated));

  // Update totals
  const totalCashback = (await getTotalCashback()) + tx.cashback;
  const totalSavedGas = (await getTotalSavedGas()) + tx.savedGas;
  await Promise.all([
    AsyncStorage.setItem(KEYS.TOTAL_CASHBACK, totalCashback.toString()),
    AsyncStorage.setItem(KEYS.TOTAL_SAVED_GAS, totalSavedGas.toString()),
  ]);
}

export async function getTransactions(): Promise<StoredTransaction[]> {
  const raw = await AsyncStorage.getItem(KEYS.TRANSACTIONS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as StoredTransaction[];
  } catch {
    return [];
  }
}

export async function getTotalCashback(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.TOTAL_CASHBACK);
  return val ? parseFloat(val) : 0;
}

export async function getTotalSavedGas(): Promise<number> {
  const val = await AsyncStorage.getItem(KEYS.TOTAL_SAVED_GAS);
  return val ? parseFloat(val) : 0;
}
