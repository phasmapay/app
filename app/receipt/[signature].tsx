import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Linking, Share } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withDelay, Easing,
} from 'react-native-reanimated';
import { explorerUrl } from '../../src/utils/solana';
import { SOLANA_NETWORK } from '../../src/utils/constants';

export default function ReceiptScreen() {
  const params = useLocalSearchParams<{
    signature: string;
    amount: string;
    recipient: string;
    cashback: string;
    savedGas: string;
    received: string;
  }>();

  const amount = parseFloat(params.amount ?? '0');
  const cashback = parseFloat(params.cashback ?? '0');
  const savedGas = parseFloat(params.savedGas ?? '0');
  const isReceived = params.received === 'true';

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    opacity.value = withTiming(1, { duration: 300 });
    checkScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 200 }));
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

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
        <Animated.View
          style={[circleStyle, {
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: 'rgba(20,241,149,0.15)',
            borderWidth: 2, borderColor: '#14F195',
            alignItems: 'center', justifyContent: 'center',
          }]}
        >
          <Animated.Text style={[checkStyle, { fontSize: 48 }]}>✓</Animated.Text>
        </Animated.View>
        <Text className="text-white text-3xl font-bold mt-4" style={{ textShadowColor: 'rgba(20,241,149,0.3)', textShadowOffset: {width:0,height:0}, textShadowRadius: 20 }}>
          {isReceived ? 'Payment Received!' : 'Payment Sent!'}
        </Text>
        <Text className="text-[#888] text-sm mt-2">
          {isReceived ? 'USDC arrived in your wallet' : 'Transaction confirmed on Solana'}
        </Text>

        <View className="w-full bg-[#141414] rounded-3xl p-6 mt-8 border border-[#1f1f1f]">
          <View className="flex-row justify-between mb-4">
            <Text className="text-[#888]">Amount</Text>
            <Text className="text-white font-bold text-lg">${amount.toFixed(2)} USDC</Text>
          </View>

          {savedGas > 0 && (
            <View className="flex-row justify-between mb-4">
              <Text className="text-[#888]">AI Gas Savings</Text>
              <Text className="text-[#14F195] font-bold">
                -${savedGas.toFixed(5)}
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

          {params.signature ? (
            <View className="border-t border-[#1f1f1f] pt-4">
              <Text className="text-[#888] text-xs mb-1">Transaction</Text>
              <Text className="text-[#555] text-xs" numberOfLines={1}>
                {params.signature}
              </Text>
            </View>
          ) : null}
        </View>

        {params.signature ? (
          <>
            <TouchableOpacity
              className="w-full bg-[#141414] rounded-2xl py-4 items-center mt-4"
              style={{ borderWidth: 1, borderColor: '#9945FF' }}
              onPress={handleViewExplorer}
            >
              <Text style={{ color: '#9945FF', fontWeight: '600' }}>View on Solscan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="w-full bg-[#141414] rounded-2xl py-4 items-center mt-3 border border-[#1f1f1f]"
              onPress={handleShare}
            >
              <Text className="text-[#888] font-semibold">Share Receipt</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          className="w-full rounded-2xl py-4 items-center mt-3"
          style={{ backgroundColor: '#9945FF', shadowColor: '#9945FF', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 }}
          onPress={() => router.replace('/')}
        >
          <Text className="text-white font-bold">Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
