import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredTransaction = {
  signature: string;
  sender: string;
  recipient: string;
  amount: number;
  timestamp: number;
  savedGas: number;
  cashback: number;
  strategy: 'direct' | 'swap' | 'received';
  type?: 'sent' | 'received';
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

export async function clearTransactions(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.TRANSACTIONS),
    AsyncStorage.removeItem(KEYS.TOTAL_CASHBACK),
    AsyncStorage.removeItem(KEYS.TOTAL_SAVED_GAS),
  ]);
}

// --- Merchant Mode Storage ---

const MERCHANT_TX_KEY = 'phasma:merchant_transactions';
const MERCHANT_CONFIG_KEY = 'phasma:merchant_config';

export type MerchantTransaction = {
  signature: string;
  sender: string;
  amount: number;
  timestamp: number;
  reference?: string;
  confirmed: boolean;
};

export async function saveMerchantTransaction(tx: MerchantTransaction): Promise<void> {
  const existing = await getMerchantTransactions();
  const updated = [tx, ...existing.transactions].slice(0, 200);
  await AsyncStorage.setItem(MERCHANT_TX_KEY, JSON.stringify(updated));
}

export async function getMerchantTransactions(
  page = 0,
  pageSize = 20
): Promise<{ transactions: MerchantTransaction[]; hasMore: boolean }> {
  const raw = await AsyncStorage.getItem(MERCHANT_TX_KEY);
  if (!raw) return { transactions: [], hasMore: false };
  try {
    const all: MerchantTransaction[] = JSON.parse(raw);
    const start = page * pageSize;
    const transactions = all.slice(start, start + pageSize);
    return { transactions, hasMore: start + pageSize < all.length };
  } catch {
    return { transactions: [], hasMore: false };
  }
}

export async function getMerchantDaySummary(): Promise<{ count: number; total: number }> {
  const raw = await AsyncStorage.getItem(MERCHANT_TX_KEY);
  if (!raw) return { count: 0, total: 0 };
  try {
    const all: MerchantTransaction[] = JSON.parse(raw);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const todayTxs = all.filter(t => t.timestamp >= todayMs);
    return {
      count: todayTxs.length,
      total: todayTxs.reduce((sum, t) => sum + t.amount, 0),
    };
  } catch {
    return { count: 0, total: 0 };
  }
}

export async function saveMerchantConfig(config: { enabled: boolean; businessName: string }): Promise<void> {
  await AsyncStorage.setItem(MERCHANT_CONFIG_KEY, JSON.stringify(config));
}

export async function loadMerchantConfig(): Promise<{ enabled: boolean; businessName: string }> {
  try {
    const raw = await AsyncStorage.getItem(MERCHANT_CONFIG_KEY);
    if (!raw) return { enabled: false, businessName: '' };
    return JSON.parse(raw);
  } catch {
    return { enabled: false, businessName: '' };
  }
}
