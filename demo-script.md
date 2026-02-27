# PhasmaPay Demo Script (2:30)

## [0:00–0:15] Hook — The Problem
**Voiceover:** "Open Solscan. Search any merchant's wallet address. You can see every payment they ever received — who paid, how much, when. Every crypto payment today is a privacy leak for the receiver. Every NFC tag, every QR code, every payment link — same address, fully traceable."

**Screen:** Show a Solana wallet on Solscan with visible transaction history. Highlight: "Anyone can see this."

---

## [0:15–0:30] The Fix
**Voiceover:** "PhasmaPay fixes this with ghost addresses. Every payment generates a fresh ephemeral keypair. The customer pays to a one-time address. The merchant sweeps to their real wallet. The ghost key is destroyed. The merchant's real wallet never appears on-chain."

**Screen:** App opens, show home screen with Ghost Pay / Ghost Receive prominently

---

## [0:30–0:50] Standard Flow (quick)
**Voiceover:** "First, the standard mode. Merchant writes a Solana Pay URL to an NFC tag. Customer taps, wallet signs via MWA, USDC transferred. Simple — but the merchant's address is on that tag, readable by anyone."

**Screen:** Receive → 5.00 → write tag → Pay → tap → confirmed. Then highlight: "But this address is permanent and public."

---

## [0:50–1:30] Ghost Flow (THE KEY FEATURE)
**Voiceover:** "Ghost mode solves this. Merchant enters amount. App generates a fresh ephemeral keypair — a ghost address. Broadcasts via NFC. Customer taps, sends USDC to the ghost address. Merchant's device detects the payment, sweeps funds to their real wallet, closes the ephemeral account, reclaims rent. Key destroyed."

**Screen:** Ghost Receive → amount → "Start Ghost Session" → NFC broadcast → Customer taps → Payment detected → "Claim to Wallet" → sweep confirmed

**Voiceover:** "Now check the customer's transaction on Solscan. The recipient? A random one-time address. The merchant's real wallet? Nowhere to be found."

**Screen:** Show the tx on Solscan — recipient is the ephemeral address. Merchant's real wallet not visible.

---

## [1:30–1:50] How It's Different
**Voiceover:** "Every existing crypto payment — Flexa, Oobit, crypto cards — converts to fiat through card networks. PhasmaPay settles directly on-chain in USDC. Non-custodial. Both sides keep their keys. And no other payment app generates a fresh address per transaction for receiver privacy."

**Screen:** Comparison: Traditional (custodial, fiat rails, address exposed) vs PhasmaPay (non-custodial, on-chain, ghost addresses)

---

## [1:50–2:10] Architecture
**Voiceover:** "Under the hood: react-native-nfc-manager for NFC read/write and HCE. MWA v2 for wallet signing — works with any compatible wallet. Jupiter v6 auto-swaps SOL to USDC if the customer doesn't hold USDC."

**Screen:** Architecture diagram: NFC → PhasmaPay → MWA → Wallet → Solana RPC

---

## [2:10–2:30] Close
**Voiceover:** "Ghost addresses are a new primitive for receiver privacy in crypto payments. Next: Light Protocol for fully shielded transfers where amounts are hidden too. Then fiat on/off-ramp so neither side touches crypto. Solana is the settlement layer, not the user experience."

**Screen:** PhasmaPay logo, repo URL, "Ghost addresses: receiver privacy for crypto payments"

---

## Recording Setup
```bash
brew install scrcpy
scrcpy --record demo.mp4
scrcpy -s DEVICE_SERIAL --record demo.mp4
```
