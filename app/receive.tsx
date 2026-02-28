import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withSpring,
} from 'react-native-reanimated';
import { PublicKey } from '@solana/web3.js';
import { router } from 'expo-router';
import { useWallet } from '../src/context/WalletContext';
import { useNfc } from '../src/hooks/useNfc';
import { buildSolanaPayUrl, enableForegroundNfc, disableForegroundNfc } from '../src/services/nfc';
import { getUsdcBalance } from '../src/services/payment';
import { saveTransaction } from '../src/services/storage';
import { getConnection } from '../src/utils/solana';
import { USDC_MINT } from '../src/utils/constants';

export default function ReceiveScreen() {
  const { publicKey } = useWallet();
  const { state, startEmulation, stopEmulation, reset } = useNfc();
  const [amount, setAmount] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Claim exclusive NFC foreground dispatch to suppress system app chooser
  useEffect(() => {
    enableForegroundNfc();
    return () => { disableForegroundNfc(); };
  }, []);

  const [receivedAmount, setReceivedAmount] = useState<number | null>(null);
  const baseBalanceRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isReady = state.status === 'emulating'; // waiting for payment via HCE
  const canStart = !!publicKey && parseFloat(amount) > 0;

  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Start polling when tag is written; stop on unmount or reset
  useEffect(() => {
    if (isReady && publicKey && receivedAmount === null) {
      const connection = getConnection();
      const mint = new PublicKey(USDC_MINT);

      // Snapshot baseline balance before polling
      getUsdcBalance(connection, publicKey, mint).then((bal) => {
        baseBalanceRef.current = bal;
      });

      pollRef.current = setInterval(async () => {
        const current = await getUsdcBalance(connection, publicKey, mint);
        const base = baseBalanceRef.current ?? 0;
        if (current > base) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          pulseScale.value = withSpring(1);
          reset();
          const received = current - base;

          // Fetch the latest tx signature for this account
          let txSig = '';
          let sender = '';
          try {
            const sigs = await connection.getSignaturesForAddress(publicKey, { limit: 1 });
            if (sigs.length > 0) {
              txSig = sigs[0].signature;
            }
          } catch {}

          saveTransaction({
            signature: txSig,
            sender,
            recipient: publicKey.toBase58(),
            amount: received,
            timestamp: Date.now(),
            savedGas: 0,
            cashback: 0,
            strategy: 'received',
            type: 'received',
          }).catch(() => {});
          router.replace({
            pathname: '/receipt/[signature]',
            params: {
              signature: txSig,
              amount: received.toString(),
              recipient: '',
              cashback: '0',
              savedGas: '0',
              received: 'true',
            },
          });
        }
      }, 3000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isReady, publicKey]);

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
    await startEmulation(publicKey.toBase58(), parsedAmount);
  };

  const handleStop = () => {
    pulseScale.value = withTiming(1);
    setReceivedAmount(null);
    baseBalanceRef.current = null;
    stopEmulation();
    reset();
  };

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
                editable={!isReady}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>
          </View>

          {publicKey && parseFloat(amount) > 0 && !isReady && (
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
                  borderColor: isReady ? '#14F195' : '#9945FF',
                  backgroundColor: isReady ? 'rgba(20,241,149,0.1)' : 'rgba(153,69,255,0.1)',
                }}
              >
                <Text style={{ fontSize: 20, color: isReady ? '#14F195' : '#9945FF', fontWeight: '700' }}>
                  {isReady ? 'TAP' : 'NFC'}
                </Text>
                <Text
                  className="text-sm font-semibold mt-2"
                  style={{ color: isReady ? '#14F195' : '#9945FF' }}
                >
                  {isReady ? 'Ready' : 'Idle'}
                </Text>
              </View>
            </Animated.View>
          </View>

          {receivedAmount !== null ? (
            <View style={{ backgroundColor: '#141414', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#14F195', alignItems: 'center' }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>✅</Text>
              <Text style={{ color: '#14F195', fontSize: 22, fontWeight: '700', marginBottom: 4 }}>
                Payment Received!
              </Text>
              <Text style={{ color: '#fff', fontSize: 32, fontWeight: '700', marginBottom: 20 }}>
                ${receivedAmount.toFixed(2)} USDC
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#1f1f1f', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 }}
                onPress={handleStop}
              >
                <Text style={{ color: '#888', fontWeight: '600' }}>New Payment</Text>
              </TouchableOpacity>
            </View>
          ) : isReady ? (
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
            </View>
          ) : null}

          {state.status === 'error' && (
            <Text className="text-red-500 text-center mt-4">{state.message}</Text>
          )}

          {/* Bottom button — standardized position */}
          {receivedAmount === null && (
            <View style={{ position: 'absolute', bottom: 90, left: 20, right: 20 }}>
              {isReady ? (
                <TouchableOpacity
                  style={{ backgroundColor: '#1f1f1f', borderRadius: 18, paddingVertical: 20, alignItems: 'center' }}
                  onPress={handleStop}
                >
                  <Text style={{ color: '#888', fontWeight: '700', fontSize: 17 }}>Stop</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={{
                    backgroundColor: canStart ? '#9945FF' : '#1f1f1f',
                    borderRadius: 18, paddingVertical: 20, alignItems: 'center',
                    shadowColor: canStart ? '#9945FF' : 'transparent',
                    shadowOpacity: 0.5, shadowRadius: 16,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: canStart ? 10 : 0,
                  }}
                  onPress={handleWriteTag}
                  disabled={!canStart}
                >
                  <Text style={{ color: canStart ? '#fff' : '#444', fontWeight: '700', fontSize: 17 }}>
                    Ready to Receive
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
