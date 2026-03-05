# PhasmaPay Demo Guide

## How This App Actually Works

PhasmaPay is an NFC tap-to-pay mobile wallet on Solana. Two phones. One taps, one pays. Real USDC moves on-chain.

### The Two Roles

| Role | Phone | What it does |
|------|-------|--------------|
| **Merchant** (receiver) | Poco X3 | Enters amount → phone becomes an NFC tag broadcasting a Solana Pay URL |
| **Customer** (payer) | Oppo Reno 14 Pro | Taps merchant phone → reads NFC → AI optimizes → Guardian scans → signs → USDC sent on-chain |

---

## The NFC System — How It Actually Works

### What is HCE (Host Card Emulation)?

HCE lets an Android phone **pretend to be an NFC tag**. When the merchant taps "Ready to Receive", the Poco becomes a virtual NFC tag that any NFC reader can read — including the Oppo's NFC reader.

### The Native Kotlin Layer

There are 3 Kotlin files that make this work:

#### 1. `HceService.kt` — The NFC Tag Emulator
- Extends Android's `HostApduService` — this is the OS-level service that responds when another phone taps
- Registered in AndroidManifest with `BIND_NFC_SERVICE` permission
- Responds to NDEF Type 4 Tag protocol (the standard NFC data format)
- **AID**: `D2760000850101` — this is the standard NDEF Tag Application ID. Any NFC reader that looks for NDEF data will find us
- **What it stores**: A Solana Pay URL encoded as an NDEF URI record
- **APDU flow** (what happens during a tap):
  1. Reader sends SELECT command with NDEF AID → service responds OK
  2. Reader sends SELECT CC file (Capability Container) → service sends back file size info
  3. Reader sends SELECT NDEF file → service selects the Solana Pay URL data
  4. Reader sends READ BINARY → service returns the NDEF message bytes (the Solana Pay URL)

#### 2. `HceModule.kt` — React Native Bridge
- Exposes 3 methods to JavaScript:
  - `startEmulation(solanaPayUrl)` → calls `HceService.setPaymentUrl()` to load the URL
  - `stopEmulation()` → calls `HceService.clear()` to wipe the data
  - `isEmulating()` → returns whether the service is active

#### 3. `HcePackage.kt` — Registration
- Registers `HceModule` with React Native so JS can call `NativeModules.HceModule`

#### `apduservice.xml` — Android Config
```xml
<host-apdu-service>
    <aid-group android:category="other">
        <aid-filter android:name="D2760000850101" />
    </aid-group>
</host-apdu-service>
```
This tells Android: "When any NFC reader selects AID `D2760000850101`, route it to our `HceService`."

### Why `registerTagEvent()` / `enableForegroundNfc()`?

Android problem: When you tap phones, Android's NFC system shows a **system app chooser** — "Open with ShopeePay? OVO? Chrome?" — because multiple apps can handle NFC tags.

`enableForegroundNfc()` calls `NfcManager.registerTagEvent()` which claims **foreground dispatch priority**. This tells Android: "While PhasmaPay is in the foreground, send ALL NFC events directly to us. Don't show the chooser."

- **Called when**: Entering Pay, Ghost Pay, Receive, or Ghost Receive screens
- **Released when**: Leaving those screens (`disableForegroundNfc()` → `unregisterTagEvent()`)
- **What breaks if you skip it**: The system NFC chooser dialog appears, user has to pick PhasmaPay manually, kills the instant-tap UX

### The Data That Moves Over NFC

The merchant phone broadcasts a **Solana Pay URL** as an NDEF URI record:

```
solana:<recipientAddress>?amount=1.00&spl-token=4zMMC9...&reference=<random>&label=PhasmaPay&message=PhasmaPay NFC Payment
```

- `recipientAddress` — the merchant's (or ephemeral) wallet address
- `amount` — USDC amount
- `spl-token` — USDC mint address (validated on read — rejects non-USDC tokens)
- `reference` — random keypair pubkey for tracking (generated fresh each time)
- `label` — "PhasmaPay"

The payer phone reads this URL via `readPaymentTag()`, parses it with `parseSolanaPayUrl()`, and feeds it into the payment pipeline.

---

## Normal Receive vs Ghost Receive

### Normal Receive (`app/receive.tsx`)
1. Merchant enters amount
2. Phone starts HCE — broadcasts `solana:<merchant_wallet>?amount=X`
3. Customer taps → pays directly to merchant wallet
4. Merchant polls their own USDC balance every 3s — when it goes up, shows "Payment Received!"
5. **Simple. Direct. One transaction.**

### Ghost Receive (`app/ghost-receive.tsx`)
1. Merchant enters amount
2. App generates an **ephemeral keypair** (one-time address) — `Keypair.generate()`
3. Saves the secret key to AsyncStorage (as an `UnclaimedPayment` entry)
4. Phone starts HCE — broadcasts `solana:<ephemeral_address>?amount=X`
5. Customer taps → pays to the **ephemeral address** (not the merchant's real wallet)
6. App polls the ephemeral ATA every 3s for incoming USDC
7. When USDC arrives → shows "Payment Received!" → merchant taps "Claim to Wallet"
8. Claim builds a **sweep transaction**: transfer all USDC from ephemeral ATA → merchant wallet, then close the ephemeral ATA (reclaims ~0.002 SOL rent)
9. Sweep tx is signed by the ephemeral keypair + merchant signs via MWA (merchant is fee payer)

**Why the extra step?** Privacy. The payer's transaction history shows they paid `ephemeral_address`, not the merchant's real wallet. No on-chain link between payer and merchant.

**Why save the secret key?** If the app crashes or the merchant closes the screen before claiming, the ephemeral keypair is stored. The "Claimable" screen on the home page shows unclaimed payments and lets the merchant sweep them later.

---

## Normal Pay vs Ghost Pay

### Normal Pay (`app/pay.tsx`)
1. Customer taps "Pay" → NFC scan screen → taps merchant phone
2. Reads Solana Pay URL → extracts recipient + amount
3. Pipeline runs: AI optimization → Guardian scan → confirmation card
4. Customer confirms → MWA/Vault signs → USDC sent to **merchant wallet directly**

### Ghost Pay (`app/ghost-pay.tsx`)
**Identical pipeline.** Same AI, same Guardian, same Vault, same cashback.
The only difference is the **UI labeling** — "GHOST MODE" badge, green color accent, "(stealth)" next to the address.

In the current implementation, the "ghost" part is on the **receive side** (ephemeral address), not the pay side. Ghost Pay sends to whatever address the NFC tag contains — if the receiver used Ghost Receive, that address is already ephemeral.

---

## The Payment Pipeline (What Happens After NFC Read)

```
NFC Read → parse Solana Pay URL
         → AI Route Optimization (agent.ts)
         → Guardian Risk Scan (guardian.ts)
         → Vault Eligibility Check (vault.ts)
         → [Auto-approve OR show confirmation card]
         → Sign (Vault keypair OR MWA/Phantom)
         → Send + Confirm on Solana
         → Post-payment: save tx, Torque tracking, SKR cashback
         → Receipt screen
```

### States (discriminated union in `usePayment.ts`):
```
idle → optimizing → guarding → awaiting_approval → signing → confirming → success
                                                                          ↘ error
```

### AI Route Optimization (`agent.ts`)
Checks: Does the user have enough USDC? If not, can we swap SOL→USDC via Jupiter? Picks the cheapest route.

### Guardian Risk Scan (`guardian.ts`)
5 parallel checks on the recipient:
1. **Account exists** — is it active on-chain? (25 weight)
2. **Transaction history** — how many txs? (25 weight)
3. **Account age** — how old is the first tx? (20 weight)
4. **Known recipient** — have we paid them before? (15 weight)
5. **Amount anomaly** — is this amount unusual vs our history? (15 weight)

Score 0-100 → green (≥70) / yellow (40-70) / red (<40)

Then calls Groq LLM (llama-3.3-70b) for a natural language summary with 4s timeout.

### Auto-Approve Logic
If Guardian says `autoApprove: true` AND vault has funds → skip confirmation card entirely, pay instantly.
- Gold tier: auto-approve at score ≥40 (green + yellow)
- Silver: ≥70 (green only)
- Bronze: ≥80 (strict green only)
- Ghost: never auto-approve

---

## Vault System

### What It Is
A **dedicated Solana keypair** stored in `expo-secure-store` (hardware-backed keystore on Android). Has its own USDC balance. Signs transactions locally — no MWA popup, no Phantom interaction.

### Why It Exists
MWA (Mobile Wallet Adapter) requires opening Phantom, showing a popup, user taps "Approve". Takes 2-3 seconds. For tap-to-pay, that kills the UX. Vault signs locally = instant.

### How It Works
1. User creates vault → generates `Keypair`, stores secret in SecureStore, config in AsyncStorage
2. User loads vault → MWA signs a transfer from main wallet → vault's USDC ATA
3. User pays from vault → vault keypair signs directly → no popup
4. Daily spending limit tracked in AsyncStorage, resets at midnight
5. Limit is tier-enforced: Gold=$500/day, Silver=$100, Bronze=$25, Ghost=$10

### Security Model
- Secret key in `expo-secure-store` → backed by Android Keystore (hardware TEE on most devices)
- Config/spending in AsyncStorage → tamperable on rooted devices (hackathon trade-off)
- Daily limit caps exposure if vault keypair is compromised

---

## Yield System (POC)

### What It Does
Tracks how long USDC sits idle across **vault + unclaimed ghost payments**. Calculates simulated yield at 7% APY. User can "Claim" yield as real SKR tokens sent from treasury.

`getTotalIdleUsdc()` sums:
- Vault USDC balance (vault ATA)
- All unclaimed ghost payment balances (ephemeral ATAs with status `pending` or `received`)

### Demo Accelerator
`DEMO_TIME_MULTIPLIER = 1440` — 1 real minute = 1 day of yield. So in a 2-minute demo, judges see ~2 days of yield accumulate.

### How Claim Works
1. `claimYield()` reads accrued amount from AsyncStorage
2. Builds an SKR transfer from treasury → user wallet (same mechanism as cashback)
3. Treasury keypair signs → sends on-chain
4. Resets accrued to 0, increments lifetime claimed

### The Economic Story — Why PhasmaPay Can Generate Yield

**The problem with naive per-user DeFi integration:**
On Solana, first interaction with any protocol (Kamino, Marinade, etc.) requires opening protocol-specific accounts. For Kamino lending: kToken ATA (~0.002 SOL) + obligation account (~0.003-0.005 SOL). At $150/SOL, that's ~$1 in rent per user. A vault with $10 USDC at 7% APY earns $0.70/year — **breakeven is 1.4 years**. For ephemeral ghost addresses it's even worse: every single payment would need a full account setup.

**PhasmaPay's solution — Shared Protocol Vault:**
1. **Single PDA-controlled vault** owned by the PhasmaPay program deposits to Kamino
2. All user vault USDC + unclaimed ghost payments pool into this one account
3. **One** Kamino account setup, rent amortized across all users (~$1 total, not per user)
4. Individual user shares tracked in PhasmaPay's on-chain program state
5. Ghost ephemeral ATAs are closed on sweep (rent reclaimed ~0.002 SOL each)

**The yield flywheel:**
```
User vault USDC ──────────┐
                           ├──→ PhasmaPay Protocol Vault (PDA)
Unclaimed ghost payments ──┘         │
                                     ▼
                              Kamino USDC Lending
                              (~5-8% APY real)
                                     │
                           ┌─────────┴─────────┐
                           ▼                   ▼
                    SKR Cashback          Protocol Revenue
                    (paid to users)       (sustainability)
```

This makes PhasmaPay self-sustaining: idle USDC earns yield → yield funds cashback → no treasury subsidies needed. The shared vault architecture solves the rent economics problem that kills individual-user DeFi integration on Solana.

**For hackathon:** We simulate yield on the combined balance and pay from treasury. The architecture is designed and documented for production.

---

## Dev Shortcuts

### Triple-Tap Mock Payment
In `__DEV__` mode, triple-tap the NFC circle on Pay or Ghost Pay screen → triggers a mock $1 payment to Poco wallet (`5HhoQzBkQ19W5vNZSK46tmUCtVPJNJDkxA83QdD21itN`). Skips actual NFC read.

### ADB Commands
```bash
# Check devices
adb devices -l
# 53069fa4 = Poco X3
# VGRCGU6DRGJNKZ8L = Oppo Reno 14 Pro

# Port forwarding (run for each device)
adb -s VGRCGU6DRGJNKZ8L reverse tcp:8081 tcp:8081  # Oppo
adb -s 53069fa4 reverse tcp:8081 tcp:8081            # Poco

# Install APK on specific device
adb -s VGRCGU6DRGJNKZ8L install android/app/build/outputs/apk/debug/app-debug.apk
```

### Common Issues
- **"Could not connect to dev server"** → re-run `adb reverse`
- **Balance stuck loading** → kill app and reopen (stale Connection websocket)
- **SecureStore ErrorCode -26** → harmless on Oppo, caught by try/catch
- **Cashback not arriving** → check treasury SOL balance (needs gas to send SKR)

---

## File Map

| File | Purpose |
|------|---------|
| `android/.../HceService.kt` | Native NFC tag emulator (APDU protocol) |
| `android/.../HceModule.kt` | React Native bridge for HCE |
| `android/.../apduservice.xml` | AID registration for NDEF tag |
| `src/services/nfc.ts` | NFC read/write, Solana Pay URL build/parse, foreground dispatch |
| `src/services/hce.ts` | JS wrapper for HceModule native calls |
| `src/hooks/useNfc.ts` | NFC state machine (idle→scanning→success) |
| `src/hooks/usePayment.ts` | Payment pipeline orchestration |
| `src/services/agent.ts` | AI route optimization (direct vs Jupiter swap) |
| `src/services/guardian.ts` | Risk engine (5 checks + Groq LLM summary) |
| `src/services/vault.ts` | Vault keypair management, USDC transfers |
| `src/services/yield.ts` | Mock yield accumulator (7% APY, 1440x demo speed) |
| `src/services/skr.ts` | SKR tier calculation, cashback percentages |
| `src/services/skrStaking.ts` | Treasury → user SKR transfer (cashback distribution) |
| `src/services/ghostPayment.ts` | Ephemeral keypair management, sweep tx builder |
| `src/hooks/useGhostReceive.ts` | Ghost receive state machine |
| `app/pay.tsx` | Normal pay screen (NFC scan → confirm → pay) |
| `app/ghost-pay.tsx` | Ghost pay screen (same pipeline, green UI) |
| `app/receive.tsx` | Normal receive (HCE broadcast, balance polling) |
| `app/ghost-receive.tsx` | Ghost receive (ephemeral keypair, sweep claim) |
| `app/vault.tsx` | Vault management + yield display |
| `app/(tabs)/index.tsx` | Home screen (balances, actions, vault card, txs) |
