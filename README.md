# PhasmaPay

NFC tap-to-pay for USDC on Solana Seeker. Tap a phone or NFC tag to pay — AI-analyzed risk, instant vault signing, optional privacy via on-chain escrow.

Built for **MONOLITH** (Solana Mobile) — Top 10 + Best SKR.

## Download

- **APK (Android):** [Install from Expo](https://expo.dev/accounts/amrrobb/projects/phasmapay-monolith/builds/7413a5c4-2a89-470a-ad46-84c4f2aaffad)
- **Demo Video:** [YouTube](https://www.youtube.com/watch?v=RqnAsqdYJbc)
- **Pitch Deck:** [Google Drive](https://drive.google.com/drive/folders/11zG8a5vf_NMuXeWS9T7oVZ7ofQP62Xvo)
- **Source:** [GitHub](https://github.com/phasmapay/app)

## What It Does

PhasmaPay turns a Solana Seeker into a payment terminal. Tap, review AI risk analysis, confirm — USDC moves. No QR codes. No copy-paste. No wallet popup if you use the vault.

### Core Features

**NFC Tap-to-Pay**
Read a tag, phone-to-phone tap, or write your address to any NFC tag. `react-native-nfc-manager` handles both read and Host Card Emulation (HCE) for phone-to-phone mode.

**AI-Powered Guardian**
Every payment runs through a 5-check risk engine before you confirm:
1. Account exists on-chain
2. Transaction history (has the recipient ever transacted?)
3. Account age
4. Known recipient (in your history)
5. Amount anomaly (vs. your baseline)

Results are sent to an LLM-powered API, which returns a plain-English risk summary in under 4 seconds. Falls back to a static summary if the API times out. Green (≥70) / Yellow (40–70) / Red (<40) scoring. Gold SKR tier + green score = auto-approve, no confirmation needed.

**Tap Vault**
Dedicated keypair stored in `expo-secure-store`. Pre-load USDC from your main wallet once. Payments sign locally — no MWA popup, sub-second confirmation. Daily spending limits cap how much can be spent if the device is compromised — since the vault signs without wallet approval, the limit is the safety net. Limits reset at midnight and scale with your SKR tier.

**Ghost Mode**
Privacy payments via a fresh escrow PDA per transaction. The recipient's real wallet never appears in the sender's transaction history. Recipient claims via any Blink-compatible wallet (dial.to, Phantom, Backpack).

**SKR Token — Tier System**

| Tier | SKR Balance | Cashback | Vault Limit | Guardian |
|------|-------------|----------|-------------|----------|
| Ghost | 0 | 0.5% | $10/day | Manual approve |
| Bronze | 10+ | 1% | $25/day | Manual approve |
| Silver | 100+ | 2% | $100/day | Manual approve |
| Gold | 1000+ | 3% | $500/day | Auto-approve (green risk) |

SKR is a real SPL token on devnet: `AD4ereCFKqgRCp77sU5q771oeNrrisxaEbqG9Ni9foyS`

**Yield on Idle USDC**

All idle USDC across vaults and unclaimed ghost payments earns yield. In production, funds pool into a single PDA-controlled protocol vault that deposits to Kamino USDC lending (~5-8% APY). One protocol account setup amortized across all users — no per-user rent overhead. Ghost ephemeral ATAs are closed on sweep, reclaiming rent. Yield funds SKR cashback, making the system self-sustaining without treasury subsidies.

For the hackathon demo: yield is simulated at 7% APY with a time accelerator (1 min = 1 day) so judges see numbers ticking up in real time. Claimed as real SKR tokens from treasury.

**AI Route Optimization**
Before signing, an agent evaluates direct USDC transfer vs. Jupiter swap and picks the cheaper path automatically.

**Solana Actions / Blinks**
Full Actions spec v2.1.3. Escrow recipients can claim from any Blink-compatible client — no PhasmaPay install required on the receiving end.

**Torque SDK**
Every completed payment is tracked via Torque for loyalty campaign eligibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PhasmaPay App                               │
│               Expo bare workflow · React Native · Android           │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  NFC / HCE │  │  Tap Vault │  │ AI Guardian │  │ SKR/Cashback │  │
│  │  read/write │  │  local KP  │  │  5-check +  │  │  4 tiers +   │  │
│  │  phone-tap  │  │  daily lim │  │  LLM summary│  │  yield/claim │  │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬───────┘  │
│         │               │               │                │          │
│  ┌──────┴───────────────┴───────────────┴────────────────┴───────┐  │
│  │              Payment Service + Escrow Service                 │  │
│  │    USDC transfer · Jupiter route optimization · Ghost escrow  │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                       │
│  ┌──────────────────────────┴────────────────────────────────────┐  │
│  │              Signing Layer                                    │  │
│  │    Vault (local keypair, instant) │ MWA v2 (Phantom popup)   │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Solana Devnet    │
                    │  Helius RPC        │
                    │                    │
                    │  phasma_escrow     │ ← Anchor 0.31
                    │  AGXRYord...       │   create/claim/refund
                    │                    │
                    │  SKR SPL Token     │ ← AD4ereCF...
                    │  USDC (devnet)     │ ← 4zMMC9...
                    └────────┬──────────┘
                             │
                    ┌────────▼───────────┐
                    │  Solana Actions    │ ← api/server.ts
                    │  /api/actions/pay  │   spec v2.1.3
                    └────────────────────┘
                             │
              Any Blink client (dial.to, Phantom, Backpack)
```

### Payment Flow States

```
idle → optimizing → guarding → awaiting_approval → signing → confirming → success
       (Jupiter)    (Guardian)   (user/auto)        (vault/MWA)  (on-chain)
```

## On-Chain Program

**`phasma_escrow`** — Anchor 0.31 program deployed on devnet.

| Instruction | What It Does |
|---|---|
| `create_escrow(amount, expiry)` | Sender deposits USDC into PDA vault, sets recipient + expiry |
| `claim_escrow()` | Recipient proves ownership, sweeps USDC from vault |
| `refund_escrow()` | Permissionless crank after expiry, returns USDC to sender |

**Program ID:** `AGXRYordHf4s632jNueAbfFXpt6jb3oGeQ6ispnbzxxY`

**Escrow PDA:** `seeds = ["escrow", sender, recipient, expiry_bytes]`
**Vault PDA:** `seeds = ["vault", escrow_pda]`

## Quick Start

### Prerequisites

- Node.js 18+
- Android Studio SDK tools
- Android device with NFC and Phantom wallet installed
- Rust + Anchor CLI 0.31 (program development only)

### Install & Run

```bash
git clone https://github.com/phasmapay/app.git
cd app
npm install
cp .env.example .env    # set EXPO_PUBLIC_RPC_URL to your Helius devnet endpoint
npx expo run:android    # builds & installs on connected device
```

First build takes ~5 min (Gradle). Subsequent runs use cache.

### Build the Anchor Program

```bash
anchor build --no-idl
anchor test
```

### Deploy to Devnet

```bash
solana config set --url devnet
solana airdrop 5
anchor deploy --provider.cluster devnet
```

### Get Devnet Funds

- **SOL (gas):** https://faucet.solana.com
- **USDC (payments):** https://faucet.circle.com → select Solana Devnet

## Testing Ghost Mode (Two Devices)

1. **Phone A (Merchant):** Ghost Receive → enter amount → "Start Ghost Session"
2. **Phone B (Customer):** Ghost Pay → "Scan Ghost Tag" → hold phones back-to-back
3. **Phone B:** Review AI Guardian summary → approve
4. **Phone A:** "Payment Received" → "Claim to Wallet" → approve in wallet

Both phones need Phantom installed with devnet SOL and USDC.

## Project Structure

```
programs/
  phasma-escrow/
    src/lib.rs              # On-chain escrow program (Anchor)

app/                        # Expo Router screens
├── (tabs)/
│   ├── index.tsx           # Home — wallet, vault balance, tier
│   ├── settings.tsx        # SKR tier dashboard, vault management
│   └── _layout.tsx
├── pay.tsx                 # Standard NFC pay
├── receive.tsx             # Standard NFC receive
├── ghost-receive.tsx       # Ghost mode receive (escrow claim)
└── vault.tsx               # Vault load/management

src/
├── services/
│   ├── escrow.ts           # On-chain escrow instruction builders
│   ├── payment.ts          # USDC transfer + MWA signing
│   ├── vault.ts            # Local vault keypair + daily limits
│   ├── guardian.ts         # Risk engine + LLM-powered summary
│   ├── nfc.ts              # NFC read/write helpers
│   ├── hce.ts              # Host Card Emulation (phone-to-phone)
│   ├── jupiter.ts          # Jupiter v6 route optimization
│   ├── skr.ts              # SKR balance, tier calc, cashback
│   └── torque.ts           # Torque SDK loyalty tracking
├── components/
│   ├── GuardianSteps.tsx   # Animated risk step reveal
│   └── GlassCard.tsx       # Shared card component
├── hooks/                  # usePayment, useNfc, useBalances, useGhostReceive
├── context/                # WalletContext (MWA connection state)
└── utils/                  # Constants, Solana connection

api/server.ts               # Solana Actions / Blinks endpoint
tests/phasma-escrow.ts      # Anchor test suite
```

## Tech Stack

- **On-chain:** Anchor 0.31 (Rust), Solana devnet
- **App:** React Native + Expo (bare workflow, Android)
- **Wallet:** Mobile Wallet Adapter v2 (Phantom)
- **NFC:** `react-native-nfc-manager` (read/write/HCE)
- **AI Guardian:** LLM-powered risk analysis, 4s timeout
- **Routing:** Jupiter v6 (automatic route optimization)
- **Composability:** Solana Actions / Blinks (spec v2.1.3)
- **Loyalty:** SKR tiered cashback + Torque SDK
- **RPC:** Helius devnet

## License

MIT
