/**
 * PhasmaPay Solana Actions API
 * Implements the Solana Actions spec: https://solana.com/developers/guides/advanced/actions
 * Serves Blink-compatible payment requests for OrbitFlare integration.
 *
 * Run: npx ts-node api/server.ts
 *
 * Environment variables:
 *   RPC_URL           - Solana RPC (OrbitFlare or any provider). Defaults to devnet.
 *   PORT              - Listen port. Default 3002.
 *   NETWORK           - "devnet" or "mainnet-beta". Default "devnet".
 *   ACTION_BASE_URL   - Public URL for action hrefs. Default http://localhost:3002.
 */

import express from 'express';
import cors from 'cors';

const NETWORK = process.env.NETWORK ?? 'devnet';
const RPC_URL = process.env.RPC_URL ?? (
  NETWORK === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com'
);
const ACTION_BASE_URL = process.env.ACTION_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3002}`;
const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDC_MINT = NETWORK === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
const USDC_DECIMALS = 6;

// Solana Actions blockchain IDs
const BLOCKCHAIN_IDS: Record<string, string> = {
  'devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  'mainnet-beta': 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
};

const app = express();

// Solana Actions spec requires permissive CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Content-Encoding', 'Accept-Encoding'],
}));
app.use(express.json());

// Required Solana Actions headers on every response
app.use((_req, res, next) => {
  res.setHeader('X-Action-Version', '2.1.3');
  res.setHeader('X-Blockchain-Ids', BLOCKCHAIN_IDS[NETWORK] ?? BLOCKCHAIN_IDS['devnet']);
  next();
});

// ============================================================
// GET /actions.json — Action routing rules (required by spec)
// ============================================================
app.get('/actions.json', (_req, res) => {
  res.json({
    rules: [
      {
        pathPattern: '/api/actions/pay',
        apiPath: '/api/actions/pay',
      },
      {
        pathPattern: '/api/actions/pay/**',
        apiPath: '/api/actions/pay/**',
      },
    ],
  });
});

// ============================================================
// GET /api/actions/pay — Payment action metadata with input form
// ============================================================
app.get('/api/actions/pay', (_req, res) => {
  res.json({
    type: 'action',
    icon: `${ACTION_BASE_URL}/icon.png`,
    title: 'PhasmaPay',
    description: 'Send USDC via PhasmaPay — NFC tap-to-pay on Solana. Enter a recipient address and amount.',
    label: 'Pay',
    links: {
      actions: [
        // Quick amounts
        {
          label: 'Pay $1',
          href: `${ACTION_BASE_URL}/api/actions/pay/{recipient}?amount=1`,
          parameters: [
            { name: 'recipient', label: 'Recipient address', required: true, type: 'text' },
          ],
        },
        {
          label: 'Pay $5',
          href: `${ACTION_BASE_URL}/api/actions/pay/{recipient}?amount=5`,
          parameters: [
            { name: 'recipient', label: 'Recipient address', required: true, type: 'text' },
          ],
        },
        {
          label: 'Pay $10',
          href: `${ACTION_BASE_URL}/api/actions/pay/{recipient}?amount=10`,
          parameters: [
            { name: 'recipient', label: 'Recipient address', required: true, type: 'text' },
          ],
        },
        // Custom amount
        {
          label: 'Pay Custom',
          href: `${ACTION_BASE_URL}/api/actions/pay/{recipient}?amount={amount}`,
          parameters: [
            { name: 'recipient', label: 'Recipient address', required: true, type: 'text' },
            { name: 'amount', label: 'USDC amount', required: true, type: 'number' },
          ],
        },
      ],
    },
  });
});

// ============================================================
// GET /api/actions/pay/:address — Pre-filled recipient
// ============================================================
app.get('/api/actions/pay/:address', (req, res) => {
  const { address } = req.params;
  const amount = req.query.amount ? parseFloat(req.query.amount as string) : undefined;

  if (amount && amount > 0) {
    // Both address and amount known — show simple confirm button
    res.json({
      type: 'action',
      icon: `${ACTION_BASE_URL}/icon.png`,
      title: 'PhasmaPay',
      description: `Send $${amount.toFixed(2)} USDC to ${address.slice(0, 8)}...${address.slice(-4)}`,
      label: `Pay $${amount.toFixed(2)}`,
      links: {
        actions: [
          {
            label: `Pay $${amount.toFixed(2)} USDC`,
            href: `${ACTION_BASE_URL}/api/actions/pay/${address}?amount=${amount}`,
          },
        ],
      },
    });
  } else {
    // Address known, need amount
    res.json({
      type: 'action',
      icon: `${ACTION_BASE_URL}/icon.png`,
      title: 'PhasmaPay',
      description: `Send USDC to ${address.slice(0, 8)}...${address.slice(-4)}`,
      label: 'Pay',
      links: {
        actions: [
          { label: 'Pay $1', href: `${ACTION_BASE_URL}/api/actions/pay/${address}?amount=1` },
          { label: 'Pay $5', href: `${ACTION_BASE_URL}/api/actions/pay/${address}?amount=5` },
          { label: 'Pay $10', href: `${ACTION_BASE_URL}/api/actions/pay/${address}?amount=10` },
          {
            label: 'Custom Amount',
            href: `${ACTION_BASE_URL}/api/actions/pay/${address}?amount={amount}`,
            parameters: [
              { name: 'amount', label: 'USDC amount', required: true, type: 'number' },
            ],
          },
        ],
      },
    });
  }
});

// ============================================================
// POST /api/actions/pay/:address — Build unsigned USDC transfer tx
// ============================================================
app.post('/api/actions/pay/:address', async (req, res) => {
  const { address } = req.params;
  const amount = parseFloat(req.query.amount as string);
  const { account } = req.body; // sender's public key from wallet

  if (!account) {
    return res.status(400).json({ message: 'Missing "account" in request body' });
  }
  if (!address) {
    return res.status(400).json({ message: 'Missing recipient address' });
  }
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  try {
    const {
      Connection, PublicKey, Transaction, ComputeBudgetProgram,
    } = await import('@solana/web3.js');
    const {
      getAssociatedTokenAddressSync,
      createAssociatedTokenAccountIdempotentInstruction,
      createTransferCheckedInstruction,
      TOKEN_PROGRAM_ID,
    } = await import('@solana/spl-token');

    const connection = new Connection(RPC_URL, 'confirmed');
    const sender = new PublicKey(account);
    const recipient = new PublicKey(address);
    const usdcMint = new PublicKey(USDC_MINT);
    const rawAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));

    const senderAta = getAssociatedTokenAddressSync(usdcMint, sender);
    const recipientAta = getAssociatedTokenAddressSync(usdcMint, recipient);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction({ feePayer: sender, blockhash, lastValidBlockHeight });

    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 40_000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));

    tx.add(createAssociatedTokenAccountIdempotentInstruction(
      sender, recipientAta, recipient, usdcMint
    ));

    tx.add(createTransferCheckedInstruction(
      senderAta, usdcMint, recipientAta, sender, rawAmount, USDC_DECIMALS, [], TOKEN_PROGRAM_ID
    ));

    const serialized = tx.serialize({ requireAllSignatures: false });
    const base64Tx = Buffer.from(serialized).toString('base64');

    res.json({
      transaction: base64Tx,
      message: `Paying $${amount.toFixed(2)} USDC via PhasmaPay`,
    });
  } catch (err: any) {
    console.error('[Actions] Build tx failed:', err);
    res.status(500).json({ message: err?.message ?? 'Failed to build transaction' });
  }
});

// ============================================================
// Health check
// ============================================================
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'PhasmaPay Solana Actions API',
    network: NETWORK,
    rpc: RPC_URL.slice(0, 40) + '...',
    usdcMint: USDC_MINT,
  });
});

// ============================================================
// Start
// ============================================================
const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => {
  console.log(`PhasmaPay Actions API on port ${PORT}`);
  console.log(`Network: ${NETWORK}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`USDC Mint: ${USDC_MINT}`);
  console.log(`\nTest locally:`);
  console.log(`  curl ${ACTION_BASE_URL}/api/actions/pay`);
  console.log(`\nBlink URL (once deployed):`);
  console.log(`  https://dial.to/?action=solana-action:${ACTION_BASE_URL}/api/actions/pay`);
});
