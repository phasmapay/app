import {
  Connection,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  VersionedTransaction,
  TransactionMessage,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { APP_IDENTITY, USDC_DECIMALS } from '../utils/constants';
import { usdcToRaw } from '../utils/solana';

export type PaymentResult = {
  signature: string;
  sender: string;
  recipient: string;
  amount: number;
  timestamp: number;
};

export async function buildUsdcTransferTx(
  connection: Connection,
  sender: PublicKey,
  recipient: PublicKey,
  usdcAmount: number,
  usdcMint: PublicKey
): Promise<Transaction> {
  const senderAta = getAssociatedTokenAddressSync(usdcMint, sender);
  const recipientAta = getAssociatedTokenAddressSync(usdcMint, recipient);
  const rawAmount = usdcToRaw(usdcAmount);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');

  const tx = new Transaction({
    feePayer: sender,
    blockhash,
    lastValidBlockHeight,
  });

  // Optimized compute budget
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));

  // Idempotent ATA creation — safe whether ATA exists or not
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      sender,
      recipientAta,
      recipient,
      usdcMint
    )
  );

  // Transfer with decimal verification
  tx.add(
    createTransferCheckedInstruction(
      senderAta,
      usdcMint,
      recipientAta,
      sender,
      rawAmount,
      USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  return tx;
}

export async function executePayment(
  connection: Connection,
  recipientAddress: string,
  amount: number,
  usdcMint: PublicKey,
  authToken: string
): Promise<PaymentResult> {
  return await transact(async (wallet) => {
    const auth = await wallet.reauthorize({
      auth_token: authToken,
      identity: APP_IDENTITY,
    });

    const senderPubkey = new PublicKey(auth.accounts[0].address);
    const recipientPubkey = new PublicKey(recipientAddress);

    const tx = await buildUsdcTransferTx(
      connection,
      senderPubkey,
      recipientPubkey,
      amount,
      usdcMint
    );

    const [signature] = await wallet.signAndSendTransactions({
      transactions: [tx],
    });

    return {
      signature,
      sender: senderPubkey.toBase58(),
      recipient: recipientAddress,
      amount,
      timestamp: Date.now(),
    };
  });
}

export async function getUsdcBalance(
  connection: Connection,
  wallet: PublicKey,
  usdcMint: PublicKey
): Promise<number> {
  try {
    const ata = getAssociatedTokenAddressSync(usdcMint, wallet);
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 10 ** USDC_DECIMALS;
  } catch {
    return 0;
  }
}

export async function getSolBalance(
  connection: Connection,
  wallet: PublicKey
): Promise<number> {
  const lamports = await connection.getBalance(wallet);
  return lamports / 1_000_000_000;
}

export async function confirmTransaction(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<boolean> {
  try {
    const result = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );
    return !result.value.err;
  } catch {
    return false;
  }
}
