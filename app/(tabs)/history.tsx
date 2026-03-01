import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTransactions, getTotalCashback, getTotalSavedGas, StoredTransaction } from '../../src/services/storage';
import { shortAddress, explorerUrl } from '../../src/utils/solana';
import { SOLANA_NETWORK } from '../../src/utils/constants';
import { ArrowUpIcon, ArrowDownIcon, GhostIcon } from '../../src/components/Icons';
import { GlassCard } from '../../src/components/GlassCard';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, space, radius } from '../../src/design/tokens';

function TxRow({ tx }: { tx: StoredTransaction }) {
  const isReceived = tx.type === 'received' || tx.strategy === 'received';
  const date = new Date(tx.timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surface1, borderRadius: radius.lg,
        padding: space.base, marginBottom: space.md,
        borderLeftWidth: 2, borderLeftColor: isReceived ? colors.greenDim : colors.purpleDim,
      }}
      onPress={() => {
        if (tx.signature) {
          Linking.openURL(explorerUrl(tx.signature, SOLANA_NETWORK));
        }
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16, fontFamily: 'JetBrainsMono-Bold' }}>
            {isReceived ? '+' : '-'}${tx.amount.toFixed(2)} USDC
          </Text>
          <Text style={{ color: colors.textSub, fontSize: 12, marginTop: 4 }}>
            {isReceived ? 'Received via NFC' : `To: ${shortAddress(tx.recipient)}`}
          </Text>
          <Text style={{ color: colors.textSub, fontSize: 12 }}>{date}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{
            width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
            backgroundColor: isReceived ? colors.greenDim : colors.purpleDim,
          }}>
            {isReceived
              ? <ArrowDownIcon size={16} color={colors.green} />
              : <ArrowUpIcon size={16} color={colors.purple} />}
          </View>
          {tx.savedGas > 0 && (
            <Text style={{ color: colors.green, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
              Route saved ${tx.savedGas.toFixed(5)}
            </Text>
          )}
          {tx.cashback > 0 && (
            <Text style={{ color: colors.purple, fontSize: 12, fontWeight: '600', marginTop: 4 }}>
              +${tx.cashback.toFixed(4)} cashback
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [totalCashback, setTotalCashback] = useState(0);
  const [totalSavedGas, setTotalSavedGas] = useState(0);

  useEffect(() => {
    Promise.all([
      getTransactions(),
      getTotalCashback(),
      getTotalSavedGas(),
    ]).then(([txs, cashback, gas]) => {
      setTransactions(txs.filter(tx => tx.signature && tx.signature.length > 10));
      setTotalCashback(cashback);
      setTotalSavedGas(gas);
    });
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <View style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.base }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: space.xl }}>History</Text>
        {transactions.length > 0 && (
          <View style={{ flexDirection: 'row', gap: space.md, marginBottom: space.lg }}>
            <GlassCard style={{ flex: 1, padding: space.base }}>
              <Text style={{ color: colors.textSub, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Total Cashback
              </Text>
              <Text style={{ color: colors.purple, fontSize: 18, fontWeight: '700', fontFamily: 'JetBrainsMono-Bold' }}>
                ${totalCashback.toFixed(4)}
              </Text>
            </GlassCard>
            <GlassCard style={{ flex: 1, padding: space.base }}>
              <Text style={{ color: colors.textSub, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                Route Savings
              </Text>
              <Text style={{ color: colors.green, fontSize: 18, fontWeight: '700', fontFamily: 'JetBrainsMono-Bold' }}>
                ${totalSavedGas.toFixed(5)}
              </Text>
            </GlassCard>
          </View>
        )}
        {transactions.length === 0 ? (
          <EmptyState
            icon={<GhostIcon size={64} color={colors.textMute} />}
            title="No hauntings yet"
            subtitle="Tap to pay and see your history here"
          />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item, index) => item.signature || `tx-${index}`}
            renderItem={({ item }) => <TxRow tx={item} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
