import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence,
} from 'react-native-reanimated';
import { useWallet } from '../src/context/WalletContext';
import { useNfc } from '../src/hooks/useNfc';
import { buildSolanaPayUrl } from '../src/services/nfc';

export default function ReceiveScreen() {
  const { publicKey } = useWallet();
  const { state, startEmulation, stopEmulation, reset } = useNfc();
  const [amount, setAmount] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Stop emulation on unmount
  useEffect(() => {
    return () => {
      stopEmulation();
    };
  }, [stopEmulation]);

  const handleStartEmulation = async () => {
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

    await startEmulation(publicKey.toBase58(), parsedAmount);
  };

  const handleStop = () => {
    pulseScale.value = withTiming(1);
    reset();
  };

  const isEmulating = state.status === 'emulating';

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-5 pt-6">
          <Text className="text-white text-3xl font-bold mb-2">Receive</Text>
          <Text className="text-[#888] text-sm mb-8">
            Enter amount and tap phones to receive payment
          </Text>

          <View className="rounded-2xl p-5 mb-6" style={{ backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: isFocused ? '#9945FF' : '#1f1f1f' }}>
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
                editable={!isEmulating}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>
          </View>

          {publicKey && parseFloat(amount) > 0 && !isEmulating && (
            <View className="bg-[#141414] rounded-2xl p-4 mb-4 border border-[#1f1f1f]">
              <Text className="text-[#888] text-xs uppercase tracking-widest mb-2">Payment URL</Text>
              <Text className="text-[#555] text-xs" numberOfLines={2} selectable>
                {buildSolanaPayUrl(publicKey.toBase58(), parseFloat(amount))}
              </Text>
            </View>
          )}

          <View className="items-center my-8">
            <Animated.View style={pulseStyle}>
              <View
                className="w-40 h-40 rounded-full items-center justify-center border-2"
                style={{
                  borderColor: isEmulating ? '#14F195' : '#9945FF',
                  backgroundColor: isEmulating ? 'rgba(20,241,149,0.1)' : 'rgba(153,69,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 20, color: isEmulating ? '#14F195' : '#9945FF', fontWeight: '700' }}>
                  {isEmulating ? 'TAP' : 'NFC'}
                </Text>
                <Text
                  className="text-sm font-semibold mt-2"
                  style={{ color: isEmulating ? '#14F195' : '#9945FF' }}
                >
                  {isEmulating ? 'Ready to receive' : 'Idle'}
                </Text>
              </View>
            </Animated.View>
          </View>

          {isEmulating ? (
            <View className="items-center">
              <Text className="text-[#14F195] text-base font-semibold mb-2">
                Tap customer's phone to receive ${parseFloat(amount).toFixed(2)}
              </Text>
              <Text className="text-[#555] text-xs mb-6">
                Hold phones back-to-back
              </Text>
              {publicKey && amount && (
                <TouchableOpacity
                  className="rounded-2xl py-4 px-8 items-center mb-4"
                  style={{ backgroundColor: '#141414', borderWidth: 1, borderColor: '#9945FF' }}
                  onPress={() => {
                    const url = buildSolanaPayUrl(publicKey.toBase58(), parseFloat(amount));
                    Share.share({
                      message: `Pay me $${parseFloat(amount).toFixed(2)} USDC via PhasmaPay:\n${url}`,
                      url,
                    });
                  }}
                >
                  <Text className="text-[#9945FF] font-semibold">Share Payment Link</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="rounded-2xl py-4 px-12 items-center"
                style={{ backgroundColor: '#1f1f1f' }}
                onPress={handleStop}
              >
                <Text className="text-[#888] font-semibold">Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              className="rounded-2xl py-5 items-center"
              style={{
                backgroundColor: '#9945FF',
                shadowColor: '#9945FF',
                shadowOpacity: 0.5,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 0 },
                elevation: 10,
              }}
              onPress={handleStartEmulation}
            >
              <Text className="text-white font-bold text-lg">Start Tap-to-Pay</Text>
            </TouchableOpacity>
          )}

          {state.status === 'error' && (
            <Text className="text-red-500 text-center mt-4">{state.message}</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
