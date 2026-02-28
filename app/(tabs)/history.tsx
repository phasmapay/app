import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTransactions, getTotalCashback, getTotalSavedGas, StoredTransaction } from '../../src/services/storage';
import { shortAddress, explorerUrl } from '../../src/utils/solana';
import { SOLANA_NETWORK } from '../../src/utils/constants';
import { ArrowUpIcon, ArrowDownIcon } from '../../src/components/Icons';

function TxRow({ tx }: { tx: StoredTransaction }) {
  const isReceived = tx.type === 'received' || tx.strategy === 'received';
  const date = new Date(tx.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      className="bg-[#141414] rounded-2xl p-4 mb-3 border border-[#1f1f1f]"
      style={{ borderLeftWidth: 2, borderLeftColor: isReceived ? '#14F19533' : '#9945FF22' }}
      onPress={() => {
        if (tx.signature) {
          const url = explorerUrl(tx.signature, SOLANA_NETWORK);
          console.log('[History] opening:', url);
          Linking.openURL(url);
        }
      }}
    >
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-white font-semibold text-base">
            {isReceived ? '+' : '-'}${tx.amount.toFixed(2)} USDC
          </Text>
          <Text className="text-[#888] text-xs mt-1">
            {isReceived ? 'Received via NFC' : `To: ${shortAddress(tx.recipient)}`}
          </Text>
          <Text className="text-[#888] text-xs">{date}</Text>
        </View>
        <View className="items-end">
          <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isReceived ? 'rgba(20,241,149,0.1)' : 'rgba(153,69,255,0.1)' }}>
            {isReceived
              ? <ArrowDownIcon size={16} color="#14F195" />
              : <ArrowUpIcon size={16} color="#9945FF" />}
          </View>
          {tx.savedGas > 0 && (
            <Text className="text-[#14F195] text-xs font-semibold mt-1">
              Route saved ${tx.savedGas.toFixed(5)}
            </Text>
          )}
          {tx.cashback > 0 && (
            <Text className="text-[#9945FF] text-xs font-semibold mt-1">
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
      // Only show transactions with real on-chain signatures
      setTransactions(txs.filter(tx => tx.signature && tx.signature.length > 10));
      setTotalCashback(cashback);
      setTotalSavedGas(gas);
    });
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <View className="flex-1 px-5 pt-4">
        <Text className="text-white text-2xl font-bold mb-6">History</Text>
        {transactions.length > 0 && (
          <View className="flex-row gap-3 mb-5">
            <View className="flex-1 bg-[#141414] rounded-2xl p-4 border border-[#1f1f1f]">
              <Text className="text-[#888] text-xs uppercase tracking-widest mb-1">Total Cashback</Text>
              <Text className="text-[#9945FF] text-lg font-bold">${totalCashback.toFixed(4)}</Text>
            </View>
            <View className="flex-1 bg-[#141414] rounded-2xl p-4 border border-[#1f1f1f]">
              <Text className="text-[#888] text-xs uppercase tracking-widest mb-1">Route Savings</Text>
              <Text className="text-[#14F195] text-lg font-bold">${totalSavedGas.toFixed(5)}</Text>
            </View>
          </View>
        )}
        {transactions.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#1f1f1f', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#333', fontSize: 28 }}>↓</Text>
            </View>
            <Text className="text-[#888] text-base mt-4">No transactions yet</Text>
            <Text className="text-[#555] text-sm mt-2">Tap to pay and see your history here</Text>
          </View>
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
