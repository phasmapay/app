---
title: "feat: Ghost Pay / Ghost Receive — Stealth Address Private Payments"
type: feat
status: active
date: 2026-02-27
brainstorm: docs/brainstorms/2026-02-27-ghost-pay-privacy-brainstorm.md
---

# feat: Ghost Pay / Ghost Receive — Stealth Address Private Payments

## Overview

Add private payment mode to PhasmaPay using session-based ephemeral keypairs. Each Ghost Receive session generates a fresh `Keypair.generate()` written to the NFC tag. The customer pays USDC to the ephemeral address. The merchant claims the funds with a sweep tx to their real wallet. On Solscan, the transaction shows an unknown one-time address as recipient — the sender ↔ merchant link is broken on-chain.

**Privacy model:** Identity obfuscation via one-time addresses. Amount is visible on-chain. The claim tx links the ephemeral address to the merchant's real wallet — this is "one hop of indirection," not full ZK privacy. Market it as **Ghost Mode** (one-time address payments), not as ZK privacy.

---

## Scope

Two new screens:
- `app/ghost-pay.tsx` — customer side (NFC scan → pay to ephemeral addr)
- `app/ghost-receive.tsx` — merchant side (generate ephemeral keypair → write NFC → wait → claim)

Two new services:
- `src/services/ghostPayment.ts` — ephemeral keypair generation, sweep tx builder
- `src/hooks/useGhostReceive.ts` — state machine for the Ghost Receive flow

One new icon:
- `GhostIcon` in `src/components/Icons.tsx`

Home screen: add two new `ActionButton` entries (Ghost Pay + Ghost Receive).

---

## Technical Approach

### Ephemeral Keypair (the stealth address)

```typescript
// src/services/ghostPayment.ts
import 'react-native-get-random-values'; // MUST be imported in polyfills before @solana/web3.js
import { Keypair } from '@solana/web3.js';

export function generateEphemeralKeypair() {
  const kp = Keypair.generate();
  return {
    publicKey: kp.publicKey.toBase58(),
    secretKey: Array.from(kp.secretKey), // Uint8Array → number[] for storage
  };
}
```

**Key storage:** Expo SecureStore (`expo-secure-store`) keyed by session ID. This survives app backgrounding. Cleared after successful claim.

```typescript
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'ghost_session_key';

export async function saveSessionKey(secretKey: number[]) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(secretKey));
}

export async function loadSessionKey(): Promise<Keypair | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
}

export async function clearSessionKey() {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

### Solana Pay URL (reuses existing nfc.ts format)

The ephemeral pubkey is just the recipient address in a standard Solana Pay URL. Existing `buildSolanaPayUrl` and `parseSolanaPayUrl` from `src/services/nfc.ts` work unchanged — the payment format is identical, only the recipient is ephemeral.

```typescript
// Ghost Receive: merchant side
const { publicKey, secretKey } = generateEphemeralKeypair();
await saveSessionKey(secretKey);
const url = buildSolanaPayUrl(publicKey, amount, 'Ghost Pay'); // existing function
await writePaymentTag(url); // existing function
```

```typescript
// Ghost Pay: customer side — NFC read → parse → pay
// Uses existing readPaymentTag() + parseSolanaPayUrl() unchanged
// The customer's wallet sees a normal Solana Pay URL — no difference
```

### Sweep (Claim) Transaction

The sweep sends all USDC from the ephemeral address's ATA to the merchant's real wallet ATA. The merchant's wallet is the fee payer (ephemeral addr has no SOL).

```typescript
// src/services/ghostPayment.ts
import {
  Connection, Keypair, PublicKey, Transaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { USDC_MINT, USDC_DECIMALS } from '../utils/constants';

export async function buildSweepTx(
  connection: Connection,
  ephemeralKeypair: Keypair,   // session keypair — signs as authority
  merchantPubkey: PublicKey,   // real wallet — fee payer
): Promise<{ tx: Transaction; amount: bigint }> {
  const usdcMint = new PublicKey(USDC_MINT);
  const sourceATA = getAssociatedTokenAddressSync(usdcMint, ephemeralKeypair.publicKey);
  const destATA = getAssociatedTokenAddressSync(usdcMint, merchantPubkey);

  // Get current USDC balance at ephemeral address
  const sourceAccount = await getAccount(connection, sourceATA);
  const amount = sourceAccount.amount;
  if (amount === 0n) throw new Error('No USDC to claim');

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({ feePayer: merchantPubkey, blockhash, lastValidBlockHeight });

  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 60_000 }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));

  // Create merchant's USDC ATA if it doesn't exist (idempotent)
  tx.add(createAssociatedTokenAccountIdempotentInstruction(
    merchantPubkey,  // payer for ATA rent
    destATA,
    merchantPubkey,
    usdcMint,
  ));

  // Transfer all USDC from ephemeral → merchant
  tx.add(createTransferCheckedInstruction(
    sourceATA,
    usdcMint,
    destATA,
    ephemeralKeypair.publicKey,  // authority (owner of sourceATA)
    amount,
    USDC_DECIMALS,
  ));

  return { tx, amount };
}
```

**Signing the sweep:** The sweep tx has TWO signers — merchant wallet (fee payer, via MWA) AND ephemeral keypair (authority over source ATA). MWA only signs for the merchant's pubkey. The ephemeral keypair signs locally using `tx.partialSign(ephemeralKeypair)` before handing to MWA.

```typescript
// Partial sign with ephemeral (local, no wallet app)
tx.partialSign(ephemeralKeypair);
// Then sign with merchant wallet via MWA (for fee payer signature)
const signedTx = await signTransaction(tx); // existing signer.ts
```

### Payment Detection (Polling)

Merchant side polls for USDC arriving at the ephemeral ATA every 3 seconds. Timeout after 3 minutes.

```typescript
// src/hooks/useGhostReceive.ts
export function pollForPayment(
  connection: Connection,
  ephemeralPubkey: string,
  expectedAmount: number, // USDC float
  onReceived: (rawAmount: bigint) => void,
  onTimeout: () => void,
): () => void {
  const owner = new PublicKey(ephemeralPubkey);
  const usdcMint = new PublicKey(USDC_MINT);
  const ata = getAssociatedTokenAddressSync(usdcMint, owner);
  const expectedRaw = BigInt(Math.round(expectedAmount * 10 ** USDC_DECIMALS));
  const timeoutId = setTimeout(onTimeout, 3 * 60 * 1000);

  const intervalId = setInterval(async () => {
    try {
      const account = await getAccount(connection, ata);
      if (account.amount >= expectedRaw) {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        onReceived(account.amount);
      }
    } catch (e) {
      if (!(e instanceof TokenAccountNotFoundError)) {
        console.error('Poll error:', e);
      }
      // TokenAccountNotFoundError = no payment yet, keep polling
    }
  }, 3000);

  return () => { clearInterval(intervalId); clearTimeout(timeoutId); };
}
```

### ATA Rent (Who Pays?)

When the customer sends USDC to the ephemeral address for the first time, the ATA does not yet exist. MWA wallets (Phantom, Backpack) automatically create the ATA and pay rent (~0.002 SOL) as part of the Solana Pay flow — this is standard behavior. No extra step needed.

---

## Files to Create / Modify

### New Files

| File | Purpose |
|---|---|
| `app/ghost-pay.tsx` | Ghost Pay screen — NFC scan → pay to ephemeral addr |
| `app/ghost-receive.tsx` | Ghost Receive screen — generate keypair → NFC write → poll → claim |
| `src/services/ghostPayment.ts` | Ephemeral keypair gen, sweep tx builder, polling |
| `src/hooks/useGhostReceive.ts` | State machine: `idle → generating → writing → polling → received → claiming → done` |

### Modified Files

| File | Change |
|---|---|
| `app/_layout.tsx` | Register `ghost-pay` and `ghost-receive` as modal Stack.Screen entries |
| `app/(tabs)/index.tsx` | Add Ghost Pay + Ghost Receive ActionButtons to home screen |
| `src/components/Icons.tsx` | Add `GhostIcon` SVG component |
| `src/utils/constants.ts` | No changes needed — USDC_MINT, RPC_URL, USDC_DECIMALS already exported |

---

## Acceptance Criteria

### Ghost Pay (Customer)
- [ ] "Ghost Pay" button on home screen navigates to `/ghost-pay`
- [ ] NFC scan reads merchant's ephemeral pubkey (same as regular Pay scan)
- [ ] Confirmation screen shows "👻 Ghost Mode" badge + truncated stealth address
- [ ] USDC transfer to ephemeral address signs via MWA and lands on devnet
- [ ] Receipt screen shows Solscan link — recipient is unknown one-time address (not merchant's real wallet)
- [ ] SKR cashback applies (same as normal pay)
- [ ] NFC disabled / unsupported states handled with Alert (same as pay.tsx)

### Ghost Receive (Merchant)
- [ ] "Ghost Receive" button on home screen navigates to `/ghost-receive`
- [ ] Amount input generates fresh `Keypair.generate()` on tap
- [ ] Ephemeral keypair persisted to SecureStore before NFC write
- [ ] NFC write succeeds — tag contains Solana Pay URL with ephemeral pubkey
- [ ] Polling detects USDC arrival within 30s on devnet
- [ ] "Claim" button appears on payment detection
- [ ] Sweep tx: partial signs with ephemeral keypair, then MWA signs for merchant wallet
- [ ] Sweep tx confirmed on devnet — USDC lands in merchant's real wallet
- [ ] SecureStore entry cleared after successful claim
- [ ] If claim fails: retry button shown, keypair still in SecureStore
- [ ] NFC write failure shows error + retry option

### Resilience
- [ ] If merchant backgrounds app mid-session: ephemeral keypair survives via SecureStore
- [ ] If merchant reopens Ghost Receive screen: detects existing session in SecureStore, offers resume or new session
- [ ] Timeout after 3 min of polling: show "Waiting for payment…" with manual retry

---

## Implementation Phases

### Phase 1 — Core Services (parallel-safe, no UI)
1. [x] `src/services/ghostPayment.ts` — `generateEphemeralKeypair`, `saveSessionKey`, `loadSessionKey`, `clearSessionKey`, `buildSweepTx`, `pollForPayment`
2. [x] `src/hooks/useGhostReceive.ts` — state machine hook
3. [x] `src/components/Icons.tsx` — add `GhostIcon`
4. Verify `react-native-get-random-values` is imported in entry point polyfills

**Note:** `expo-secure-store` was not in package.json. Using `AsyncStorage` from `@react-native-async-storage/async-storage` as the storage backend for session keys. Less secure than SecureStore but fully functional. To upgrade: `npx expo install expo-secure-store` and swap `AsyncStorage` calls in `ghostPayment.ts` for `SecureStore.setItemAsync` / `getItemAsync` / `deleteItemAsync`.

### Phase 2 — Ghost Receive Screen
1. [x] `app/ghost-receive.tsx` — amount input, keypair gen, NFC write, polling UI, claim button
2. [x] `app/_layout.tsx` — register `ghost-receive` modal

### Phase 3 — Ghost Pay Screen
1. [x] `app/ghost-pay.tsx` — clone pay.tsx, add Ghost badge to confirmation + receipt params
2. [x] `app/_layout.tsx` — register `ghost-pay` modal

### Phase 4 — Home Screen Integration
1. [x] `app/(tabs)/index.tsx` — add Ghost Pay + Ghost Receive ActionButtons

### Phase 5 — Test on Devnet
1. Fund test wallet with devnet USDC (faucet.circle.com)
2. Ghost Receive: write NFC tag → Ghost Pay: tap and pay → verify on Solscan
3. Claim sweep → verify merchant wallet received USDC

---

## Edge Cases & Decisions

| Edge Case | Decision |
|---|---|
| Multiple customers tap same tag | One ephemeral keypair per session — claim sweeps total balance. Merchant regenerates after claim. |
| Amount underpayment | Not enforced on-chain. Amount in Solana Pay URL pre-fills customer wallet. Accept as MVP limitation. |
| Claim tx fee payer | Merchant's real wallet (fee payer). Ephemeral partial-signs for authority. |
| Ephemeral ATA creation | Customer's MWA wallet creates it automatically as part of Solana Pay tx. |
| App killed mid-session | SecureStore preserves keypair. Resume UI on re-open if session key found. |
| NFC write failure | Error state with retry — same pattern as existing receive.tsx error handling. |
| Privacy marketing | Call it "one-time address payments" in UI copy. Do not claim ZK or full anonymity. |

---

## Key Gotchas (from Research)

1. **`react-native-get-random-values` must be first import** in polyfills before any `@solana/web3.js` — `Keypair.generate()` crashes without it on Hermes.
2. **Two signers on sweep tx:** `tx.partialSign(ephemeralKeypair)` locally, then MWA signs for fee payer. MWA will only add its own signature — do NOT pass ephemeral keypair to MWA.
3. **`createTransferCheckedInstruction` not `createTransferInstruction`** — the "Checked" variant validates mint + decimals, required by some wallets.
4. **`TokenAccountNotFoundError`** is expected during polling until first payment — catch it and continue.
5. **BigInt for USDC amounts** — `@solana/spl-token` 0.3+ returns `bigint` from `account.amount`. Use `BigInt(Math.round(amount * 1e6))` for comparisons.
6. **SecureStore is async** — await `saveSessionKey` before writing the NFC tag. If write happens before save, key loss risk on crash.

---

## References

- Brainstorm: `docs/brainstorms/2026-02-27-ghost-pay-privacy-brainstorm.md`
- Existing pay screen: `app/pay.tsx`
- Existing receive screen: `app/receive.tsx`
- NFC service: `src/services/nfc.ts`
- Payment service: `src/services/payment.ts`
- Signer service: `src/services/signer.ts`
- Home screen (ActionButton pattern): `app/(tabs)/index.tsx:17-47`
- Icons: `src/components/Icons.tsx`
- Constants: `src/utils/constants.ts`
- [Solana Mobile polyfill guide](https://docs.solanamobile.com/react-native/polyfill-guides/web3-js)
- [Solana Pay spec](https://docs.solanapay.com/spec)
