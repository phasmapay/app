# PhasmaPay — Pitch Deck

---

## Slide 1 — Hook

**Headline:** "Every crypto payment exposes the merchant."

**Visual:** Block explorer showing a merchant's wallet — full transaction history visible

**Narration:** "Open any block explorer. Search a merchant's wallet. You can see every payment they ever received — amounts, senders, timestamps. Every QR code, every NFC tag, every payment link uses the same address. One lookup reveals their entire financial history."

---

## Slide 2 — Problem

**Headline:** "Address reuse is a privacy crisis"

**2 columns:**
- **Permanent addresses:** Every customer, competitor, and tax authority can see the merchant's full payment history from one address lookup
- **On-chain transparency:** Blockchain's strength becomes a liability for merchants accepting payments

**Narration:** "This isn't hypothetical. If you put your wallet address on an NFC tag at your coffee shop, anyone with a phone can scan it and see every transaction you've ever received. The more payments you accept, the more exposed you become."

---

## Slide 3 — Solution

**Headline:** "Ghost addresses: a fresh keypair for every payment"

**3-step flow:**
`Generate ephemeral keypair` → `Customer pays to ghost address` → `Merchant sweeps to real wallet, key destroyed`

**Narration:** "PhasmaPay generates a fresh ephemeral keypair for every payment. The customer pays to this one-time ghost address. The merchant sweeps funds to their real wallet and destroys the key. The merchant's actual address never appears on-chain in any customer transaction. No address reuse. No linkability."

---

## Slide 4 — Demo

**Headline:** "Tap. Pay. Ghost."

**Visual:** Side-by-side: customer's tx on Solscan (shows ephemeral address) vs merchant's wallet (no trace)

**Narration:** "Watch the customer's transaction on Solscan. Recipient: a random one-time address. The merchant's real wallet? Nowhere to be found. That's ghost mode."

---

## Slide 5 — Two Payment Modes

**Diagram:**
```
STANDARD MODE                    GHOST MODE
─────────────                    ──────────
Solana Pay URI on NFC tag        Ephemeral keypair per payment
Merchant address on tag          Ghost address on tag (one-time)
Customer taps → wallet signs     Customer taps → wallet signs
Direct USDC transfer             USDC to ghost → sweep to real wallet
Simple, fast                     Private, unlinkable
```

**Narration:** "Two modes. Standard: write a Solana Pay URL to an NFC tag, customer taps, done. Ghost: fresh keypair per payment, customer pays to ephemeral address, merchant sweeps. Standard is simple. Ghost is private."

---

## Slide 6 — Ghost Flow Detail

**Diagram:**
```
MERCHANT                              CUSTOMER
────────                              ────────
Enter amount
Generate ephemeral keypair
Share via NFC (tag or HCE)
                    ◄── tap ──►
                                      Read ghost address
                                      Send USDC to ghost addr
                                      (wallet signs via MWA)
Poll detects payment
Sweep: ghost → real wallet
Close ephemeral ATA (rent reclaimed)
Key destroyed
```

**Narration:** "The ephemeral keypair lives only in memory for the session. After the sweep, the ghost account is closed, rent is reclaimed, and the key is destroyed. The on-chain record shows only the ghost address — a dead end for anyone trying to trace the merchant."

---

## Slide 7 — How We're Different

| | Flexa / Oobit / Crypto Cards | PhasmaPay |
|---|---|---|
| Settlement | Fiat via card networks | Direct USDC on Solana |
| Custody | Custodial or semi-custodial | Non-custodial — both sides keep keys |
| Privacy | Merchant address exposed | Ghost address per payment |
| Infrastructure | Requires POS terminal or card network | Two phones with NFC |

**Narration:** "Every existing crypto payment converts to fiat through card networks. PhasmaPay settles directly on-chain. Non-custodial. And no other payment solution generates a fresh address per transaction for receiver privacy."

---

## Slide 8 — Tech Stack

**Grid:**
- **react-native-nfc-manager** — NFC read/write + HCE
- **MWA v2** — Wallet signing (any MWA wallet)
- **@solana/web3.js + spl-token** — Transaction building
- **Jupiter v6** — SOL→USDC auto-swap
- **React Native + Expo** — Bare workflow, Android

**Narration:** "Built with react-native-nfc-manager for NFC including Host Card Emulation for phone-to-phone. MWA v2 for wallet signing — works with any compatible wallet. Jupiter v6 auto-swaps SOL to USDC if the customer doesn't hold stablecoins."

---

## Slide 9 — Roadmap

| Phase | What Ships |
|---|---|
| **Now** | NFC tap-to-pay, ghost mode, SKR cashback, Jupiter auto-swap, phone-to-phone HCE |
| **Privacy** | Light Protocol — fully shielded transfers (amounts + recipients hidden) |
| **Fiat rails** | On-ramp / off-ramp — neither side touches crypto |
| **Multi-token** | Accept any SPL token, auto-swap to merchant's preferred currency |

**Narration:** "Ghost addresses are step one — address isolation. Next: Light Protocol for fully shielded transfers where even amounts are hidden. Then fiat on/off-ramp so neither side needs to hold crypto. The end state: invisible settlement."

---

## Slide 10 — Close

**Big text:** "Solana is the settlement layer, not the user experience."

**Subtext:** "Ghost addresses: a new primitive for receiver privacy in crypto payments."

**Narration:** "PhasmaPay is NFC tap-to-pay USDC with ghost addresses for receiver privacy. Non-custodial. On-chain. And the merchant's wallet is never exposed. Solana is the settlement layer, not the user experience."

---

## Design Notes

- **Background:** Black (#0A0A0A)
- **Accent:** Purple/violet (#7B2FBE)
- **Text:** White (#FFFFFF)
- **Font:** Inter or Space Grotesk
- **Tone:** Ghost/phantom aesthetic — dark gradients, subtle fog
