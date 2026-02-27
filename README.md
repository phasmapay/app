# PhasmaPay

NFC tap-to-pay for USDC on Solana with ghost addresses — ephemeral keypairs that keep the merchant's real wallet off-chain.

## Download

- **APK (Android):** [Install from Expo](https://expo.dev/accounts/amrrobb/projects/phasmapay/builds/0294bc37-d728-4e39-831f-0a95ccecbd1d)
- **Demo Video:** [Google Drive](https://drive.google.com/drive/folders/174K8g1-jy9XzaOkPZpDC1APJYDif9bwP?usp=sharing)
- **Source:** [GitHub](https://github.com/phasmapay/app)

## The Problem

Open any block explorer and search a merchant's crypto wallet. You can see every payment they ever received — amounts, senders, timestamps. Every crypto payment today is a privacy leak for the receiver. PhasmaPay fixes this with ghost addresses.

## How It Works

PhasmaPay supports two payment modes:

### Standard Mode — NFC Tag

Solana Pay URI written to a physical NFC tag for fixed-location payments. Customer taps their phone on the tag, wallet signs via Mobile Wallet Adapter (MWA), and USDC is transferred directly. Simple, fast, no privacy layer — ideal for storefronts with a fixed payment address.

### Ghost Mode — Ephemeral Address Isolation

The core contribution. Each payment generates a fresh ephemeral keypair so the merchant's real wallet never appears on-chain:

1. Merchant enters an amount and generates a one-time keypair
2. The ghost address is shared via NFC — phone-to-phone using Host Card Emulation (HCE), or written to a physical tag
3. Customer sends USDC to the ghost address (signed via MWA)
4. Merchant's app detects the payment, sweeps funds to their real wallet, closes the ephemeral account (reclaiming rent), and destroys the key

The payer's on-chain transaction only shows the ephemeral address as recipient. No address reuse, no linkability. The merchant's actual address never appears in any customer transaction.

**Why this matters:** Ghost mode provides address isolation per payment. Future versions will integrate [Light Protocol](https://www.lightprotocol.com/) for fully shielded transfers where amounts and recipients are hidden on-chain too.

## Additional Features

- **Jupiter v6 route optimization** — Customer holds SOL but needs to pay USDC? The swap and payment are wrapped into one transaction automatically.
- **SKR tiered cashback** — Ghost (0.5%), Bronze (1%), Silver (2%), Gold (3%) cashback tiers based on SKR token balance. Rewards payment volume.
- **Solana Actions / Blinks** — Payment requests exposed as a REST endpoint, shareable as Blinks. Same payment infrastructure, two distribution channels.
- **Torque SDK** — Tracks payment activity for loyalty campaign integration.

## Quick Start

### Prerequisites

- Node.js 18+
- Android Studio SDK tools
- Android device with NFC and an MWA-compatible wallet (Phantom, Solflare, etc.)

### Install & Run

```bash
git clone https://github.com/phasmapay/app.git
cd app
npm install
cp .env.example .env    # defaults work for devnet
npx expo run:android    # builds & installs on connected device
```

> First build takes ~5 min (Gradle). Subsequent runs use cache.

### Get Devnet Funds

- **SOL (gas):** https://faucet.solana.com
- **USDC (payments):** https://faucet.circle.com → select Solana Devnet

## Testing Ghost Mode (Two Devices)

Ghost mode requires two Android phones with NFC:

1. **Phone A (Merchant):** Ghost Receive → enter $1.00 → "Start Ghost Session"
2. **Phone B (Customer):** Ghost Pay → "Scan Ghost Tag" → hold phones back-to-back
3. **Phone B:** Approve in wallet
4. **Phone A:** "Payment Received" → "Claim to Wallet" → approve in wallet

Both phones need an MWA wallet installed and funded with devnet SOL + USDC.

## Environment Variables

Copy `.env.example` to `.env`. Defaults work out of the box for devnet:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet-beta` |
| `EXPO_PUBLIC_RPC_URL` | Solana RPC endpoint |

## Project Structure

```
app/                    # Expo Router screens
├── pay.tsx             # Standard NFC pay
├── receive.tsx         # Standard NFC receive
├── ghost-pay.tsx       # Ghost mode pay (customer)
├── ghost-receive.tsx   # Ghost mode receive (merchant)
└── receipt/            # Shared receipt screen

src/
├── services/
│   ├── payment.ts      # USDC transfer + MWA signing
│   ├── ghostPayment.ts # Ephemeral keypair, sweep tx, ATA close
│   ├── nfc.ts          # NFC read/write helpers
│   ├── hce.ts          # Host Card Emulation (phone-to-phone NFC)
│   ├── jupiter.ts      # Jupiter v6 route optimization
│   ├── torque.ts       # Torque SDK loyalty tracking
│   └── skr.ts          # SKR balance & tier calc
├── hooks/              # usePayment, useNfc, useBalances, useGhostReceive
├── context/            # WalletContext (MWA connection state)
└── utils/              # Constants, Solana connection

api/server.ts           # Solana Actions / Blinks endpoint
```

## Roadmap

**Phase 1 — Now.** NFC tap-to-pay USDC with ghost mode, SKR tiered cashback, Jupiter auto-swap, phone-to-phone HCE.

**Phase 2 — Shielded.** Light Protocol integration for fully private transfers — amounts and recipients hidden on-chain.

**Phase 3 — Fiat Rails.** On-ramp to USDC, off-ramp from USDC. Neither side touches crypto.

**Phase 4 — Multi-token.** Accept any SPL token, auto-swap to merchant's preferred settlement currency.

## Tech Stack

- **Framework:** React Native + Expo (bare workflow)
- **Wallet:** Mobile Wallet Adapter v2 (wallet-agnostic — Phantom, Solflare, etc.)
- **Blockchain:** `@solana/web3.js`, `@solana/spl-token`
- **NFC:** `react-native-nfc-manager` (read/write/HCE)
- **Routing:** Jupiter v6 (automatic SOL→USDC swap)
- **Loyalty:** SKR tiered cashback (0.5%–3%)
- **UI:** React Native Reanimated, custom SVG icons

## License

MIT
