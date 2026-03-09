# MONOLITH Sprint Gaps — Pre-Submission Review

**Date:** 2026-03-06
**Deadline:** March 9, 2026
**Branch:** `feat/monolith-sprint`

## What We're Building

Final polish pass for MONOLITH hackathon submission. Identify and fix all gaps in flows, narrative consistency, demo guide, and code before March 9.

## Current State: 95% Complete

All core flows work end-to-end: NFC pay, ghost pay, vault, yield, SKR cashback, guardian, claimable sweep. The remaining work is polish and narrative alignment.

## Identified Gaps

### P0 — Must Fix (Demo Blockers)

#### 1. Ghost Receive -> Vault Sweep Flow
**Status:** Not wired
**Problem:** When a ghost payment is received and vault exists, funds sit in ephemeral ATA until user manually navigates to Claimable screen. There's no option to sweep directly to vault (which would be instant, no MWA popup).
**Impact:** Judges will ask "why does receiving require a wallet popup to claim?"
**Fix options:**
- A) Auto-sweep to vault on ghost-receive detection (if vault enabled + has SOL for fees)
- B) Add "Sweep to Vault" button alongside "Claim to Wallet" on claimable screen
- C) Keep current flow — claim all goes to main wallet via MWA (simpler, already works)

#### 2. Receipt Screen Missing Ghost Mode Styling
**Status:** `ghostMode` param passed but not used
**Problem:** Ghost pay passes `ghostMode: 'true'` to receipt, but receipt looks identical to normal pay.
**Impact:** Low — judges may not notice, but it's inconsistent with the ghost narrative.
**Fix:** Add ghost badge and green accent when `ghostMode === 'true'`.

### P1 — Should Fix (Polish)

#### 3. Vault Creation Entry Point
**Status:** Card added to home screen (this session), but not yet tested on device
**Problem:** Previously, vault was completely hidden if not created — no way to discover it.
**Fix done:** "Set Up Tap Vault" card now shows on home when vault doesn't exist. Navigate to `/vault` which shows creation screen. Needs device verification.

#### 4. Ghost Receive Claim -> Receipt Navigation
**Status:** Claimable screen routes to receipt after claim-all
**Problem:** Receipt shows "Payment Received" but doesn't indicate it was a ghost claim sweep.
**Fix:** Pass `ghostMode: 'true'` from claimable screen to receipt.

#### 5. Balance Hidden Toggle Doesn't Mask Transaction Amounts
**Status:** Eye toggle on home hides balance card, but recent tx list and history show amounts.
**Impact:** Minor inconsistency.
**Fix:** Pass `balanceHidden` to tx items. Low priority.

### P2 — Nice to Have

#### 6. Settings -> Vault Shortcut
Currently vault is only accessible from home card. Adding a Settings row improves discoverability.

#### 7. Ghost-Receive HCE Shows "Payment Received" But No Next Step
After ghost-receive detects funds, it shows success but user has to manually go back and find the claimable screen. Could add a "Go to Claimable" or "Sweep Now" button inline.

#### 8. Route Savings Explanation for Judges
Currently hardcoded `SWAP_OVERHEAD_USD = 0.00037`. Judges may ask how this is calculated. Demo guide covers it, but could add a tooltip or info icon on the pay confirmation card.

## Key Decisions

### Decision 1: Ghost Receive Vault Sweep
**Chosen approach:** Skip — current MWA claim-all is sufficient for demo

### Decision 2: Receipt Ghost Styling
**Approach:** Lightweight — add ghost badge + green title accent. 30min max.

### Decision 3: Demo Flow Priority
Focus on the two-phone NFC demo path:
1. Merchant mode: Enter amount -> HCE broadcast
2. Customer mode: NFC scan -> Guardian scan -> Vault pay (instant) OR wallet pay
3. Show vault balance decrease, daily limit usage
4. Show SKR cashback on receipt
5. Show yield accruing on vault screen

## Resolved Questions

### Q1: Ghost sweep to vault — SKIP
Current claim-all via MWA works. Not worth 2-3 hours of risk with 3 days left.

### Q2: Submission format — Video + Repo
Record polished demo video. Safer than live demo (NFC/RPC can flake).

### Q3: Polish scope — All 4 items + vault mechanics
- Receipt ghost styling (~30min)
- Ghost-receive next-step CTA (~20min)
- Settings vault shortcut (~15min)
- Claimable -> receipt ghost flag (~5min)
- Vault end-to-end verification (create -> load -> pay on device)

## File Impact Map

| Gap | Files to Change |
|-----|----------------|
| Ghost sweep to vault | `src/services/ghostPayment.ts`, `app/claimable.tsx`, `app/ghost-receive.tsx` |
| Receipt ghost styling | `app/receipt/[signature].tsx` |
| Vault creation test | `app/(tabs)/index.tsx` (already done), device verify |
| Claimable -> receipt ghost flag | `app/claimable.tsx` |
| Settings vault shortcut | `app/(tabs)/settings.tsx` |
| Ghost-receive next-step button | `app/ghost-receive.tsx` |

## Next Steps

1. Answer open questions
2. Prioritize based on time remaining
3. Run `/workflows:plan` for chosen items
4. Build + test on both devices
5. Update demo guide if flows change
6. Record demo video (if decided)
7. Submit
