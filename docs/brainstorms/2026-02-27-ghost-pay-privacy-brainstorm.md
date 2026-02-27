# Ghost Pay / Ghost Receive — Privacy Layer Brainstorm

**Date:** 2026-02-27
**Feature:** Stealth address-based private payments for PhasmaPay
**Status:** Ready for planning

---

## What We're Building

Two new screens alongside existing Pay/Receive:

- **Ghost Pay** — customer pays via NFC but the on-chain tx goes to a one-time stealth address, breaking the sender ↔ recipient link
- **Ghost Receive** — merchant generates a fresh ephemeral keypair per session, writes it to NFC, customer pays to it, merchant claims funds to real wallet

Together they form a complete private payment pair: nobody watching the chain can link who paid whom.

---

## Why This Approach

**Stealth addresses** (session-based ephemeral keypairs) are the only viable option for React Native + Solana devnet today:

- **Light Protocol** — real SDK, devnet support, but NOT a privacy tool (ZK compression ≠ anonymity)
- **Elusiv** — dead since Jan 2025
- **Privacy Cash** — real ZK pool but uses Circom/snarkjs (WASM) which breaks in Metro bundler
- **`solana-stealth` npm** — unmaintained; implement the concept ourselves instead

No WASM, no custom on-chain program, no relayer server needed. Just Solana web3.js keypair derivation + standard USDC transfers.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Privacy mechanism | Session-based stealth keypairs | Only WASM-free, devnet-compatible option |
| Scope | Ghost Pay + Ghost Receive only | Full 4-combo matrix is over-engineered for hackathon |
| Mixed modes (ghost↔normal) | Not explicit in UI | Work naturally but no dedicated flows |
| Proof of privacy | Solscan link showing one-time addr | Judges can verify on-chain — demo-able |
| Claim mechanism | "Claim" button in Ghost Receive screen | Merchant sweeps ephemeral → real wallet after payment |
| Branding | "Ghost Mode" — consistent with existing Ghost tier (👻) | No new brand language needed |

---

## User Flows

### Ghost Pay (Customer)
1. Home screen: tap "Ghost Pay" button (alongside existing Pay)
2. Activates NFC scan — reads merchant's ephemeral pubkey from tag
3. App derives stealth route: pay to merchant's one-time address
4. Confirmation screen shows "👻 Ghost Mode" badge + stealth addr (truncated)
5. Sign + send via MWA — real USDC tx on devnet
6. Receipt: shows Solscan link where recipient = unknown one-time address

### Ghost Receive (Merchant)
1. Home screen: tap "Ghost Receive" (alongside existing Receive)
2. Enter amount → app generates fresh ephemeral keypair for this session
3. Writes ephemeral pubkey to NFC tag (same Solana Pay URL format)
4. Customer taps → pays to ephemeral addr
5. Merchant sees "Payment received!" alert
6. "Claim" button appears → signs sweep tx → funds move to real wallet
7. Claim tx visible on Solscan

---

## What Stays the Same

- NFC read/write mechanics — unchanged
- MWA signing flow — unchanged
- SKR cashback — apply to Ghost Pay too (same amount, same tier logic)
- Torque tracking — fire-and-forget same as normal pay
- Receipt screen — reuse, add Ghost badge

---

## Technical Notes

- Ephemeral keypair: `Keypair.generate()` — fresh per Ghost Receive session
- Stealth addr is just the ephemeral pubkey — merchant controls its private key
- Claim sweep: build + sign standard USDC transfer from ephemeral → real wallet
- Ephemeral keypair stored in component state (not persisted — session only)
- No new on-chain program needed

---

## Resolved Questions

- **All 4 combos?** → No. Just Ghost Pay + Ghost Receive. Mixed modes work naturally but no dedicated UI.
- **ZK pool vs stealth?** → Stealth. ZK (Privacy Cash) is WASM-blocked in React Native.
- **Backend relayer?** → No. Fully client-side.

---

## Out of Scope

- Recipient scanning blockchain to discover stealth payments (full DKSAP) — not needed with session keypair approach
- Ghost mode for Blinks/Actions API
- Amount hiding (stealth addresses hide identity, not amount)
- Persistent ghost wallet / recurring ghost addresses
