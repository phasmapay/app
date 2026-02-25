import { Connection } from '@solana/web3.js';
import { RPC_URL } from './constants';

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, 'confirmed');
  }
  return _connection;
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
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}
