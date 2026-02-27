# PhasmaPay Solana Actions API

Solana Actions / Blinks endpoint for the OrbitFlare track. Any wallet or Blink-compatible surface can render a PhasmaPay payment form.

## Run

```bash
cd api
npx ts-node server.ts
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RPC_URL` | devnet public | OrbitFlare or any Solana RPC |
| `PORT` | 3002 | Listen port |
| `NETWORK` | devnet | `devnet` or `mainnet-beta` |
| `ACTION_BASE_URL` | `http://localhost:3002` | Public URL for action hrefs |

To use OrbitFlare RPC, set `RPC_URL` to your OrbitFlare endpoint.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/actions.json` | Action routing rules |
| GET | `/api/actions/pay` | Payment form with amount + recipient inputs |
| GET | `/api/actions/pay/:address` | Pre-filled recipient, amount picker |
| GET | `/api/actions/pay/:address?amount=5` | Ready-to-confirm payment |
| POST | `/api/actions/pay/:address?amount=5` | Build unsigned USDC transfer tx |

## Test

```bash
# Get action metadata
curl http://localhost:3002/api/actions/pay

# Build a payment tx
curl -X POST "http://localhost:3002/api/actions/pay/DAw5ebjQBFruAFb7aehTTdbWixeTS3oS1BUAiZtKAvea?amount=1" \
  -H "Content-Type: application/json" \
  -d '{"account":"YOUR_PUBKEY"}'
```

## Blink Preview

Once deployed publicly, register at [dial.to](https://dial.to) for Blink rendering:
```
https://dial.to/?action=solana-action:https://your-domain.com/api/actions/pay
```
