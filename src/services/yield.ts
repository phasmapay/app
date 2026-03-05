import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVaultBalance, getVaultConfig } from './vault';
import { buildSkrCashbackTx } from './skrStaking';
import { SKR_MINT, SKR_DECIMALS } from '../utils/constants';

const YIELD_STATE_KEY = 'phasma:yield_state';

// Mock APY: 7% annualized, compounded per-second
const MOCK_APY = 0.07;
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

export type YieldState = {
  lastSnapshotBalance: number;   // vault USDC at last snapshot
  lastSnapshotTime: number;      // unix ms
  accruedYield: number;          // accumulated USDC yield (not yet claimed)
  totalClaimed: number;          // lifetime claimed yield (in SKR value)
};

const DEFAULT_STATE: YieldState = {
  lastSnapshotBalance: 0,
  lastSnapshotTime: Date.now(),
  accruedYield: 0,
  totalClaimed: 0,
};

export async function getYieldState(): Promise<YieldState> {
  try {
    const raw = await AsyncStorage.getItem(YIELD_STATE_KEY);
    if (!raw) return { ...DEFAULT_STATE, lastSnapshotTime: Date.now() };
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_STATE, lastSnapshotTime: Date.now() };
  }
}

async function saveYieldState(state: YieldState): Promise<void> {
  await AsyncStorage.setItem(YIELD_STATE_KEY, JSON.stringify(state));
}

/**
 * Update yield accrual based on current vault balance and elapsed time.
 * Call this on vault screen load and after any vault balance change.
 *
 * Yield = balance × (APY / secondsPerYear) × elapsedSeconds
 *
 * For demo purposes we accelerate: 1 real minute = ~1 day of yield
 * so judges see numbers moving in real time.
 */
const DEMO_TIME_MULTIPLIER = 1440; // 1 min real = 1 day yield

export async function updateYieldAccrual(connection: Connection): Promise<YieldState> {
  const state = await getYieldState();
  const currentBalance = await getVaultBalance(connection);

  const now = Date.now();
  const elapsedMs = now - state.lastSnapshotTime;
  const elapsedSeconds = (elapsedMs / 1000) * DEMO_TIME_MULTIPLIER;

  // Calculate yield on the snapshot balance for the elapsed period
  if (state.lastSnapshotBalance > 0 && elapsedSeconds > 0) {
    const yieldAmount = state.lastSnapshotBalance * (MOCK_APY / SECONDS_PER_YEAR) * elapsedSeconds;
    state.accruedYield += yieldAmount;
  }

  // Update snapshot
  state.lastSnapshotBalance = currentBalance;
  state.lastSnapshotTime = now;

  await saveYieldState(state);
  return state;
}

/**
 * Claim accrued yield as SKR tokens from treasury.
 * Converts USDC yield value to SKR at 1:1 ratio for simplicity.
 */
export async function claimYield(
  connection: Connection,
  treasuryKeypair: Keypair,
  recipientWallet: PublicKey,
): Promise<{ signature: string; amount: number } | null> {
  const state = await getYieldState();
  if (state.accruedYield < 0.001) return null; // minimum claim threshold

  const claimAmount = state.accruedYield;
  const skrMint = new PublicKey(SKR_MINT);

  try {
    const tx = await buildSkrCashbackTx(
      connection,
      treasuryKeypair.publicKey,
      recipientWallet,
      claimAmount,
      skrMint,
    );
    tx.sign(treasuryKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize());

    // Reset accrued, track total claimed
    state.accruedYield = 0;
    state.totalClaimed += claimAmount;
    state.lastSnapshotTime = Date.now();
    await saveYieldState(state);

    console.log('[Yield] Claimed:', claimAmount, 'SKR, sig:', signature);
    return { signature, amount: claimAmount };
  } catch (e) {
    console.warn('[Yield] Claim failed:', e);
    return null;
  }
}

/**
 * Get projected annual yield based on current vault balance.
 */
export function getProjectedAnnualYield(vaultBalance: number): number {
  return vaultBalance * MOCK_APY;
}

/**
 * Reset yield state (for testing).
 */
export async function resetYieldState(): Promise<void> {
  await AsyncStorage.removeItem(YIELD_STATE_KEY);
}
