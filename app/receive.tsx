import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
} from 'react-native-reanimated';
import { useWallet } from '../src/context/WalletContext';
import { useNfc } from '../src/hooks/useNfc';

export default function ReceiveScreen() {
  const { publicKey } = useWallet();
  const { state, writeTag, reset } = useNfc();
  const [amount, setAmount] = useState('');

  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleWriteTag = async () => {
    if (!publicKey) {
      Alert.alert('Error', 'Connect wallet first');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }

    pulseScale.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1
    );

    await writeTag(publicKey.toBase58(), parsedAmount);
    pulseScale.value = withTiming(1);
  };

  const isWriting = state.status === 'writing';
  const isWritten = state.status === 'written';

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-5 pt-6">
          <Text className="text-white text-3xl font-bold mb-2">Receive</Text>
          <Text className="text-[#888] text-sm mb-8">
            Enter amount and tap to write NFC tag
          </Text>

          <View className="bg-[#141414] rounded-2xl p-5 mb-6 border border-[#1f1f1f]">
            <Text className="text-[#888] text-xs uppercase tracking-widest mb-3">Amount (USDC)</Text>
            <View className="flex-row items-center">
              <Text className="text-[#9945FF] text-3xl font-bold mr-2">$</Text>
              <TextInput
                className="flex-1 text-white text-3xl font-bold"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#333"
              />
            </View>
          </View>

          <View className="items-center my-8">
            <Animated.View style={pulseStyle}>
              <View
                className="w-40 h-40 rounded-full items-center justify-center border-2"
                style={{
                  borderColor: isWritten ? '#14F195' : '#9945FF',
                  backgroundColor: isWritten ? 'rgba(20,241,149,0.1)' : 'rgba(153,69,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 56 }}>{isWritten ? '✅' : '📡'}</Text>
                <Text
                  className="text-sm font-semibold mt-2"
                  style={{ color: isWritten ? '#14F195' : '#9945FF' }}
                >
                  {isWritten ? 'Tag Written!' : isWriting ? 'Writing...' : 'Ready'}
                </Text>
              </View>
            </Animated.View>
          </View>

          {isWritten ? (
            <View className="items-center">
              <Text className="text-[#14F195] text-base font-semibold mb-2">
                NFC tag ready! Customer can tap now.
              </Text>
              <TouchableOpacity onPress={reset}>
                <Text className="text-[#888] text-sm underline">Write another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              className="rounded-2xl py-5 items-center"
              style={{
                backgroundColor: isWriting ? '#1f1f1f' : '#9945FF',
              }}
              onPress={handleWriteTag}
              disabled={isWriting}
            >
              {isWriting ? (
                <ActivityIndicator color="#9945FF" />
              ) : (
                <Text className="text-white font-bold text-lg">Write NFC Tag</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
