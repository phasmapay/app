import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  createCloseAccountInstruction,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import bs58 from 'bs58';
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  getUnclaimedPayments,
  removeUnclaimedPayment,
  updateUnclaimedPayment,
  keypairFromUnclaimed,
  UnclaimedPayment,
} from '../src/services/ghostPayment';
import { saveTransaction } from '../src/services/storage';
import { useWallet } from '../src/context/WalletContext';
import { getConnection } from '../src/utils/solana';
import { USDC_MINT, USDC_DECIMALS, APP_IDENTITY } from '../src/utils/constants';
import { GhostIcon } from '../src/components/Icons';

type ClaimableItem = UnclaimedPayment & {
  onChainBalance: bigint; // actual USDC in the ephemeral ATA
};

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ClaimableScreen() {
  const { publicKey, authToken } = useWallet();
  const [items, setItems] = useState<ClaimableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const loadClaimable = useCallback(async () => {
    setLoading(true);
    try {
      const connection = getConnection();
      const payments = await getUnclaimedPayments();
      const usdcMint = new PublicKey(USDC_MINT);

      // Check on-chain balance for each ephemeral key
      const results: ClaimableItem[] = [];
      const toRemove: string[] = [];

      await Promise.all(
        payments.map(async (p) => {
          try {
            const kp = keypairFromUnclaimed(p);
            const ata = getAssociatedTokenAddressSync(usdcMint, kp.publicKey);
            const account = await getAccount(connection, ata);
            if (account.amount > 0n) {
              results.push({ ...p, onChainBalance: account.amount });
            } else {
              // 0 balance — dead key, auto-remove
              toRemove.push(p.id);
            }
          } catch (e) {
            if (e instanceof TokenAccountNotFoundError) {
              // No ATA exists — if pending (never funded), keep for a bit; if old, remove
              const ageHours = (Date.now() - p.createdAt) / (1000 * 60 * 60);
              if (ageHours > 24 || p.status !== 'pending') {
                toRemove.push(p.id);
              }
              // Skip from display — no funds
            } else {
              // Network error — keep in list with stored amount
              results.push({ ...p, onChainBalance: BigInt(p.receivedAmount ?? 0) });
            }
          }
        }),
      );

      // Clean up dead keys
      for (const id of toRemove) {
        await removeUnclaimedPayment(id);
      }

      // Sort newest first
      results.sort((a, b) => b.createdAt - a.createdAt);
      setItems(results);
    } catch (e) {
      console.error('[Claimable] load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaimable();
  }, [loadClaimable]);

  const totalUsdc = items.reduce((sum, i) => sum + Number(i.onChainBalance), 0) / 1_000_000;

  const handleClaimAll = async () => {
    if (!publicKey || items.length === 0) return;
    setClaiming(true);

    try {
      const connection = getConnection();
      const merchantPubkey = publicKey;
      const usdcMint = new PublicKey(USDC_MINT);
      const destATA = getAssociatedTokenAddressSync(usdcMint, merchantPubkey);

      // Build tx BEFORE opening MWA — keeps Phantom session fast
      const keypairs: Keypair[] = [];
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction({ feePayer: merchantPubkey, blockhash, lastValidBlockHeight });
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 * items.length + 50_000 }));
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }));
      tx.add(createAssociatedTokenAccountIdempotentInstruction(merchantPubkey, destATA, merchantPubkey, usdcMint));

      for (const item of items) {
        const kp = keypairFromUnclaimed(item);
        keypairs.push(kp);
        const sourceATA = getAssociatedTokenAddressSync(usdcMint, kp.publicKey);
        tx.add(createTransferCheckedInstruction(sourceATA, usdcMint, destATA, kp.publicKey, item.onChainBalance, USDC_DECIMALS));
        tx.add(createCloseAccountInstruction(sourceATA, merchantPubkey, kp.publicKey));
      }

      // MWA session: only auth + sign + send (no RPC inside)
      const signature = await transact(async (wallet) => {
        try {
          await wallet.reauthorize({ auth_token: authToken ?? '', identity: APP_IDENTITY });
        } catch {
          await wallet.authorize({ cluster: 'solana:devnet' as any, identity: APP_IDENTITY });
        }

        const results = await wallet.signTransactions({ transactions: [tx] });
        if (!results || results.length === 0) throw new Error('Wallet rejected');
        const signedTx = results[0];

        for (const kp of keypairs) {
          signedTx.partialSign(kp);
        }

        const rawTx = signedTx.serialize();
        return await connection.sendRawTransaction(rawTx, { skipPreflight: true, maxRetries: 3 });
      });

      // Confirm with fallback
      try {
        await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
      } catch (confirmErr: unknown) {
        const status = await connection.getSignatureStatus(signature);
        if (!status?.value?.confirmationStatus) throw confirmErr;
      }

      // Cleanup storage + save history
      for (const item of items) {
        removeUnclaimedPayment(item.id).catch(() => {});
      }
      saveTransaction({
        signature,
        sender: 'ghost-claim-all',
        recipient: merchantPubkey.toBase58(),
        amount: totalUsdc,
        timestamp: Date.now(),
        savedGas: 0,
        cashback: 0,
        strategy: 'received',
        type: 'received',
      }).catch(() => {});

      setItems([]);
      router.replace({
        pathname: '/receipt/[signature]',
        params: {
          signature,
          amount: totalUsdc.toString(),
          recipient: '',
          cashback: '0',
          savedGas: '0',
          received: 'true',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Claimable] claim all failed:', err);
      Alert.alert('Claim Failed', message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: '#888', fontSize: 28 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>Claimable</Text>
            <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
              Ghost payments waiting to be swept
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#9945FF" size="large" />
            <Text style={{ color: '#888', marginTop: 12 }}>Checking on-chain balances...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <GhostIcon size={48} color="#333" />
            <Text style={{ color: '#555', fontSize: 16, marginTop: 16 }}>No claimable payments</Text>
            <Text style={{ color: '#444', fontSize: 13, marginTop: 4 }}>
              Ghost payments with funds will appear here
            </Text>
          </View>
        ) : (
          <>
            {/* Total banner */}
            <View style={{
              backgroundColor: '#111', borderRadius: 20, padding: 20, marginBottom: 16,
              borderWidth: 1, borderColor: '#14F195',
            }}>
              <Text style={{ color: '#888', fontSize: 12, fontWeight: '500', letterSpacing: 0.5 }}>
                TOTAL CLAIMABLE
              </Text>
              <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 }}>
                ${totalUsdc.toFixed(2)} USDC
              </Text>
              <Text style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                {items.length} payment{items.length > 1 ? 's' : ''} across {items.length} ephemeral address{items.length > 1 ? 'es' : ''}
              </Text>
            </View>

            {/* List */}
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={{
                  backgroundColor: '#141414', borderRadius: 16, padding: 16, marginBottom: 8,
                  borderWidth: 1, borderColor: '#1f1f1f',
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <View>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                      ${(Number(item.onChainBalance) / 1_000_000).toFixed(2)} USDC
                    </Text>
                    <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                      {truncate(item.ephemeralPubkey)}
                    </Text>
                    <Text style={{ color: '#444', fontSize: 10, marginTop: 1 }}>
                      {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{
                    backgroundColor: item.status === 'failed' ? 'rgba(255,71,71,0.1)' : 'rgba(20,241,149,0.1)',
                    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                  }}>
                    <Text style={{
                      color: item.status === 'failed' ? '#FF4747' : '#14F195',
                      fontSize: 11, fontWeight: '600',
                    }}>
                      {item.status === 'failed' ? 'Retry' : 'Ready'}
                    </Text>
                  </View>
                </View>
              )}
              style={{ flex: 1 }}
            />

            {/* Claim All button */}
            <TouchableOpacity
              style={{
                backgroundColor: claiming ? '#555' : '#9945FF',
                borderRadius: 18, paddingVertical: 20, alignItems: 'center',
                marginTop: 12, marginBottom: 16,
                shadowColor: '#9945FF', shadowOpacity: claiming ? 0 : 0.5,
                shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 10,
              }}
              onPress={handleClaimAll}
              disabled={claiming}
            >
              {claiming ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17, marginLeft: 8 }}>
                    Claiming...
                  </Text>
                </View>
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                  Claim All — ${totalUsdc.toFixed(2)} USDC
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
