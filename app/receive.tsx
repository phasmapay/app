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
import { colors, space, radius } from '../src/design/tokens';

export default function ReceiveScreen() {
  const { publicKey } = useWallet();
  const { state, startEmulation, stopEmulation, reset } = useNfc();
  const [amount, setAmount] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    enableForegroundNfc();
    return () => { disableForegroundNfc(); };
  }, []);

  const [receivedAmount, setReceivedAmount] = useState<number | null>(null);
  const baseBalanceRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isReady = state.status === 'emulating';
  const canStart = !!publicKey && parseFloat(amount) > 0;

  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    if (isReady && publicKey && receivedAmount === null) {
      const connection = getConnection();
      const mint = new PublicKey(USDC_MINT);

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: 4 }}>Receive</Text>
          <Text style={{ color: colors.textSub, fontSize: 14, marginBottom: 24 }}>
            Enter amount and tap phones to receive payment
          </Text>

          <View style={{
            borderRadius: 16, padding: 20, marginBottom: 20,
            backgroundColor: colors.surface0,
            borderWidth: 1, borderColor: isFocused ? colors.green : colors.border,
            elevation: 1,
          }}>
            <Text style={{ color: colors.textSub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
              Amount (USDC)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.green, fontSize: 30, fontWeight: '700', marginRight: 8 }}>$</Text>
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 30, fontWeight: '700' }}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMute}
                editable={!isReady}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>
          </View>

          {publicKey && parseFloat(amount) > 0 && !isReady && (
            <View style={{
              backgroundColor: colors.surface1, borderRadius: 16, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: colors.border,
            }}>
              <Text style={{ color: colors.textSub, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
                Payment URL
              </Text>
              <Text style={{ color: colors.textMute, fontSize: 12 }} numberOfLines={2} selectable>
                {buildSolanaPayUrl(publicKey.toBase58(), parseFloat(amount)).url}
              </Text>
            </View>
          )}

          <View style={{ alignItems: 'center', marginVertical: 28 }}>
            <Animated.View style={pulseStyle}>
              <View
                style={{
                  width: 160, height: 160, borderRadius: 80,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.green,
                  backgroundColor: colors.greenDim,
                }}
              >
                <Text style={{ fontSize: 20, color: colors.green, fontWeight: '700' }}>
                  {isReady ? 'TAP' : 'NFC'}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 8, color: colors.green }}>
                  {isReady ? 'Ready' : 'Idle'}
                </Text>
              </View>
            </Animated.View>
          </View>

          {receivedAmount !== null ? (
            <View style={{
              backgroundColor: colors.surface0, borderRadius: 24, padding: 20,
              borderWidth: 1, borderColor: colors.green, alignItems: 'center', elevation: 2,
            }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>✅</Text>
              <Text style={{ color: colors.green, fontSize: 22, fontWeight: '700', marginBottom: 4 }}>
                Payment Received!
              </Text>
              <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700', marginBottom: 20 }}>
                ${receivedAmount.toFixed(2)} USDC
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.surface2, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 }}
                onPress={handleStop}
              >
                <Text style={{ color: colors.textSub, fontWeight: '600' }}>New Payment</Text>
              </TouchableOpacity>
            </View>
          ) : isReady ? (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.green, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                Tap customer's phone to receive ${parseFloat(amount).toFixed(2)}
              </Text>
              <Text style={{ color: colors.textMute, fontSize: 12 }}>
                Hold phones back-to-back
              </Text>
            </View>
          ) : null}

          {state.status === 'error' && (
            <Text style={{ color: colors.error, textAlign: 'center', marginTop: 16 }}>{state.message}</Text>
          )}

          {receivedAmount === null && (
            <View style={{ position: 'absolute', bottom: 90, left: 20, right: 20 }}>
              {isReady ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {publicKey && amount && (
                    <TouchableOpacity
                      style={{
                        flex: 1, backgroundColor: colors.surface0, borderRadius: 18,
                        paddingVertical: 20, alignItems: 'center',
                        borderWidth: 1, borderColor: colors.green,
                      }}
                      onPress={() => {
                        const { url } = buildSolanaPayUrl(publicKey.toBase58(), parseFloat(amount));
                        Share.share({
                          message: `Pay me $${parseFloat(amount).toFixed(2)} USDC via PhasmaPay:\n${url}`,
                          url,
                        });
                      }}
                    >
                      <Text style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>Share Link</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{
                      flex: 1, backgroundColor: colors.surface2, borderRadius: 18,
                      paddingVertical: 20, alignItems: 'center',
                    }}
                    onPress={handleStop}
                  >
                    <Text style={{ color: colors.textSub, fontWeight: '700', fontSize: 15 }}>Stop</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={{
                    backgroundColor: canStart ? colors.green : colors.surface2,
                    borderRadius: 18, paddingVertical: 20, alignItems: 'center',
                    elevation: canStart ? 8 : 0,
                  }}
                  onPress={handleWriteTag}
                  disabled={!canStart}
                >
                  <Text style={{ color: canStart ? '#fff' : colors.textMute, fontWeight: '700', fontSize: 17 }}>
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
