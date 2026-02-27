# app/

Expo Router file-based routing. Each file = a route.

## Routes

- `_layout.tsx` — Tab navigator with SVG icons (filled=active, outline=inactive)
- `pay.tsx` — Customer: NFC read → parse Solana Pay URL → confirm → sign via MWA
- `receive.tsx` — Merchant: enter amount → write Solana Pay URL to NFC tag
- `(tabs)/` — Tab group wrapper
- `receipt/` — Post-payment confirmation screen

## Tab Bar

Uses custom SVG icons from `src/components/Icons.tsx`. Three tabs: Home, History, Settings.
