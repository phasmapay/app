import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTransactions, StoredTransaction } from '../../src/services/storage';
import { shortAddress, explorerUrl } from '../../src/utils/solana';
import { SOLANA_NETWORK } from '../../src/utils/constants';

function TxRow({ tx }: { tx: StoredTransaction }) {
  const date = new Date(tx.timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      className="bg-[#141414] rounded-2xl p-4 mb-3 border border-[#1f1f1f]"
      onPress={() => Linking.openURL(explorerUrl(tx.signature, SOLANA_NETWORK))}
    >
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-white font-semibold text-base">
            ${tx.amount.toFixed(2)} USDC
          </Text>
          <Text className="text-[#888] text-xs mt-1">
            To: {shortAddress(tx.recipient)}
          </Text>
          <Text className="text-[#888] text-xs">{date}</Text>
        </View>
        <View className="items-end">
          {tx.savedGas > 0 && (
            <Text className="text-[#14F195] text-xs font-semibold">
              AI saved ${(tx.savedGas * 100).toFixed(3)}
            </Text>
          )}
          {tx.cashback > 0 && (
            <Text className="text-[#9945FF] text-xs font-semibold mt-1">
              +${tx.cashback.toFixed(4)} cashback
            </Text>
          )}
          <Text className="text-[#555] text-xs mt-1 capitalize">{tx.strategy}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);

  useEffect(() => {
    getTransactions().then(setTransactions);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <View className="flex-1 px-5 pt-4">
        <Text className="text-white text-2xl font-bold mb-6">History</Text>
        {transactions.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text style={{ fontSize: 48 }}>👻</Text>
            <Text className="text-[#888] text-base mt-4">No transactions yet</Text>
            <Text className="text-[#555] text-sm mt-2">Tap to pay and see your history here</Text>
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.signature}
            renderItem={({ item }) => <TxRow tx={item} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
