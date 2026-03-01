import AsyncStorage from '@react-native-async-storage/async-storage';

export type MerchantTransaction = {
  signature: string;
  sender: string;
  amount: number;
  timestamp: number;
  reference?: string;
  confirmed: boolean;
};

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
  MERCHANT_TRANSACTIONS: 'phasma:merchant_transactions',
  MERCHANT_CONFIG: 'phasma:merchant_config',
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

export async function saveMerchantTransaction(tx: MerchantTransaction): Promise<void> {
  const existing = await getMerchantTransactionsRaw();
  const updated = [tx, ...existing].slice(0, 200);
  await AsyncStorage.setItem(KEYS.MERCHANT_TRANSACTIONS, JSON.stringify(updated));
}

async function getMerchantTransactionsRaw(): Promise<MerchantTransaction[]> {
  const raw = await AsyncStorage.getItem(KEYS.MERCHANT_TRANSACTIONS);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MerchantTransaction[];
  } catch {
    return [];
  }
}

export async function getMerchantTransactions(
  page = 0,
  pageSize = 50,
): Promise<{ transactions: MerchantTransaction[]; hasMore: boolean }> {
  const all = await getMerchantTransactionsRaw();
  const start = page * pageSize;
  const slice = all.slice(start, start + pageSize);
  return { transactions: slice, hasMore: start + pageSize < all.length };
}

export async function getMerchantDaySummary(): Promise<{ count: number; total: number }> {
  const all = await getMerchantTransactionsRaw();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const todayTxs = all.filter(t => t.timestamp >= todayMs);
  return {
    count: todayTxs.length,
    total: todayTxs.reduce((sum, t) => sum + t.amount, 0),
  };
}

export async function saveMerchantConfig(config: { enabled: boolean; businessName: string }): Promise<void> {
  await AsyncStorage.setItem(KEYS.MERCHANT_CONFIG, JSON.stringify(config));
}

export async function loadMerchantConfig(): Promise<{ enabled: boolean; businessName: string }> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.MERCHANT_CONFIG);
    if (!raw) return { enabled: false, businessName: '' };
    return JSON.parse(raw);
  } catch {
    return { enabled: false, businessName: '' };
  }
}
