import React, { useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, withSpring, Easing,
} from 'react-native-reanimated';
import { useWallet } from '../src/context/WalletContext';
import { useNfc } from '../src/hooks/useNfc';
import { mockNfcRead } from '../src/services/nfc';
import { usePayment } from '../src/hooks/usePayment';
import { useBalances } from '../src/hooks/useBalances';

function NfcRipple({ scanning }: { scanning: boolean }) {
  const ring1 = useSharedValue(1);
  const ring2 = useSharedValue(1);
  const ring3 = useSharedValue(1);
  const opacity1 = useSharedValue(0.6);
  const opacity2 = useSharedValue(0.4);
  const opacity3 = useSharedValue(0.2);

  useEffect(() => {
    if (scanning) {
      ring1.value = withRepeat(withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) }), -1);
      ring2.value = withRepeat(
        withSequence(withTiming(1, { duration: 500 }), withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) })),
        -1
      );
      ring3.value = withRepeat(
        withSequence(withTiming(1, { duration: 1000 }), withTiming(1.6, { duration: 1500, easing: Easing.out(Easing.ease) })),
        -1
      );
      opacity1.value = withRepeat(withTiming(0, { duration: 1500 }), -1);
      opacity2.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 500 }), withTiming(0, { duration: 1500 })),
        -1
      );
      opacity3.value = withRepeat(
        withSequence(withTiming(0.2, { duration: 1000 }), withTiming(0, { duration: 1500 })),
        -1
      );
    } else {
      ring1.value = withSpring(1);
      ring2.value = withSpring(1);
      ring3.value = withSpring(1);
      opacity1.value = withTiming(0.6);
      opacity2.value = withTiming(0.4);
      opacity3.value = withTiming(0.2);
    }
  }, [scanning]);

  const style1 = useAnimatedStyle(() => ({
    transform: [{ scale: ring1.value }],
    opacity: opacity1.value,
  }));
  const style2 = useAnimatedStyle(() => ({
    transform: [{ scale: ring2.value }],
    opacity: opacity2.value,
  }));
  const style3 = useAnimatedStyle(() => ({
    transform: [{ scale: ring3.value }],
    opacity: opacity3.value,
  }));

  return (
    <View className="w-56 h-56 items-center justify-center">
      <Animated.View
        style={[style3, {
          position: 'absolute', width: 224, height: 224,
          borderRadius: 112, backgroundColor: 'rgba(153,69,255,0.08)',
        }]}
      />
      <Animated.View
        style={[style2, {
          position: 'absolute', width: 176, height: 176,
          borderRadius: 88, backgroundColor: 'rgba(153,69,255,0.12)',
        }]}
      />
      <Animated.View
        style={[style1, {
          position: 'absolute', width: 128, height: 128,
          borderRadius: 64, backgroundColor: 'rgba(153,69,255,0.18)',
        }]}
      />
      <View
        className="w-24 h-24 rounded-full items-center justify-center"
        style={{ backgroundColor: 'rgba(153,69,255,0.3)', borderWidth: 2, borderColor: '#9945FF' }}
      >
        <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 24, height: 32, borderWidth: 2, borderColor: '#9945FF', borderRadius: 4 }} />
          <View style={{ position: 'absolute', bottom: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#9945FF' }} />
        </View>
      </View>
    </View>
  );
}

export default function PayScreen() {
  const { publicKey, authToken } = useWallet();
  const { state: nfcState, startScan, reset: resetNfc } = useNfc();
  const { skrStatus } = useBalances(publicKey?.toBase58() ?? null);
  const { state: payState, prepare, confirm, reset: resetPay } = usePayment(
    publicKey?.toBase58() ?? null,
    authToken,
    skrStatus.balance
  );

  // Track whether we already kicked off payment from this NFC read
  const paymentStarted = React.useRef(false);

  // When NFC scan succeeds, kick off payment preparation (only once)
  useEffect(() => {
    if (nfcState.status === 'success' && !paymentStarted.current) {
      paymentStarted.current = true;
      prepare(nfcState.data);
    }
  }, [nfcState.status]);

  // When payment succeeds, navigate to receipt
  useEffect(() => {
    if (payState.status === 'success') {
      router.replace({
        pathname: '/receipt/[signature]',
        params: {
          signature: payState.result.signature,
          amount: payState.result.amount.toString(),
          recipient: payState.result.recipient,
          cashback: payState.cashback.toString(),
          savedGas: payState.savedGas.toString(),
        },
      });
    }
  }, [payState.status]);

  const tapCount = React.useRef(0);
  const lastTapTime = React.useRef(0);
  const tapResetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleReset = useCallback(() => {
    paymentStarted.current = false;
    resetNfc();
    resetPay();
  }, [resetNfc, resetPay]);

  const handleDevTap = useCallback(() => {
    if (payState.status !== 'idle') return;
    const now = Date.now();
    if (now - lastTapTime.current > 800) {
      tapCount.current = 1;
    } else {
      tapCount.current += 1;
    }
    lastTapTime.current = now;

    if (tapResetTimer.current) clearTimeout(tapResetTimer.current);
    tapResetTimer.current = setTimeout(() => { tapCount.current = 0; }, 800);

    if (tapCount.current >= 3) {
      tapCount.current = 0;
      const mockData = mockNfcRead(
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA3esVKk3X7DHhP',
        1.00
      );
      prepare(mockData);
    }
  }, [payState.status, prepare]);

  const isScanning = nfcState.status === 'scanning';
  const isProcessing = ['optimizing', 'signing', 'confirming'].includes(payState.status);
  const hasError = nfcState.status === 'error' || payState.status === 'error';
  const errorMessage =
    (nfcState.status === 'error' && nfcState.message) ||
    (payState.status === 'error' && payState.message) || '';

  const getStatusText = () => {
    if (isScanning) return 'Hold near NFC tag...';
    if (payState.status === 'optimizing') return 'AI optimizing route...';
    if (payState.status === 'signing') return 'Approve in wallet...';
    if (payState.status === 'confirming') return 'Confirming on Solana...';
    if (hasError) return errorMessage;
    return 'Tap to scan NFC tag';
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <View className="flex-1 px-5 pt-6 items-center">
        <Text className="text-white text-3xl font-bold mb-2 self-start">Pay</Text>
        <Text className="text-[#888] text-sm mb-10 self-start">
          Tap your phone to an NFC payment tag
        </Text>

        {/* NFC Animation */}
        <TouchableOpacity onPress={handleDevTap} activeOpacity={1}>
          <NfcRipple scanning={isScanning || isProcessing} />
        </TouchableOpacity>

        {/* Status */}
        <Text
          className="text-lg mt-8 font-semibold text-center"
          style={{ color: hasError ? '#FF4747' : isScanning ? '#9945FF' : '#888888', letterSpacing: 0.5 }}
        >
          {getStatusText()}
        </Text>

        {/* Payment confirmation card */}
        {payState.status === 'awaiting_approval' && (
          <View className="w-full bg-[#141414] rounded-3xl p-5 mt-6 border border-[#9945FF]">
            <Text className="text-[#888] text-xs uppercase tracking-widest mb-3">Confirm Payment</Text>
            <View className="flex-row justify-between mb-3">
              <Text className="text-[#888]">Amount</Text>
              <Text className="text-white font-bold text-lg">
                ${payState.paymentData.amount.toFixed(2)} USDC
              </Text>
            </View>
            <View className="flex-row justify-between mb-4">
              <Text className="text-[#888]">Strategy</Text>
              <Text className="text-[#14F195] font-semibold capitalize">
                {payState.optimization.strategy} transfer
              </Text>
            </View>
            {payState.optimization.savedGas > 0 && (
              <View className="flex-row justify-between mb-4">
                <Text className="text-[#888]">AI Savings</Text>
                <Text className="text-[#14F195] font-semibold">
                  ${payState.optimization.savedGas.toFixed(5)}
                </Text>
              </View>
            )}
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-[#1f1f1f] rounded-2xl py-4 items-center"
                onPress={handleReset}
              >
                <Text className="text-[#888] font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 rounded-2xl py-4 items-center"
                style={{ backgroundColor: '#9945FF' }}
                onPress={confirm}
              >
                <Text className="text-white font-bold">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Scan / Error buttons */}
        {payState.status !== 'awaiting_approval' && (
          <View className="absolute bottom-8 w-full px-5">
            {hasError ? (
              <View>
                <Text className="text-[#FF4747] text-center text-sm mb-4">{errorMessage}</Text>
                <TouchableOpacity
                  className="rounded-2xl py-5 items-center"
                  style={{ backgroundColor: '#9945FF' }}
                  onPress={handleReset}
                >
                  <Text className="text-white font-bold text-lg">Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : isScanning || isProcessing ? (
              <TouchableOpacity
                className="rounded-2xl py-5 items-center bg-[#141414] border border-[#1f1f1f]"
                onPress={handleReset}
              >
                <ActivityIndicator color="#9945FF" />
                <Text className="text-[#888] text-sm mt-2">Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="rounded-2xl py-5 items-center"
                style={{ backgroundColor: '#9945FF' }}
                onPress={
                  nfcState.status === 'disabled'
                    ? () => Alert.alert(
                        'NFC is Disabled',
                        'Please enable NFC in your device settings before continuing.',
                        [{ text: 'OK' }]
                      )
                    : nfcState.status === 'unsupported'
                    ? () => Alert.alert(
                        'NFC Not Supported',
                        'Your device does not have NFC hardware. NFC tap-to-pay requires a device with NFC.',
                        [{ text: 'OK' }]
                      )
                    : startScan
                }
              >
                <Text className="text-white font-bold text-lg">
                  Scan NFC Tag
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
