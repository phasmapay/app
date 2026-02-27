# src/

Core application logic.

## Structure

```
src/
├── components/Icons.tsx    # Custom SVG icons (react-native-svg) — NOT @expo/vector-icons
├── context/WalletContext.tsx # MWA wallet connection state
├── hooks/
│   ├── useBalances.ts      # USDC + SOL balance fetching
│   ├── useNfc.ts           # NFC state: ready/disabled/unsupported, re-checks on AppState change
│   └── usePayment.ts       # Payment flow orchestration
├── services/
│   ├── agent.ts            # AI gas optimization (direct USDC vs Jupiter swap)
│   ├── hce.ts              # Host Card Emulation (stretch goal)
│   ├── jupiter.ts          # Jupiter v6 quote + swap API
│   ├── nfc.ts              # NFC read/write via react-native-nfc-manager
│   ├── payment.ts          # USDC transfer tx builder + MWA signing
│   ├── signer.ts           # Transaction signing helpers
│   ├── skr.ts              # SKR balance, tier calc, cashback
│   └── storage.ts          # AsyncStorage persistence
├── screens/                # Tab screens (home, pay, receive, history, settings)
└── utils/
    ├── constants.ts        # RPC URL, USDC mint, SKR mint addresses
    └── solana.ts           # Connection helpers
```

## Conventions

- Icons: SVG components via `react-native-svg` (Ionicons/expo-font was unreliable)
- Styling: Inline `style` props (NativeWind className had reliability issues)
- MWA address: try base58 first, fallback base64 decode (Phantom returns base64)
- RPC: `https://rpc.ankr.com/solana_devnet`
- SKR_MINT is placeholder — no actual token deployed yet
