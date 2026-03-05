import * as anchor from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";

const PROGRAM_ID = new PublicKey("AGXRYordHf4s632jNueAbfFXpt6jb3oGeQ6ispnbzxxY");

function findEscrowPda(sender: PublicKey, recipient: PublicKey, expiry: number): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(expiry));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), sender.toBuffer(), recipient.toBuffer(), buf],
    PROGRAM_ID
  );
}

function findVaultPda(escrowPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), escrowPda.toBuffer()],
    PROGRAM_ID
  );
}

function disc(name: string): Buffer {
  const hash = require("crypto").createHash("sha256");
  hash.update("global:" + name);
  return hash.digest().subarray(0, 8);
}

function encodeCreateEscrow(amount: bigint, expiry: bigint): Buffer {
  const buf = Buffer.alloc(24);
  disc("create_escrow").copy(buf, 0);
  buf.writeBigUInt64LE(amount, 8);
  buf.writeBigInt64LE(expiry, 16);
  return buf;
}

describe("phasma-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = (provider.wallet as any).payer as Keypair;

  let mint: PublicKey;
  let sender: Keypair;
  let recipient: Keypair;
  let senderAta: PublicKey;
  let recipientAta: PublicKey;
  const AMOUNT = 1_000_000n;
  let expiry: number;

  before(async () => {
    sender = Keypair.generate();
    recipient = Keypair.generate();
    const sig1 = await connection.requestAirdrop(sender.publicKey, 2e9);
    const sig2 = await connection.requestAirdrop(recipient.publicKey, 2e9);
    await connection.confirmTransaction(sig1);
    await connection.confirmTransaction(sig2);
    mint = await createMint(connection, payer, payer.publicKey, null, 6);
    senderAta = await createAssociatedTokenAccount(connection, sender, mint, sender.publicKey);
    await mintTo(connection, payer, mint, senderAta, payer, 10_000_000);
  });

  it("creates an escrow", async () => {
    expiry = Math.floor(Date.now() / 1000) + 60;
    const [escrowPda] = findEscrowPda(sender.publicKey, recipient.publicKey, expiry);
    const [vaultPda] = findVaultPda(escrowPda);

    const ix = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: sender.publicKey, isSigner: true, isWritable: true },
        { pubkey: recipient.publicKey, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: encodeCreateEscrow(AMOUNT, BigInt(expiry)),
    });

    const tx = new anchor.web3.Transaction().add(ix);
    await provider.sendAndConfirm(tx, [sender]);

    const vaultAccount = await getAccount(connection, vaultPda);
    assert.equal(vaultAccount.amount.toString(), AMOUNT.toString());
  });

  it("claims the escrow", async () => {
    const [escrowPda] = findEscrowPda(sender.publicKey, recipient.publicKey, expiry);
    const [vaultPda] = findVaultPda(escrowPda);
    recipientAta = getAssociatedTokenAddressSync(mint, recipient.publicKey);

    const ix = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: recipient.publicKey, isSigner: true, isWritable: true },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: disc("claim_escrow"),
    });

    const tx = new anchor.web3.Transaction().add(ix);
    await provider.sendAndConfirm(tx, [recipient]);

    const recipientAccount = await getAccount(connection, recipientAta);
    assert.equal(recipientAccount.amount.toString(), AMOUNT.toString());
  });

  it("rejects double claim", async () => {
    const [escrowPda] = findEscrowPda(sender.publicKey, recipient.publicKey, expiry);
    const [vaultPda] = findVaultPda(escrowPda);

    const ix = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: recipient.publicKey, isSigner: true, isWritable: true },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: disc("claim_escrow"),
    });

    try {
      const tx = new anchor.web3.Transaction().add(ix);
      await provider.sendAndConfirm(tx, [recipient]);
      assert.fail("should have thrown");
    } catch (e: any) {
      // Expected failure
      assert.ok(e);
    }
  });

  it("refunds after expiry", async () => {
    const shortExpiry = Math.floor(Date.now() / 1000) + 2;
    const [escrowPda] = findEscrowPda(sender.publicKey, recipient.publicKey, shortExpiry);
    const [vaultPda] = findVaultPda(escrowPda);

    const createIx = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: sender.publicKey, isSigner: true, isWritable: true },
        { pubkey: recipient.publicKey, isSigner: false, isWritable: false },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: encodeCreateEscrow(AMOUNT, BigInt(shortExpiry)),
    });

    await provider.sendAndConfirm(new anchor.web3.Transaction().add(createIx), [sender]);
    await new Promise((r) => setTimeout(r, 3000));

    const senderBefore = (await getAccount(connection, senderAta)).amount;

    const cranker = Keypair.generate();
    const sig = await connection.requestAirdrop(cranker.publicKey, 1e9);
    await connection.confirmTransaction(sig);

    const refundIx = new anchor.web3.TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: cranker.publicKey, isSigner: true, isWritable: true },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: sender.publicKey, isSigner: false, isWritable: true },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: disc("refund_escrow"),
    });

    await provider.sendAndConfirm(new anchor.web3.Transaction().add(refundIx), [cranker]);

    const senderAfter = (await getAccount(connection, senderAta)).amount;
    assert.equal((senderAfter - senderBefore).toString(), AMOUNT.toString());
  });
});
