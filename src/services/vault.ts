import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { USDC_MINT, USDC_DECIMALS, SKR_VAULT_CEILINGS } from '../utils/constants';
import type { SkrTier } from './skr';

const VAULT_SOL_RESERVE = 0.01; // SOL kept in vault for tx fees + ATA rent

const VAULT_SK_KEY = 'phasma_vault_sk';
const VAULT_CONFIG_KEY = 'phasma:vault_config';

export type VaultConfig = {
  publicKey: string;       // base58
  dailyLimit: number;      // USDC (default 25)
  spentToday: number;
  lastResetDate: string;   // YYYY-MM-DD, auto-resets at midnight
  enabled: boolean;
};

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function initializeVault(): Promise<VaultConfig> {
  const keypair = Keypair.generate();
  await SecureStore.setItemAsync(VAULT_SK_KEY, JSON.stringify(Array.from(keypair.secretKey)));

  const config: VaultConfig = {
    publicKey: keypair.publicKey.toBase58(),
    dailyLimit: 25,
    spentToday: 0,
    lastResetDate: todayString(),
    enabled: true,
  };
  await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
  return config;
}

export async function getVaultConfig(): Promise<VaultConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(VAULT_CONFIG_KEY);
    if (!raw) return null;
    const config: VaultConfig = JSON.parse(raw);

    // Auto-reset daily spending if new day
    const today = todayString();
    if (config.lastResetDate !== today) {
      config.spentToday = 0;
      config.lastResetDate = today;
      await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
    }
    return config;
  } catch {
    return null;
  }
}

async function saveVaultConfig(config: VaultConfig): Promise<void> {
  await AsyncStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
}

export async function getVaultKeypair(): Promise<Keypair | null> {
  try {
    const raw = await SecureStore.getItemAsync(VAULT_SK_KEY);
    if (!raw) return null;
    const secretKey: number[] = JSON.parse(raw);
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  } catch {
    return null;
  }
}

export async function getVaultBalance(connection: Connection): Promise<number> {
  const config = await getVaultConfig();
  if (!config) return 0;
  try {
    const vaultPubkey = new PublicKey(config.publicKey);
    const ata = getAssociatedTokenAddressSync(new PublicKey(USDC_MINT), vaultPubkey);
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 10 ** USDC_DECIMALS;
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) return 0;
    return 0;
  }
}

export function canSpend(config: VaultConfig, amount: number): { allowed: boolean; remaining: number; reason?: string } {
  if (!config.enabled) {
    return { allowed: false, remaining: 0, reason: 'Vault is disabled' };
  }
  const remaining = config.dailyLimit - config.spentToday;
  if (amount > remaining) {
    return { allowed: false, remaining, reason: `Daily limit exceeded ($${remaining.toFixed(2)} remaining)` };
  }
  return { allowed: true, remaining };
}

export async function hasEnoughSolForFees(connection: Connection): Promise<boolean> {
  try {
    const config = await getVaultConfig();
    if (!config) return false;
    const lamports = await connection.getBalance(new PublicKey(config.publicKey));
    return lamports >= VAULT_SOL_RESERVE * LAMPORTS_PER_SOL;
  } catch {
    return false;
  }
}

export function getTierVaultCeiling(tier: SkrTier): number {
  return SKR_VAULT_CEILINGS[tier];
}

export async function setDailyLimitWithTier(limit: number, tier: SkrTier): Promise<{ set: number; capped: boolean; ceiling: number }> {
  const ceiling = getTierVaultCeiling(tier);
  const capped = limit > ceiling;
  const actual = capped ? ceiling : limit;
  await setDailyLimit(actual);
  return { set: actual, capped, ceiling };
}

export async function recordSpend(amount: number): Promise<void> {
  const config = await getVaultConfig();
  if (!config) return;
  config.spentToday += amount;
  await saveVaultConfig(config);
}

export async function setDailyLimit(limit: number): Promise<void> {
  const config = await getVaultConfig();
  if (!config) return;
  config.dailyLimit = limit;
  await saveVaultConfig(config);
}

export async function setVaultEnabled(enabled: boolean): Promise<void> {
  const config = await getVaultConfig();
  if (!config) return;
  config.enabled = enabled;
  await saveVaultConfig(config);
}

/**
 * Build a USDC + SOL transfer from main wallet → vault.
 * Also transfers VAULT_SOL_RESERVE SOL if vault has insufficient lamports for fees.
 * Returns the unsigned transaction — caller signs via MWA.
 */
export async function buildLoadVaultTx(
  connection: Connection,
  senderPubkey: PublicKey,
  amount: number,
): Promise<Transaction> {
  const config = await getVaultConfig();
  if (!config) throw new Error('Vault not initialized');

  const usdcMint = new PublicKey(USDC_MINT);
  const vaultPubkey = new PublicKey(config.publicKey);
  const senderAta = getAssociatedTokenAddressSync(usdcMint, senderPubkey);
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultPubkey);
  const rawAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));

  // Check if vault needs SOL for fees
  const vaultLamports = await connection.getBalance(vaultPubkey);
  const needsSol = vaultLamports < VAULT_SOL_RESERVE * LAMPORTS_PER_SOL;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: senderPubkey, blockhash, lastValidBlockHeight });

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 80_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));

  // Top up vault SOL for fees if needed
  if (needsSol) {
    const solNeeded = Math.ceil(VAULT_SOL_RESERVE * LAMPORTS_PER_SOL) - vaultLamports;
    tx.add(SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: vaultPubkey,
      lamports: solNeeded,
    }));
  }

  // Create vault ATA if needed
  tx.add(createAssociatedTokenAccountIdempotentInstruction(senderPubkey, vaultAta, vaultPubkey, usdcMint));

  // Transfer USDC
  tx.add(createTransferCheckedInstruction(senderAta, usdcMint, vaultAta, senderPubkey, rawAmount, USDC_DECIMALS));

  return tx;
}

/**
 * Build a USDC transfer from vault → recipient.
 * Signed locally with vault keypair — no MWA popup.
 */
export async function buildVaultPaymentTx(
  connection: Connection,
  recipientAddress: string,
  amount: number,
): Promise<{ tx: Transaction; keypair: Keypair }> {
  const keypair = await getVaultKeypair();
  if (!keypair) throw new Error('Vault keypair not found');

  const usdcMint = new PublicKey(USDC_MINT);
  const recipientPubkey = new PublicKey(recipientAddress);
  const vaultAta = getAssociatedTokenAddressSync(usdcMint, keypair.publicKey);
  const recipientAta = getAssociatedTokenAddressSync(usdcMint, recipientPubkey);
  const rawAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: keypair.publicKey, blockhash, lastValidBlockHeight });

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));

  // Create recipient ATA if needed
  tx.add(createAssociatedTokenAccountIdempotentInstruction(keypair.publicKey, recipientAta, recipientPubkey, usdcMint));

  // Transfer USDC
  tx.add(createTransferCheckedInstruction(vaultAta, usdcMint, recipientAta, keypair.publicKey, rawAmount, USDC_DECIMALS));

  return { tx, keypair };
}
