# PhasmaPay — Graveyard Hack Submission

## One-Liner

NFC tap-to-pay for USDC on Solana with ghost addresses — ephemeral keypairs that keep the merchant's real wallet off-chain.

## Long Description

Open any block explorer and search a merchant's crypto wallet. You can see every payment they ever received — amounts, senders, timestamps. Every crypto payment today is a privacy leak for the receiver. PhasmaPay fixes this with ghost addresses.

The core flow: merchant generates a fresh ephemeral keypair per payment. The ghost address is shared via NFC (physical tag or phone-to-phone HCE). Customer sends USDC to the ghost address via MWA. Merchant sweeps funds to their real wallet, closes the ephemeral account (reclaiming rent), and destroys the key. The merchant's actual address never appears on-chain in the customer's transaction. No address reuse, no linkability.

This ghost payment pattern is PhasmaPay's core contribution. Each payment creates a one-time address that receives funds and is immediately drained — ephemeral keypair lives only in memory for the duration of the session. The payer never sees the merchant's real address, and each payment uses a fresh keypair.

Standard mode also supported: Solana Pay URI written to NFC tags for fixed locations. Customer taps, wallet signs via MWA, USDC transferred directly without the privacy layer.

Route optimization via Jupiter v6 handles cases where customer holds SOL but needs to pay USDC — wraps the swap and payment into one transaction so the customer doesn't need to manually convert first.

SKR tiered cashback system (0.5%–3%) rewards payment volume. Payment requests also work as Solana Actions, shareable as Blinks — same payment infrastructure, two distribution channels.

Current ghost mode provides address isolation per payment. Future: Light Protocol for fully shielded transfers where amounts and recipients are hidden on-chain.

End goal: crypto rails invisible to both sides. Solana is the settlement layer, not the user experience.

## Bounty Responses

### Overall — Solana Foundation ($15K/$10K/$5K)

PhasmaPay introduces ephemeral "ghost addresses" for private NFC contactless payments on Solana — each payment generates a fresh keypair, receives USDC to it, and sweeps to the merchant's real wallet, so the merchant's address never appears in the payer's transaction. The app uses NFC for device-to-device payment coordination (phone-to-phone HCE, no physical tags required), Mobile Wallet Adapter v2 for transaction signing, SKR token integration for tiered loyalty rewards, and targets the Solana dApp Store as its distribution channel. The ghost payment pattern is a novel primitive for receiver privacy in contactless crypto payments — the merchant maintains complete privacy while customers settle directly on-chain with non-custodial USDC transfers.

### Torque — Loyalty ($1,000)

PhasmaPay integrates Torque SDK to track payment activity. The app implements tiered SKR-based loyalty — Ghost (0.5%), Bronze (1%), Silver (2%), Gold (3%) cashback — where tier progression is determined by the user's SKR token balance. Torque tracks payment events, creating a feedback loop between payment volume and reward tier advancement.

## Relevant Links

- GitHub: https://github.com/phasmapay/app
- APK: https://expo.dev/accounts/amrrobb/projects/phasmapay/builds/0294bc37-d728-4e39-831f-0a95ccecbd1d
- Video: https://drive.google.com/drive/folders/174K8g1-jy9XzaOkPZpDC1APJYDif9bwP?usp=sharing

### OrbitFlare — Blinks ($1,200)

PhasmaPay payment requests are exposed as Solana Actions via a REST endpoint, enabling merchants to generate payment Blinks shareable on social platforms. A merchant can create a payment link that works both as an NFC tag and as a shareable Blink — same payment infrastructure, two distribution channels. The Actions endpoint built on devnet with OrbitFlare RPC support for reliable transaction building.
