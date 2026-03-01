import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from '@solana/spl-token';
import { SKR_MINT, SKR_DECIMALS } from '../utils/constants';
import { getSkrTier } from './skr';

export async function buildSkrCashbackTx(
  connection: Connection,
  treasury: PublicKey,
  recipient: PublicKey,
  skrAmount: number,
  skrMint: PublicKey,
): Promise<Transaction> {
  const treasuryAta = getAssociatedTokenAddressSync(skrMint, treasury);
  const recipientAta = getAssociatedTokenAddressSync(skrMint, recipient);
  const rawAmount = BigInt(Math.round(skrAmount * 10 ** SKR_DECIMALS));

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction({ feePayer: treasury, blockhash, lastValidBlockHeight });

  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      treasury,
      recipientAta,
      recipient,
      skrMint,
    ),
  );

  tx.add(
    createTransferCheckedInstruction(
      treasuryAta,
      skrMint,
      recipientAta,
      treasury,
      rawAmount,
      SKR_DECIMALS,
    ),
  );

  return tx;
}

export async function distributeCashback(
  connection: Connection,
  treasuryKeypair: Keypair,
  recipient: PublicKey,
  paymentAmount: number,
  skrBalance: number,
): Promise<string | null> {
  try {
    const { cashbackPct } = getSkrTier(skrBalance);
    const cashbackAmount = paymentAmount * cashbackPct;
    if (cashbackAmount <= 0) return null;

    const skrMint = new PublicKey(SKR_MINT);

    // Check treasury balance before attempting distribution
    const treasuryAta = getAssociatedTokenAddressSync(skrMint, treasuryKeypair.publicKey);
    const balance = await connection.getTokenAccountBalance(treasuryAta);
    const treasuryBalance = Number(balance.value.uiAmount ?? 0);
    if (treasuryBalance < cashbackAmount) {
      console.warn('[SKR] Treasury balance too low:', treasuryBalance, 'needed:', cashbackAmount);
      return null;
    }

    const tx = await buildSkrCashbackTx(
      connection,
      treasuryKeypair.publicKey,
      recipient,
      cashbackAmount,
      skrMint,
    );

    tx.sign(treasuryKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    console.log('[SKR] Cashback distributed:', signature, 'amount:', cashbackAmount);
    return signature;
  } catch (e) {
    console.warn('[SKR] Cashback distribution failed:', e);
    return null;
  }
}
