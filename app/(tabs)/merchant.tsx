import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWallet } from '../../src/context/WalletContext';
import { useMode } from '../../src/context/ModeContext';
import { useMerchantReceive } from '../../src/hooks/useMerchantReceive';
import { getMerchantTransactions, getMerchantDaySummary, MerchantTransaction } from '../../src/services/storage';
import { GlassCard } from '../../src/components/GlassCard';
import { NfcRipple } from '../../src/components/NfcRipple';
import { EmptyState } from '../../src/components/EmptyState';
import { MerchantIcon } from '../../src/components/Icons';
import { colors, space, radius } from '../../src/design/tokens';

export default function MerchantScreen() {
  const { publicKey } = useWallet();
  const { businessName, setBusinessName } = useMode();
  const { state, startReceive, reset } = useMerchantReceive(publicKey?.toBase58() ?? null);
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([]);
  const [daySummary, setDaySummary] = useState({ count: 0, total: 0 });

  const loadData = useCallback(async () => {
    const [txResult, summary] = await Promise.all([
      getMerchantTransactions(),
      getMerchantDaySummary(),
    ]);
    setTransactions(txResult.transactions);
    setDaySummary(summary);
  }, []);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (state.status === 'received') loadData();
  }, [state.status]);

  const handleReceive = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    startReceive(amt);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <View style={{ flex: 1, paddingHorizontal: space.lg }}>
        {/* Header */}
        <View style={{ paddingTop: space.md, paddingBottom: space.lg }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Merchant</Text>
          <TextInput
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Business name"
            placeholderTextColor={colors.textMute}
            style={{
              color: colors.textSub,
              fontSize: 13,
              marginTop: space.xs,
              padding: 0,
            }}
          />
        </View>

        {/* Day Summary */}
        <GlassCard glow={colors.purple} style={{ padding: space.lg, marginBottom: space.lg }}>
          <Text style={{ color: colors.textSub, fontSize: 10, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' }}>
            Today
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.sm }}>
            <Text style={{ color: colors.text, fontSize: 32, fontWeight: '800', fontFamily: 'JetBrainsMono-Bold', letterSpacing: -1 }}>
              ${daySummary.total.toFixed(2)}
            </Text>
            <Text style={{ color: colors.textSub, fontSize: 13 }}>
              {daySummary.count} payment{daySummary.count !== 1 ? 's' : ''}
            </Text>
          </View>
        </GlassCard>

        {/* Receive Section */}
        {state.status === 'idle' && (
          <View style={{ marginBottom: space.lg }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMute}
                style={{
                  flex: 1,
                  backgroundColor: colors.surface1,
                  borderRadius: radius.md,
                  paddingHorizontal: space.base,
                  paddingVertical: space.md,
                  color: colors.text,
                  fontSize: 18,
                  fontFamily: 'JetBrainsMono-Bold',
                }}
              />
              <TouchableOpacity
                onPress={handleReceive}
                style={{
                  backgroundColor: colors.purple,
                  borderRadius: radius.md,
                  paddingHorizontal: space.xl,
                  justifyContent: 'center',
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Receive</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* NFC Writing / Waiting State */}
        {(state.status === 'writing' || state.status === 'waiting') && (
          <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
            <NfcRipple stage={state.status === 'writing' ? 'scanning' : 'processing'} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', marginTop: space.lg }}>
              {state.status === 'writing' ? 'Hold NFC tag...' : 'Waiting for payment...'}
            </Text>
            <Text style={{ color: colors.textSub, fontSize: 13, marginTop: space.sm }}>
              ${state.amount.toFixed(2)} USDC
            </Text>
            <TouchableOpacity onPress={reset} style={{ marginTop: space.xl }}>
              <Text style={{ color: colors.error, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Received State */}
        {state.status === 'received' && (
          <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
            <Text style={{ color: colors.green, fontSize: 48 }}>&#10003;</Text>
            <Text style={{ color: colors.green, fontSize: 20, fontWeight: '700', marginTop: space.sm }}>
              Payment Received!
            </Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800', fontFamily: 'JetBrainsMono-Bold', marginTop: space.sm }}>
              ${state.amount.toFixed(2)}
            </Text>
            <TouchableOpacity
              onPress={reset}
              style={{
                marginTop: space.xl,
                backgroundColor: colors.purple,
                paddingHorizontal: space.xl,
                paddingVertical: space.md,
                borderRadius: radius.md,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>New Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <View style={{ alignItems: 'center', paddingVertical: space.xxl }}>
            <Text style={{ color: colors.error, fontSize: 15, fontWeight: '600' }}>{state.message}</Text>
            <TouchableOpacity onPress={reset} style={{ marginTop: space.lg }}>
              <Text style={{ color: colors.purple, fontSize: 14, fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transaction Feed */}
        {state.status === 'idle' && (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.signature}
            ListEmptyComponent={
              <EmptyState
                icon={<MerchantIcon size={48} color={colors.textMute} />}
                title="No payments yet"
                subtitle="Tap Receive to accept your first payment"
              />
            }
            renderItem={({ item }) => (
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: space.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                <View>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', fontFamily: 'JetBrainsMono-Bold' }}>
                    +${item.amount.toFixed(2)}
                  </Text>
                  <Text style={{ color: colors.textSub, fontSize: 11, marginTop: 2 }}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={{ color: colors.green, fontSize: 11, fontWeight: '600' }}>Confirmed</Text>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
