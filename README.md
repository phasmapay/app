# PhasmaPay

NFC tap-to-pay for USDC on Solana with ghost addresses — ephemeral keypairs that keep the merchant's real wallet off-chain.

## Download

- **APK (Android):** [Install from Expo](https://expo.dev/accounts/amrrobb/projects/phasmapay/builds/0294bc37-d728-4e39-831f-0a95ccecbd1d)
- **Demo Video:** [Google Drive](https://drive.google.com/drive/folders/174K8g1-jy9XzaOkPZpDC1APJYDif9bwP?usp=sharing)

## Prerequisites

- Node.js 18+
- Android Studio (for SDK — you don't need the IDE, just the SDK tools)
- Android device with NFC and [Phantom](https://phantom.app/) installed
- USB cable + USB debugging enabled (Settings → Developer Options → USB Debugging)

## Quick Start

```bash
git clone https://github.com/phasmapay/app.git
cd app
npm install
cp .env.example .env    # defaults work for devnet
npx expo run:android    # builds & installs on connected device
```

> First build takes ~5 min (Gradle). Subsequent runs use cache and are faster.

## Environment Variables

Copy `.env.example` to `.env`. Defaults work out of the box for devnet:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet-beta` |
| `EXPO_PUBLIC_RPC_URL` | Solana RPC endpoint |
| `EXPO_PUBLIC_USDC_MINT_DEVNET` | Devnet USDC mint address |
| `EXPO_PUBLIC_SKR_MINT` | SKR rewards token mint (placeholder) |

## Get Devnet Funds

You need devnet SOL (for gas) and devnet USDC (for payments):

- **SOL:** https://faucet.solana.com
- **USDC:** https://faucet.circle.com → select Solana Devnet

## How It Works

### Standard Mode (NFC tag)

```
Merchant: enter amount → write Solana Pay URL to NFC tag
Customer: tap phone on tag → confirm → Phantom signs → USDC sent
```

### Ghost Mode (phone-to-phone, address isolation)

```
Merchant                          Customer
────────                          ────────
Enter amount
Generate ephemeral keypair
Broadcast via NFC (HCE)
                    ◄── tap ──►
                                  Read ephemeral address
                                  Send USDC → ephemeral addr
                                  (Phantom signs)
Poll detects payment
"Claim to Wallet"
  └─ Sweep: ephemeral → real wallet
  └─ Close ephemeral ATA (rent reclaimed)
```

The payer's on-chain tx only shows the ephemeral address as recipient — the merchant's real wallet address never appears in the payer's transaction. Each payment gets a fresh keypair. Current implementation provides address isolation; future versions will integrate [Light Protocol](https://www.lightprotocol.com/) for fully shielded transfers.

**Why this matters:** Open any block explorer and search a merchant's wallet address. You can see every payment they ever received. Ghost mode ensures the merchant's real address never appears in any customer transaction — each payment uses a fresh one-time address that's destroyed after the sweep.

## Roadmap

- **Privacy:** Integrate Light Protocol for fully shielded on-chain transfers
- **Fiat on/off-ramp:** Payer tops up with fiat (on-ramp to USDC), merchant settles to fiat (off-ramp from USDC). Neither side touches crypto — Solana is the invisible settlement layer. Integration targets: Bridge, Sphere, Decaf
- **Multi-token:** Accept any SPL token, auto-swap to merchant's preferred settlement currency
- **Seeker native:** Seed Vault background signing for zero-interaction tap-to-pay on Solana Seeker hardware

## Testing with Two Devices

Ghost mode requires two Android phones with NFC:

1. **Phone A (Merchant):** Ghost Receive → enter $1.00 → "Start Ghost Session"
2. **Phone B (Customer):** Ghost Pay → "Scan Ghost Tag" → hold phones back-to-back
3. **Phone B:** Approve in Phantom
4. **Phone A:** "Payment Received" → "Claim to Wallet" → approve in Phantom

Both phones need Phantom installed and funded with devnet SOL + USDC.

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
│   ├── hce.ts          # Host Card Emulation
│   ├── jupiter.ts      # Jupiter v6 route optimization
│   ├── torque.ts       # Torque SDK loyalty tracking
│   └── skr.ts          # SKR balance & tier calc
├── hooks/              # usePayment, useNfc, useBalances, useGhostReceive
├── context/            # WalletContext (MWA connection state)
└── utils/              # Constants, Solana connection

api/server.ts           # Solana Actions / Blinks endpoint
```

## Blinks Server (Optional)

Payment requests work as Solana Actions, shareable as Blinks:

```bash
RPC_URL=https://api.devnet.solana.com npx ts-node --transpile-only api/server.ts
# Runs on http://localhost:3000
```

## Tech Stack

- **Framework:** React Native + Expo (bare workflow)
- **Wallet:** Mobile Wallet Adapter v2 (works with Phantom, Solflare, or any MWA-compatible wallet)
- **Blockchain:** `@solana/web3.js`, `@solana/spl-token`
- **NFC:** `react-native-nfc-manager` (read/write/HCE)
- **Routing:** Jupiter v6 (automatic SOL→USDC swap)
- **Loyalty:** SKR tiered cashback system (0.5%–3%)
- **UI:** React Native Reanimated, custom SVG icons

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails on Kotlin version | Pin Kotlin 1.9.25 in `android/build.gradle` — see `android/CLAUDE.md` |
| `android/` missing after `expo prebuild --clean` | Re-apply Kotlin pin + `android/local.properties` SDK path |
| NFC not working | Check Settings → NFC is ON. Both devices need NFC hardware. |
| Phantom not connecting | Ensure Phantom is installed, then tap "Connect Wallet" on home screen |
| Metro can't find device | Run `adb devices` — device must show as `device` not `unauthorized` |

## License

MIT
