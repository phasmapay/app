# PhasmaPay — Privacy-First Framing Brainstorm

**Date:** 2026-02-28
**Context:** Graveyard Hack submission + MONOLITH prep

## What We Discovered

### False Claims (REMOVE)
- "NFC crypto payments failed since 2017" — Flexa launched NFC crypto payments Feb 2025
- "Can't sign mid-tap" — Nobody tries to. NFC carries data, signing happens separately. Not a problem we solved.
- "First of its kind" / "First tap-to-pay" — Flexa exists. Oobit exists.
- "Background signing" — User still approves in Phantom. Not background.

### True Differentiators
1. **Ghost addresses (ephemeral keypairs per payment)** — Genuinely novel. No competitor does this.
2. **Non-custodial, on-chain settlement** — Flexa/Oobit convert to fiat via card networks. PhasmaPay settles USDC directly on Solana, self-custody both sides.
3. **Phone-to-phone NFC (HCE)** — No physical tag needed. No POS terminal. Two phones tap.
4. **Merchant privacy** — The real problem: any crypto payment exposes the merchant's full wallet history. Ghost addresses fix this.

### Competitor Landscape
| Competitor | Architecture | Privacy | Custody |
|---|---|---|---|
| Flexa | NFC hardware wallet → POS → fiat | No (merchant address exposed) | Semi-custodial |
| Oobit | Apple Pay/Google Pay → Visa/MC → fiat | No (fiat rails, but crypto address visible) | Custodial |
| Crypto debit cards | KYC, custodial, fiat conversion | No | Custodial |
| SolCard (upcoming) | Apple Pay/Google Pay → Solana | Unknown | Unknown |
| **PhasmaPay** | Phone NFC → MWA → on-chain USDC | **Yes (ghost addresses)** | **Non-custodial** |

## Key Decision: New Narrative

**Old narrative (FALSE):** "NFC crypto always failed. We fixed it."

**New narrative (TRUE):** "Every crypto payment exposes the merchant. Ghost addresses fix that."

### Slide 1 — Hook
"Open any block explorer. Search a merchant's wallet address. You can see every payment they ever received — who paid, how much, when. Every crypto payment today is a privacy leak for the receiver."

### Slide 2 — Problem
Two real problems:
1. **Merchant exposure** — Any customer, competitor, or tax authority can see the merchant's full transaction history from one address
2. **Address reuse** — NFC tags, QR codes, payment links all use the same address repeatedly, creating a permanent on-chain identity

### Slide 3 — Solution
"PhasmaPay generates a fresh ephemeral keypair for every payment. The customer pays to a one-time ghost address. The merchant sweeps to their real wallet. The ghost key is destroyed. The merchant's real wallet never appears on-chain in any customer transaction."

## Open Questions (Resolved)
- Q: Should we claim to be first? A: No. Claim to be first at PRIVATE NFC crypto payments.
- Q: Add killer features? A: Not for Graveyard. Fix core for MONOLITH.
- Q: Sponsors in pitch? A: Remove sponsor branding. Code integrations exist but aren't activated.

## Next Steps
1. Rewrite slides 1-3 with privacy framing in all files (HTML, pitch-deck.md, demo-script.md)
2. Rewrite submission.md bounty responses with honest claims
3. For MONOLITH: get E2E ghost flow working on two devices
