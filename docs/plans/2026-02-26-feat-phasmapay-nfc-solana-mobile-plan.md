# PhasmaPay — NFC Solana Mobile Plan

## Overview

NFC tap-to-pay for USDC/SOL on Solana Seeker. Expo bare workflow, Android-only.
Targets MONOLITH (Solana Mobile, March 9) + Graveyard Hack (Feb 27).

---

## Phase 1 — Core Scaffold

- [x] Expo bare workflow project structure
- [x] MWA wallet connection (Phantom + Seed Vault)
- [x] NFC read/write via react-native-nfc-manager
- [x] USDC transfer transaction builder (payment.ts)
- [x] Tab bar with SVG icons (react-native-svg)
- [x] Balance display (USDC + SOL)
- [x] SKR rewards card with tier logic

## Phase 2 — Payment Flow

- [x] NFC scan → parse Solana Pay URL → confirm screen → sign via MWA
- [x] Receipt screen with animated checkmark (react-native-reanimated)
- [x] Solana Actions / Blinks API endpoint (api/server.ts)
- [x] Torque SDK integration (trackPaymentWithTorque on every payment)
- [x] Storage persistence (AsyncStorage transaction history)
- [x] signer.ts: Seed Vault (in-process biometric) + MWA fallback

## Phase 3 — Jupiter Swaps + AI Gas Optimization

- [x] Jupiter swap integration (devnet v6 API)
  - `src/services/jupiter.ts`: `getSwapQuote`, `buildSwapTx`, `getSolToUsdcQuote`
  - Constants: `JUPITER_V6_QUOTE = https://quote-api.jup.ag/v6/quote`
  - Constants: `JUPITER_V6_SWAP = https://quote-api.jup.ag/v6/swap`
  - Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
  - `asLegacyTransaction: true` for MWA compatibility

- [x] AI agent logic: detect best payment route (direct USDC vs swap)
  - `src/services/agent.ts`: `optimizePayment(connection, sender, recipient, amount, usdcMint)`
  - Checks USDC balance first → direct transfer if sufficient
  - Falls back to SOL → USDC swap via Jupiter if USDC insufficient
  - Returns `strategy: 'direct' | 'swap' | 'insufficient'`
  - `savedGas` = `SWAP_OVERHEAD_USD (0.00037)` when direct path chosen

- [x] Gas savings calculation and display
  - `savedGas` in USD (e.g. `0.00037`) flows through: agent → usePayment state → pay.tsx confirm card → receipt params → receipt screen
  - `pay.tsx` awaiting_approval card shows "AI Savings" row when `savedGas > 0`
  - `receipt/[signature].tsx` shows "AI Gas Savings" row when `savedGas > 0`
  - Display: `savedGas.toFixed(5)` (correct — not `* 100`)

- [x] Swap + transfer in single flow via MWA
  - `usePayment.ts` `confirm()`: swap path deserializes Jupiter base64 tx → signs via `signTransaction` → `sendRawTransaction`
  - Handles Jupiter VersionedTransaction fallback when `asLegacyTransaction: true` still returns versioned format
  - Direct path: calls `executePayment` (existing MWA/SeedVault flow)

## Phase 4 — Polish + Demo

- [ ] NFC end-to-end test (Poco X3 write, Oppo Reno 14 read)
- [ ] Full payment flow test with real devnet USDC
- [ ] Demo video (2-3 min)
- [ ] Submission: Graveyard Hack (Feb 27) + MONOLITH (March 9)

---

## Key Constants

| Constant | Value |
|---|---|
| USDC_MINT (devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| SOL_MINT | `So11111111111111111111111111111111111111112` |
| JUPITER_V6_QUOTE | `https://quote-api.jup.ag/v6/quote` |
| JUPITER_V6_SWAP | `https://quote-api.jup.ag/v6/swap` |
| DIRECT_TRANSFER_FEE_USD | `0.00025` |
| SWAP_OVERHEAD_USD | `0.00037` |

## Notes

- `asLegacyTransaction: true` in Jupiter requests for MWA signing compatibility
- `savedGas` unit is USD (fractional — sub-cent). Display with `.toFixed(5)` not `* 100`
- `optimizePayment` always builds the tx during optimization (not on confirm) — keeps wallet session short
- Swap path uses `Transaction.from()` with `VersionedTransaction.deserialize()` fallback
