# api/

Solana Actions / Blinks server for OrbitFlare track (Graveyard Hack).

## Files

- `server.ts` — Express server implementing the Solana Actions spec
- `README.md` — Endpoint docs and test commands

## Routes

- `GET /actions.json` — routing rules (required by spec)
- `GET /api/actions/pay` — payment form with recipient + amount inputs
- `GET /api/actions/pay/:address` — pre-filled recipient, amount picker
- `POST /api/actions/pay/:address?amount=X` — builds unsigned USDC transfer tx

## Key Details

- Uses `RPC_URL` env var — set to OrbitFlare RPC for their track
- Defaults to devnet with devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
- Follows Solana Actions spec v2.1.3 (X-Action-Version header, X-Blockchain-Ids)
- Pattern modeled after OrbitFlare's `solana-blinks-axum` Rust template
