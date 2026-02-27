import { Connection } from '@solana/web3.js';
import { RPC_URL } from './constants';

const FALLBACK_RPC_URL = 'https://api.devnet.solana.com';

let _connection: Connection | null = null;
let _connectionUrl: string | null = null;

export function getConnection(): Connection {
  // Recreate if URL changed (e.g. env var updated between builds)
  if (!_connection || _connectionUrl !== RPC_URL) {
    _connection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    _connectionUrl = RPC_URL;
  }
  return _connection;
}

export function resetConnection(): void {
  _connection = null;
  _connectionUrl = null;
}

export function getConnectionWithFallback(): Connection {
  try {
    return getConnection();
  } catch {
    resetConnection();
    return new Connection(FALLBACK_RPC_URL, 'confirmed');
  }
}

export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

export function usdcToRaw(usdc: number): bigint {
  return BigInt(Math.round(usdc * 1_000_000));
}

export function rawToUsdc(raw: number | bigint): number {
  return Number(raw) / 1_000_000;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function explorerUrl(signature: string, network: 'devnet' | 'mainnet-beta' = 'devnet'): string {
  const base = network === 'devnet' ? 'https://solscan.io/tx' : 'https://solscan.io/tx';
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/${signature}${cluster}`;
}
