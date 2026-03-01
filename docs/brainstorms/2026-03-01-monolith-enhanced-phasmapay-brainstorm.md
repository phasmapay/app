# PhasmaPay Enhanced — MONOLITH Hackathon Sprint

**Date:** 2026-03-01
**Deadline:** 2026-03-08 (7 days)
**Target prizes:** Top 10 ($10K) + Best SKR Integration ($10K) = $20K potential
**Scoring:** Stickiness/PMF 25% | UX 25% | Innovation 25% | Demo 25%

---

## What We're Building

PhasmaPay: the first NFC tap-to-pay app on Solana with privacy-preserving stealth addresses and SKR-powered loyalty. Two phones tap → money moves → no trace left. Think Venmo meets Apple Pay, but onchain, private, and rewarding.

### Core Value Props (in judge-speak)
1. **NFC hardware differentiation** — only possible on Seeker/Android, can't be a website
2. **Ghost Mode** — stealth addresses for payment privacy (validated pattern from Umbra/ETH, first on Solana mobile)
3. **SKR as the loyalty engine** — staked SKR determines cashback tier, making SKR core to the product loop
4. **Two-phone tap demo** — physically dramatic, impossible to ignore in a video

---

## Why This Approach

### Competitive landscape (researched)
- **Flexa** has NFC crypto payments but B2B merchant terminals, not P2P mobile
- **Numo** has NFC tap-to-pay but Bitcoin/Lightning only
- **No Solana app** does NFC P2P payments — we own this category
- **Previous winner "Tap"** won $30K at Grizzlython as a USDC cash app — but no NFC, no privacy
- **4/10 previous winners were gaming** — we differentiate by being payments with hardware wow factor

### Why enhanced vs. new project
- 7 days is not enough to build + polish from scratch
- Existing codebase has production-quality NFC, dual signer, Ghost Mode
- Enhancement lets us focus effort on UX polish + SKR depth + demo quality

---

## Wow Factor Strategy

Solana ecosystem judges reward spectacle. Every feature must have a visual payoff:

| Feature | Wow Moment |
|---|---|
| NFC tap | Animated ripple expands from tap point, haptic feedback, sound effect |
| Ghost Mode | Phantom-themed pulse animation, address appears letter-by-letter like decryption |
| Payment success | Confetti/particle burst, amount counter rolls up, receipt card slides in |
| SKR tier up | Level-up animation with tier badge glow, "unlocked" sound |
| Merchant receive | Cash register "cha-ching" animation, running total ticker |

### UI/UX North Star
- **Dark mode only** — #0a0a0a base, Solana purple (#9945FF) + ghost green (#00FF88) accents
- **Glassmorphism cards** — frosted glass effect on payment cards and receipts
- **Micro-animations everywhere** — every state transition has motion (Reanimated 3)
- **Typography hierarchy** — large bold amounts, subtle metadata, monospace for addresses
- **Haptic feedback** — on tap, on success, on tier change
- **Sound design** — subtle tap sound, success chime, ghost whoosh (optional but differentiating)

---

## Key Decisions

1. **SKR integration = loyalty tiers based on staked SKR balance** — not just holding, but staking. This ties into the Guardian/staking ecosystem judges care about.
2. **Merchant mode = same app, role toggle** — not a separate app. One APK, merchant flips a switch. Simpler scope.
3. **Demo-driven development** — build the 3-minute demo script FIRST, then implement features in demo order.
4. **No new backend/API work** — everything on-device + RPC. Blinks server is bonus, not priority.
5. **Consistent styling** — migrate everything to inline styles (per CLAUDE.md), kill NativeWind inconsistency.
6. **Deploy a devnet SKR token** — real SPL token, real staking simulation, not just a placeholder constant.

---

## Team Structure

### You (Ammar) — Project Manager
- Monitors all agent work, approves direction changes
- Tests on physical devices (Oppo Reno 14 Pro + Poco X3)
- Records demo video, builds pitch deck
- Final UX sign-off

### Agent Alpha — Lead Engineer / Architect (Opus)
- Coordinates all implementation agents
- Architecture decisions, PR reviews
- SKR integration design
- Demo script authoring

### Agent Beta — Frontend / UX Engineer (Sonnet)
- All UI screens: Home, Pay, Receive, Ghost Pay, Ghost Receive, Merchant Mode
- Animations (Reanimated 3): NFC ripple, ghost pulse, confetti, tier-up
- Glassmorphism cards, typography, haptic feedback
- Style consistency audit (inline styles everywhere)
- Loading states, empty states, error states with visual polish

### Agent Gamma — Blockchain / Services Engineer (Sonnet)
- SKR token deployment on devnet (SPL token + staking simulation)
- SKR tier engine: read staked balance → determine tier → calculate cashback
- Merchant mode service: tap-to-receive flow, transaction feed storage
- Ghost Mode hardening: edge cases, timeout handling, sweep reliability
- Payment service optimizations

### Agent Delta — Integration / QA / Demo Engineer (Sonnet)
- End-to-end flow testing (NFC read → payment → receipt → history)
- Seed Vault testing on Seeker device (if available)
- Demo video script + recording assistance
- Pitch deck content (not design — Ammar handles that)
- dApp Store submission prep (APK signing, metadata)

---

## 7-Day Sprint Plan (High Level)

| Day | Focus | Deliverable |
|---|---|---|
| Day 1 (Mar 1) | Demo script + SKR token deploy + merchant mode design | Written demo script, devnet SKR mint |
| Day 2 (Mar 2) | SKR tier engine + merchant mode UI shell | Tier calculation working, merchant toggle screen |
| Day 3 (Mar 3) | Merchant receive flow + SKR cashback on payments | Tap-to-receive working, cashback applied |
| Day 4 (Mar 4) | UX polish pass 1: animations, glassmorphism, haptics | All screens animated |
| Day 5 (Mar 5) | UX polish pass 2: empty states, loading, error states | No dead-end screens |
| Day 6 (Mar 6) | Integration testing + demo recording | Working E2E on 2 physical devices |
| Day 7 (Mar 7) | Pitch deck + submission prep + buffer | APK + video + deck + repo submitted |

---

## SKR Integration Design (for $10K bonus)

### How it works:
1. User stakes SKR via the app (or we read their existing stake from on-chain)
2. Staked SKR balance determines tier:
   - **Ghost** (0 SKR): 0% cashback
   - **Bronze** (100+ SKR): 0.5% cashback in SKR
   - **Silver** (500+ SKR): 1% cashback
   - **Gold** (1000+ SKR): 2% cashback + priority merchant features
3. After every payment, cashback is calculated and SKR is distributed
4. Tier progression has visual celebration (level-up animation)
5. Dashboard shows: current tier, staked amount, lifetime cashback earned

### Why judges will love this:
- SKR is **core to the product loop**, not a bolt-on badge
- It incentivizes staking (good for SKR ecosystem health)
- It creates repeat usage (stickiness score)
- The tier system is visually demonstrable in a 3-minute video

---

## Open Questions

*None — all resolved during team debate.*

---

## Submission Checklist

- [ ] Functional Android APK
- [ ] GitHub repository (public or invite hackathon-Judges)
- [ ] Demo video (3 min max)
- [ ] Pitch deck / presentation
- [ ] Publish to dApp Store (post-deadline, for prize claim)
