# PhasmaPay

NFC tap-to-pay for USDC/SOL on Solana Seeker. Expo bare workflow, Android-only.

## Hackathons

- **Graveyard Hack** — deadline Feb 27, 2026. Tracks: Overall ($15K) + Torque/Loyalty ($1K) + OrbitFlare/Blinks ($1.2K)
- **MONOLITH** (Solana Mobile) — deadline March 9, 2026. Top 10 ($10K) + Best SKR ($10K)
- **StableHacks** — secondary, "Programmable Stablecoin Payments" track (Apr 8)

## Repo

https://github.com/phasmapay/app

## Folder Guide

Each folder has its own `CLAUDE.md` with detailed context:

- `android/CLAUDE.md` — Native build, Kotlin pin, prebuild gotchas
- `app/CLAUDE.md` — Expo Router routes and tab bar
- `src/CLAUDE.md` — Core logic: services, hooks, components, conventions
- `api/CLAUDE.md` — Blinks / Solana Actions endpoint

## Sponsor Integrations

### Torque SDK (`src/services/torque.ts`)
- `@torque-labs/torque-ts-sdk` installed
- MWA adapter shim wraps `transact()` for `signMessage` (what Torque needs for auth)
- `initTorque()` called on wallet connect (non-blocking)
- `trackPaymentWithTorque(txSig, amount)` called after every successful payment
- Exports: `getTorqueOffers()`, `acceptTorqueCampaign()`, `getTorqueJourneys()`
- **To activate**: register publisher handle `phasmapay` at app.torque.so, create campaign

### Solana Actions / Blinks (`api/server.ts`)
- Full Solana Actions spec v2.1.3 implementation
- `GET /actions.json` — routing rules
- `GET /api/actions/pay` — form with recipient + amount inputs, quick $1/$5/$10 buttons
- `GET /api/actions/pay/:address` — pre-filled recipient
- `POST /api/actions/pay/:address?amount=X` — builds unsigned USDC transfer tx
- Run: `npx ts-node --transpile-only api/server.ts`
- Set `RPC_URL` env to OrbitFlare RPC endpoint for their track
- Defaults to devnet (`https://api.devnet.solana.com`), devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- **To register as Blink**: deploy publicly → register at dial.to

## Vault + Guardian (MONOLITH features)

### Tap Vault (`src/services/vault.ts`, `app/vault.tsx`)
- Dedicated keypair stored in `expo-secure-store`, config in AsyncStorage
- Daily spending limit (default $25), auto-resets at midnight
- Vault payments sign locally with keypair — no MWA popup (instant tap-to-pay)
- Load vault via MWA (main wallet → vault USDC transfer)
- Works for both normal NFC pay and ghost pay
- Home screen shows vault card with balance + daily usage bar

### Guardian Agent (`src/services/guardian.ts`, `src/components/GuardianSteps.tsx`)
- Deterministic risk engine: 5 checks (account exists, tx history, age, known recipient, amount anomaly)
- Weighted score 0-100 → green (≥70) / yellow (40-70) / red (<40)
- Auto-approve: green + Gold SKR tier → skip confirmation entirely
- Step-by-step animated reveal in pay screen, collapsible analysis
- Red risk: confirm button becomes orange "Proceed Anyway"

### Payment Flow States
`idle → optimizing → guarding → awaiting_approval → signing → confirming → success`

## Yield Architecture

- `src/services/yield.ts` — simulated yield on total idle USDC (vault + unclaimed ghost)
- `getTotalIdleUsdc()` sums vault balance + all unclaimed ephemeral ATA balances on-chain
- Demo: 7% APY with 1440x time multiplier (1 min = 1 day)
- Claim pays real SKR from treasury
- **Production design**: shared PDA vault → Kamino USDC lending. One protocol account, rent amortized across all users. Per-user Kamino account rent (~$1) is uneconomical for small balances — shared vault solves this. Ghost ephemeral ATAs closed on sweep, rent reclaimed.

## Key Decisions

- **Icons**: Custom SVG (`react-native-svg`), not Ionicons/expo-font (broke on builds)
- **Styling**: Inline styles, not NativeWind className (reliability issues)
- **MWA address decode**: base58 first, fallback base64 (Phantom quirk)
- **NFC**: `react-native-nfc-manager` v3.17 — requires native rebuild after install

## Build & Run

```bash
npm install
npx expo run:android          # build + run on connected device
```

Requires: Android device with NFC + Phantom wallet installed.

## Test Devices

- Oppo Reno 14 Pro (primary dev, USB) — Android 16, NFC, Phantom installed
- Poco X3 (merchant testing) — Android 12, install via APK transfer

## Devnet Resources

- Faucet SOL: https://faucet.solana.com
- Faucet USDC: https://faucet.circle.com
- RPC: `https://rpc.ankr.com/solana_devnet`
