---
title: "MONOLITH Final Sprint: Fill Gaps to Win"
type: feat
status: active
date: 2026-03-03
deadline: 2026-03-09
hackathon: MONOLITH (Solana Mobile)
prizes: Top 10 ($10K each) + SKR Bonus ($10K)
scoring: Stickiness/PMF (25%) | UX (25%) | Innovation (25%) | Demo (25%)
---

# MONOLITH Final Sprint: Fill the Gaps

## Overview

6 days remain. PhasmaPay has a strong technical foundation (NFC tap-to-pay, Vault, Guardian, SKR tiers) but multi-agent analysis identified critical gaps that will cost us points across all four scoring dimensions. This plan addresses each gap with scoped, prioritized work.

## Problem Statement

Three agents independently identified the same core issues:

1. **SKR integration is cosmetic** — `distributeCashback()` exists but is never called. SKR is read-only. Removing SKR changes nothing about the app. This loses the $10K SKR bonus track.
2. **No stickiness loop** — The app is a tool (pay someone), not a product (something you open daily). Transaction history exists but isn't prominent. No earning/progression mechanic.
3. **Demo path has blockers** — Gold tier requires 10,000 SKR (unreachable for demo). Vault keypair needs SOL for fees. Auto-approve path never fires without all conditions met simultaneously.
4. **Feature sprawl dilutes impact** — 6 features at varying completion. Judges will perceive breadth without depth.

## Strategy

**One hero flow, polished to perfection:** Vault NFC tap-to-pay with Guardian auto-approve, earning SKR cashback on every payment.

**Cut from demo (mention in writeup only):** Ghost Pay details, Torque, Blinks/Actions API.

**Target both prize pools:** Top 10 (overall quality) + SKR Bonus (meaningful integration).

---

## Phase 1: Make the Demo Path Work (Days 1-2)

### 1.1 Fix Demo-Blocking SKR Tier Thresholds

**File:** `src/services/skr.ts`

Lower Gold tier to be achievable on devnet, or add a demo-mode override:

| Tier | Current Min | New Min |
|------|------------|---------|
| Ghost | 0 | 0 |
| Bronze | 100 | 10 |
| Silver | 1,000 | 100 |
| Gold | 10,000 | 1,000 |

This makes Gold reachable with a single devnet faucet mint. The auto-approve path (`guardian.autoApprove && vaultEligible`) will actually fire during demo.

**Acceptance Criteria:**
- [x] Tier thresholds lowered in `SKR_TIERS` constant
- [ ] Demo wallet has enough SKR to be Gold tier
- [ ] Auto-approve fires on green-risk Gold-tier vault payment (no confirmation screen)

### 1.2 Fund Vault Keypair with SOL

**File:** `src/services/vault.ts`

`buildVaultPaymentTx` sets `feePayer: keypair.publicKey`. If vault only holds USDC and no SOL, payments fail with "insufficient lamports."

**Fix:** When loading vault via MWA, also transfer 0.005 SOL alongside USDC. Or: add a check in `canSpend()` that verifies SOL balance and shows "Fund SOL for fees" if insufficient.

**Acceptance Criteria:**
- [x] Vault load flow transfers small SOL amount for fees (auto-tops up if below 0.005 SOL)
- [x] `hasEnoughSolForFees()` helper added to vault service
- [ ] Vault payment succeeds end-to-end on devnet

### 1.3 Verify Full Auto-Approve Path on Device

**Manual testing on Oppo Reno 14 Pro:**

- [ ] Initialize vault, fund with $10 USDC + 0.005 SOL
- [ ] Ensure wallet has Gold-tier SKR balance
- [ ] Triple-tap mock NFC → payment should auto-approve and sign instantly
- [ ] Measure time from tap to success (target: <2 seconds)
- [ ] Test with real NFC tag on second device (Poco X3 as merchant)

---

## Phase 2: Wire SKR Cashback On-Chain (Days 2-3)

### 2.1 Fund Devnet Treasury and Wire Distribution

**Files:** `src/hooks/usePayment.ts`, `src/services/skrStaking.ts`, `.env`

The cashback math exists (`calculateCashback` in `skr.ts`). The distribution function exists (`distributeCashback` in `skrStaking.ts`). They're just not connected.

**Implementation:**
1. Generate and fund a devnet SKR treasury keypair
2. Add `EXPO_PUBLIC_SKR_TREASURY_SECRET` to `.env` (devnet only — acceptable for hackathon)
3. In `usePayment.ts` success path, after `saveTransaction`:

```typescript
// Fire-and-forget cashback distribution
if (cashbackAmount > 0) {
  distributeCashback(connection, treasuryKeypair, recipientPubkey, amount, skrBalance)
    .then(sig => console.log('[SKR] Cashback tx:', sig))
    .catch(err => console.warn('[SKR] Cashback failed:', err));
}
```

4. Show cashback tx signature on success/receipt screen with Solscan devnet link

**Acceptance Criteria:**
- [x] `distributeCashback()` called fire-and-forget in both auto-approve and manual confirm paths
- [ ] SKR tokens actually transfer on-chain (needs treasury keypair in .env)
- [x] Receipt screen shows SKR cashback + Solscan link for cashback tx
- [ ] Treasury has enough SKR for ~50 demo transactions (needs funding)

### 2.2 SKR Earn Progress UI

**File:** `app/pay.tsx` (success state), home screen

After each payment, show:
- SKR earned this transaction
- Total SKR balance after cashback
- Progress bar to next tier ("42 more SKR to Silver")
- If tier-up happened: celebration moment (confetti already exists)

**Acceptance Criteria:**
- [ ] Success screen shows SKR earned + progress to next tier
- [ ] Progress bar is visually clear and accurate
- [ ] Tier-up triggers existing ConfettiBurst component

---

## Phase 3: SKR-Gated Vault Limits (Day 3-4)

### 3.1 Tie Daily Spending Limit to SKR Tier

**Files:** `src/services/vault.ts`, `app/vault.tsx`

Current: daily limit is a manually set flat number.
New: SKR tier determines the maximum limit you can set.

| Tier | Max Daily Limit |
|------|----------------|
| Ghost | $10 |
| Bronze | $25 |
| Silver | $100 |
| Gold | $500 |

**Implementation:**
- `setDailyLimit(amount, skrTier)` — cap at tier ceiling
- If user tries to exceed ceiling → show "Upgrade to Silver for $100/day" with SKR requirement
- `canSpend()` already checks against daily limit — no change needed there

**Acceptance Criteria:**
- [x] `setDailyLimitWithTier()` added to vault service — enforces tier ceiling
- [x] `getTierVaultCeiling()` exported from vault service
- [ ] Vault screen shows current ceiling and tier requirement for next level (UI update needed)
- [ ] Attempting to exceed ceiling shows clear upgrade CTA (UI update needed)

### 3.2 Tier-Based Guardian Thresholds

**Files:** `src/services/guardian.ts`, `src/components/GuardianSteps.tsx`

Make SKR tier visibly affect the Guardian experience:

| Tier | Auto-Approve Threshold |
|------|----------------------|
| Ghost | Never auto-approve |
| Bronze | Score >= 80 only |
| Silver | Score >= 70 (current default) |
| Gold | Score >= 40 (green + yellow) |

**Implementation:**
- `assessRecipient` accepts `skrTier` parameter
- Returns modified `autoApprove` based on tier-specific threshold
- GuardianSteps UI shows "Gold Tier — Auto-approved" badge when applicable

**Acceptance Criteria:**
- [x] Guardian auto-approve threshold varies by SKR tier (Ghost=never, Bronze≥80, Silver≥70, Gold≥40)
- [x] Guardian summary shows "Gold Tier — Auto-approved" when applicable
- [ ] Demo path: Gold tier + score≥40 = no confirmation screen at all (needs device test)

---

## Phase 4: UX Polish (Day 4-5)

### 4.1 Transaction History on Home Screen

**File:** `app/(tabs)/index.tsx`

Move last 3-5 transactions to the home screen below the vault card. Currently history is a separate tab/screen.

**Acceptance Criteria:**
- [ ] Home screen shows recent transactions inline
- [ ] Each entry: amount, recipient (truncated), time ago, cashback earned
- [ ] Tap to expand or navigate to full receipt
- [ ] Empty state: "Make your first payment" CTA

### 4.2 Payment Confirmation Polish

**File:** `app/pay.tsx`

Success screen must show:
- Amount paid
- Recipient address (truncated)
- Time elapsed from tap to confirmation (e.g., "1.8s")
- Vault indicator ("Paid from Vault — instant")
- SKR cashback earned + tier progress
- Tx signature with Solscan link

**Acceptance Criteria:**
- [ ] All 6 data points visible on success screen
- [ ] Time elapsed is measured and displayed
- [ ] Solscan link is tappable and correct (devnet)

### 4.3 Error States

**Files:** `app/pay.tsx`, `src/services/vault.ts`

Handle and display clearly:
- Vault empty mid-payment → "Fund your vault" CTA with quick-load buttons
- NFC timeout → retry prompt with count
- Insufficient SOL for fees → "Add SOL to vault" message
- Guardian red risk → orange "Proceed Anyway" (already exists — verify it works)

**Acceptance Criteria:**
- [ ] Each error state has a specific, actionable UI message
- [ ] No generic "Something went wrong" screens in the payment flow

### 4.4 Merchant Receive Simplification

**File:** `app/(tabs)/merchant.tsx` or receive flow

Dead simple screen for the second demo phone:
- Amount input
- "Waiting for payment..." state with NFC animation
- "Received $X.XX USDC" confirmation

**Acceptance Criteria:**
- [ ] Merchant receive works on Poco X3
- [ ] Clean, single-purpose screen visible in demo video

---

## Phase 5: Demo & Submission (Days 5-6)

### 5.1 Demo Video (90 seconds)

```
0-10s   Hook: "Solana payments need 3 taps and a wallet popup. We fixed that."
        B-roll of MWA popup frustration.

10-25s  Merchant sets $5 on Phone B. Camera shows screen.

25-40s  User taps Phone A to Phone B. PHYSICAL TAP ON CAMERA.
        Show confirmation on BOTH screens. Call out: "1.8 seconds. No popups."

40-55s  Vault explainer: "Your spending account for Solana. Set a limit,
        tap to pay, never think about private keys."
        Show daily limit, progress bar, SKR tier badge.

55-70s  SKR integration: "Every payment earns SKR. Higher tier = higher
        limits, less friction, instant approval."
        Show cashback on Solscan. Show tier progress bar moving.

70-80s  Ghost Pay (5 seconds): "Can't tap? Send a claimable link."

80-90s  Close: "NFC tap-to-pay. Sub-2-second finality. No wallet popups.
        SKR-powered trust tiers. PhasmaPay."
```

**Acceptance Criteria:**
- [ ] Video recorded on real devices with physical NFC tap visible
- [ ] Both phone screens visible during tap moment
- [ ] Real devnet transaction shown (Solscan link visible)
- [ ] Under 90 seconds
- [ ] Clean audio (narration or captions)

### 5.2 Pitch Deck (5-8 slides)

1. Problem: Mobile payments on Solana require wallet popups
2. Solution: Vault + NFC = instant tap-to-pay
3. How it works: Vault keypair + daily limits + Guardian risk scoring
4. SKR integration: earn cashback, unlock higher limits, less friction
5. Demo highlight: screenshot of both phones after tap
6. Traction potential: every Seeker owner is a potential user
7. Team + roadmap

### 5.3 Submission Checklist

- [ ] Functional Android APK (built from `feat/monolith-sprint`)
- [ ] GitHub repo (public or invite hackathon-Judges)
- [ ] Demo video uploaded
- [ ] Pitch deck uploaded
- [ ] Align profile created with wallet
- [ ] Submission form completed before March 9

---

## What's Explicitly Cut

| Feature | Status | Demo Treatment |
|---------|--------|---------------|
| Ghost Pay stealth | Cosmetic only (same flow as regular pay) | Mention in 5 seconds, don't explain mechanics |
| Torque integration | Fire-and-forget tracking, no visible reward | Omit from demo entirely |
| Blinks/Actions API | Working but irrelevant to mobile judging | Omit from demo, mention in writeup |
| QR code fallback | Not built | Don't build — NFC is the differentiator |
| Onboarding flow | Not built | Skip — demo video IS the onboarding |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|-----------|
| NFC fails during recording | Fatal | Record 10+ takes, use best. Test extensively on both devices beforehand. |
| Vault keypair has no SOL | Blocks vault payments | Phase 1.2 — transfer SOL during vault load |
| Treasury runs out of SKR | Cashback fails silently | Mint 1M SKR to treasury on devnet before demo |
| Gold tier unreachable | Auto-approve never fires | Phase 1.1 — lower thresholds |
| Demo video quality | 25% of score | Allocate full Day 5 — good lighting, stable camera, scripted narration |

---

## Daily Schedule

| Day | Date | Focus | Deliverables |
|-----|------|-------|-------------|
| 1 | Mar 3 | Phase 1: Demo blockers | Tier thresholds fixed, vault SOL funded, auto-approve verified |
| 2 | Mar 4 | Phase 2: SKR cashback | Treasury funded, `distributeCashback` wired, receipt shows cashback |
| 3 | Mar 5 | Phase 2.2 + 3: SKR utility | Earn progress UI, vault limit gating, guardian tier thresholds |
| 4 | Mar 6 | Phase 4: UX polish | Home screen history, success screen polish, error states |
| 5 | Mar 7 | Phase 5: Demo video | Script, record, edit 90-second video |
| 6 | Mar 8-9 | Phase 5: Submission | Pitch deck, APK build, bug fixes, submit |

## References

- `src/hooks/usePayment.ts` — payment state machine (entire flow)
- `src/services/skr.ts:SKR_TIERS` — tier thresholds to modify
- `src/services/skrStaking.ts:distributeCashback` — exists but unwired
- `src/services/vault.ts:buildVaultPaymentTx` — needs SOL for feePayer
- `src/services/guardian.ts:assessRecipient` — auto-approve logic
- `app/(tabs)/index.tsx` — home screen
- `app/pay.tsx` — payment flow UI
