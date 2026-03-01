#!/bin/bash
# Deploy devnet SKR token for PhasmaPay
# Run from project root with Solana CLI configured to devnet

set -e

echo "Creating SKR token (6 decimals)..."
spl-token create-token --decimals 6

echo ""
echo "IMPORTANT: Copy the mint address above and update:"
echo "  1. src/utils/constants.ts — SKR_MINT fallback"
echo "  2. .env.development — EXPO_PUBLIC_SKR_MINT=<address>"
echo ""
echo "Then run:"
echo "  spl-token create-account <MINT>"
echo "  spl-token mint <MINT> 1000000"
