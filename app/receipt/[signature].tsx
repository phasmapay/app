import React from 'react';
import { View, Text, TouchableOpacity, Linking, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { explorerUrl } from '../../src/utils/solana';
import { SOLANA_NETWORK } from '../../src/utils/constants';

export default function ReceiptScreen() {
  const params = useLocalSearchParams<{
    signature: string;
    amount: string;
    recipient: string;
    cashback: string;
    savedGas: string;
  }>();

  const amount = parseFloat(params.amount ?? '0');
  const cashback = parseFloat(params.cashback ?? '0');
  const savedGas = parseFloat(params.savedGas ?? '0');

  const handleViewExplorer = () => {
    Linking.openURL(explorerUrl(params.signature, SOLANA_NETWORK));
  };

  const handleShare = async () => {
    await Share.share({
      message: `Just paid $${amount.toFixed(2)} USDC via PhasmaPay 👻\nTx: ${explorerUrl(params.signature, SOLANA_NETWORK)}`,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <View className="flex-1 px-5 pt-8 items-center">
        <Text style={{ fontSize: 72 }}>✅</Text>
        <Text className="text-white text-3xl font-bold mt-4">Payment Sent!</Text>
        <Text className="text-[#888] text-sm mt-2">Transaction confirmed on Solana</Text>

        <View className="w-full bg-[#141414] rounded-3xl p-6 mt-8 border border-[#1f1f1f]">
          <View className="flex-row justify-between mb-4">
            <Text className="text-[#888]">Amount</Text>
            <Text className="text-white font-bold text-lg">${amount.toFixed(2)} USDC</Text>
          </View>

          {savedGas > 0 && (
            <View className="flex-row justify-between mb-4">
              <Text className="text-[#888]">AI Gas Savings</Text>
              <Text className="text-[#14F195] font-bold">
                -${(savedGas * 100).toFixed(3)}
              </Text>
            </View>
          )}

          {cashback > 0 && (
            <View className="flex-row justify-between mb-4">
              <Text className="text-[#888]">SKR Cashback</Text>
              <Text className="text-[#9945FF] font-bold">
                +${cashback.toFixed(4)}
              </Text>
            </View>
          )}

          <View className="border-t border-[#1f1f1f] pt-4">
            <Text className="text-[#888] text-xs mb-1">Transaction</Text>
            <Text className="text-[#555] text-xs" numberOfLines={1}>
              {params.signature}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          className="w-full bg-[#141414] rounded-2xl py-4 items-center mt-4 border border-[#1f1f1f]"
          onPress={handleViewExplorer}
        >
          <Text className="text-[#9945FF] font-semibold">View on Solana Explorer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full bg-[#141414] rounded-2xl py-4 items-center mt-3 border border-[#1f1f1f]"
          onPress={handleShare}
        >
          <Text className="text-[#888] font-semibold">Share Receipt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full rounded-2xl py-4 items-center mt-3"
          style={{ backgroundColor: '#9945FF' }}
          onPress={() => router.replace('/')}
        >
          <Text className="text-white font-bold">Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
