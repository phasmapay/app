# PhasmaPay 👻

NFC tap-to-pay on Solana Seeker. Tap phone → pay USDC instantly. AI agent optimizes gas. SKR cashback rewards.

**Hackathon:** MONOLITH (Solana Mobile) — March 9, 2026
**Prize Target:** $10K Top 10 + $10K Best SKR Integration

---

## What It Does

- **Tap to Pay**: Write Solana Pay URLs to NFC tags. Customers tap Seeker → instant USDC payment
- **AI Agent**: Detects cheapest payment route (direct USDC vs Jupiter swap), shows gas savings
- **SKR Rewards**: Tiered cashback system (Ghost → Bronze → Silver → Gold) based on staked SKR
- **MWA + Seed Vault**: All signing goes through Mobile Wallet Adapter → Seed Vault. No keys in app

## Architecture

```
NFC Tag (Solana Pay URL)
    ↓ react-native-nfc-manager
AI Agent (optimizePayment)
    ↓ check USDC balance
    ├── Direct: buildUsdcTransferTx()
    └── Swap: Jupiter v6 → then transfer
            ↓ transact() → MWA → Seed Vault
Transaction confirmed on Solana
    ↓
SKR cashback calculated + stored
```

## Setup

### Prerequisites

- Node 20+
- Android device with NFC (Seeker or any NFC-capable Android)
- [Fakewallet](https://github.com/solana-mobile/mobile-wallet-adapter/tree/main/android/fakewallet) sideloaded (for testing without Seeker)

### Install

```bash
cd phasmapay
npm install
cp .env.example .env
```

### Run (requires physical Android device)

```bash
npx expo run:android
```

> **Note:** NFC requires a real device. Emulators don't support NFC hardware.

### Android Manifest (already configured)

NFC permissions and intent filter for `solana:` scheme are in `android/app/src/main/AndroidManifest.xml`.

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Home | `/` | Balance (USDC/SOL/SKR), tier, quick actions |
| Pay | `/pay` | NFC scan → payment confirmation → Seed Vault signing |
| Receive | `/receive` | Enter amount → write Solana Pay URL to NFC tag |
| History | `/history` | Past txs with gas savings + cashback per row |
| Settings | `/settings` | Network, wallet address, disconnect |
| Receipt | `/receipt/[sig]` | Post-payment summary with Explorer link |

## Key Files

```
src/
  services/
    nfc.ts          — Read/write NDEF Solana Pay tags
    payment.ts      — Build + execute USDC transfer txs
    jupiter.ts      — Jupiter v6 quote + swap
    agent.ts        — AI gas optimization logic
    skr.ts          — SKR balance, tier calculation, cashback
    storage.ts      — AsyncStorage for tx history
  hooks/
    useNfc.ts       — NFC state machine
    usePayment.ts   — Payment state machine
    useBalances.ts  — USDC/SOL/SKR balance fetcher
  context/
    WalletContext.tsx — MWA auth + session persistence
  utils/
    constants.ts    — Mints, network config, app identity
    solana.ts       — Connection singleton, helpers
app/
  (tabs)/
    index.tsx       — Home screen
    history.tsx     — Transaction history
    settings.tsx    — Settings
  pay.tsx           — Pay screen (modal)
  receive.tsx       — Receive screen (modal)
  receipt/[sig].tsx — Receipt screen (modal)
```

## USDC Mints

| Network | Mint |
|---------|------|
| Devnet | `Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr` |
| Mainnet | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

Switch via `EXPO_PUBLIC_SOLANA_NETWORK=mainnet-beta` in `.env`.

## Testing Without Physical NFC

Use `mockNfcRead()` from `src/services/nfc.ts` in development:

```typescript
import { mockNfcRead } from '@/services/nfc';
const mockData = mockNfcRead('RecipientAddress...', 5.00);
await prepare(mockData); // triggers payment flow
```

## Demo Flow

1. Merchant: opens Receive tab → enters $5.00 → taps "Write NFC Tag" against tag
2. Customer: opens Pay tab → taps "Scan NFC Tag" → holds Seeker to tag
3. AI optimizes: "direct USDC transfer, saved $0.025 in gas"
4. Customer confirms → Seed Vault signs → tx lands on Solana devnet
5. Receipt shows: amount, AI savings, SKR cashback, Explorer link

## References

- [Solana Mobile SDK](https://docs.solanamobile.com)
- [MWA 2.0 Protocol](https://docs.solanamobile.com/react-native/mobile-wallet-adapter)
- [react-native-nfc-manager](https://github.com/revtel/react-native-nfc-manager)
- [Jupiter v6 API](https://station.jup.ag/docs/apis/swap-api)
- [Solana dApp Store](https://docs.solanamobile.com/dapp-publishing/overview)
