import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withSpring,
} from 'react-native-reanimated';
import { useWallet } from '../src/context/WalletContext';
import { useNfc } from '../src/hooks/useNfc';
import { useGhostReceive } from '../src/hooks/useGhostReceive';
import { enableForegroundNfc, disableForegroundNfc } from '../src/services/nfc';
import { getConnection } from '../src/utils/solana';
import { colors, space, radius } from '../src/design/tokens';

const ghostIcon = require('../ghost.png');
const POLL_TIMEOUT_SEC = 180;

function formatUsdcRaw(raw: bigint): string {
  const num = Number(raw) / 1_000_000;
  return num.toFixed(2);
}

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function GhostPulse({ active }: { active: boolean }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(withTiming(1.12, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
      );
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })),
        -1,
      );
    } else {
      scale.value = withSpring(1);
      opacity.value = withTiming(0.7);
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <View
        style={{
          width: 140, height: 140, borderRadius: 70,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.green,
          backgroundColor: colors.greenDim,
        }}
      >
        <Image source={ghostIcon} style={{ width: 56, height: 56, tintColor: colors.green }} />
      </View>
    </Animated.View>
  );
}

function CountdownTimer({ totalSec }: { totalSec: number }) {
  const [remaining, setRemaining] = useState(totalSec);

  useEffect(() => {
    setRemaining(totalSec);
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [totalSec]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Text style={{ color: remaining < 30 ? colors.error : colors.textSub, fontSize: 13, marginTop: 6 }}>
      Times out in {mins}:{secs.toString().padStart(2, '0')}
    </Text>
  );
}

export default function GhostReceiveScreen() {
  const { publicKey, authToken } = useWallet();
  const { state: nfcState } = useNfc();
  const hook = useGhostReceive();
  const [amount, setAmount] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const timerKey = useRef(0);

  useEffect(() => {
    enableForegroundNfc();
    return () => { disableForegroundNfc(); };
  }, []);

  useEffect(() => {
    if (hook.state.status === 'done') {
      router.replace({
        pathname: '/receipt/[signature]',
        params: {
          signature: hook.state.claimSignature ?? '',
          amount: hook.state.receivedAmount ? (Number(hook.state.receivedAmount) / 1_000_000).toString() : amount,
          recipient: '',
          cashback: '0',
          savedGas: '0',
          received: 'true',
          ghostMode: 'true',
        },
      });
    }
  }, [hook.state.status]);

  useEffect(() => {
    if (hook.state.status === 'polling') {
      timerKey.current += 1;
    }
  }, [hook.state.status]);

  const handleStart = async () => {
    if (!publicKey) {
      Alert.alert('Error', 'Connect wallet first');
      return;
    }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }

    if (nfcState.status === 'disabled') {
      Alert.alert('NFC is Disabled', 'Please enable NFC in your device settings before continuing.', [{ text: 'OK' }]);
      return;
    }
    if (nfcState.status === 'unsupported') {
      Alert.alert('NFC Not Supported', 'Your device does not have NFC hardware. Ghost Receive requires NFC.', [{ text: 'OK' }]);
      return;
    }

    await hook.start(parsed, publicKey.toBase58(), authToken ?? '');
  };

  const handleClaim = (paymentId?: string) => {
    if (!publicKey) return;
    hook.claim(getConnection(), publicKey.toBase58(), authToken ?? '', paymentId ?? hook.state.currentPaymentId);
  };

  const { status } = hook.state;
  const isActive = ['generating', 'writing', 'polling', 'claiming'].includes(status);
  const canStart = !!publicKey && parseFloat(amount) > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>

          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: 4 }}>
            Ghost Receive
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <View style={{
              backgroundColor: colors.ghostDim, borderRadius: 6,
              paddingHorizontal: 8, paddingVertical: 3, flexDirection: 'row', alignItems: 'center',
            }}>
              <Text style={{ color: colors.ghost, fontSize: 11, fontWeight: '600' }}>
                One-time address
              </Text>
            </View>
          </View>

          {/* Amount input */}
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
                editable={!isActive}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </View>
          </View>

          {/* Ghost animation */}
          <View style={{ alignItems: 'center', marginVertical: 28 }}>
            <GhostPulse active={isActive} />
          </View>

          {/* State-specific content */}
          {status === 'idle' && (
            <Text style={{ color: colors.textSub, textAlign: 'center', fontSize: 14, marginBottom: 16 }}>
              Enter amount and tap to generate a one-time payment address
            </Text>
          )}

          {status === 'generating' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color={colors.green} size="small" />
              <Text style={{ color: colors.green, marginTop: 10, fontWeight: '600' }}>
                Generating ephemeral keypair...
              </Text>
            </View>
          )}

          {status === 'writing' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color={colors.green} size="small" />
              <Text style={{ color: colors.green, marginTop: 10, fontWeight: '600' }}>
                Writing NFC tag...
              </Text>
              <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 4 }}>
                Hold your phone near the NFC tag
              </Text>
              {hook.state.ephemeralPubkey && (
                <Text style={{ color: colors.textMute, fontSize: 11, marginTop: 8 }}>
                  {truncate(hook.state.ephemeralPubkey)} (stealth)
                </Text>
              )}
            </View>
          )}

          {status === 'polling' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color={colors.green} size="small" />
              <Text style={{ color: colors.green, marginTop: 10, fontWeight: '600' }}>
                Waiting for payment...
              </Text>
              <CountdownTimer key={timerKey.current} totalSec={POLL_TIMEOUT_SEC} />
              {hook.state.ephemeralPubkey && (
                <Text style={{ color: colors.textMute, fontSize: 11, marginTop: 8 }}>
                  {truncate(hook.state.ephemeralPubkey)} (stealth)
                </Text>
              )}
            </View>
          )}

          {status === 'received' && (
            <View style={{
              backgroundColor: colors.surface0, borderRadius: 24, padding: 20,
              borderWidth: 1, borderColor: colors.green, elevation: 2,
            }}>
              <Text style={{ color: colors.green, fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
                Payment Received!
              </Text>
              <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
                ${hook.state.receivedAmount ? formatUsdcRaw(hook.state.receivedAmount) : amount} USDC
              </Text>
              <Text style={{ color: colors.textMute, fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
                Funds are in the one-time address. Claim to sweep to your wallet.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.green, borderRadius: 16,
                  paddingVertical: 18, alignItems: 'center', elevation: 4,
                }}
                onPress={() => handleClaim()}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Claim to Wallet</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'claiming' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color={colors.green} size="large" />
              <Text style={{ color: colors.green, marginTop: 12, fontWeight: '600', fontSize: 15 }}>
                Claiming funds...
              </Text>
              <Text style={{ color: colors.textMute, fontSize: 12, marginTop: 4 }}>
                Approve in your wallet
              </Text>
            </View>
          )}

          {status === 'done' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color={colors.green} size="large" />
              <Text style={{ color: colors.green, marginTop: 12, fontWeight: '600' }}>Redirecting...</Text>
            </View>
          )}

          {status === 'error' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.error, textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
                {hook.state.message ?? 'Something went wrong'}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.green, borderRadius: 16,
                  paddingVertical: 16, paddingHorizontal: 40, elevation: 4,
                }}
                onPress={hook.reset}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Start button */}
          {status === 'idle' && (
            <View style={{ position: 'absolute', bottom: 90, left: 20, right: 20 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: canStart ? colors.green : colors.surface2,
                  borderRadius: 18, paddingVertical: 20, alignItems: 'center',
                  elevation: canStart ? 8 : 0,
                }}
                onPress={handleStart}
                disabled={!canStart}
              >
                <Text style={{ color: canStart ? '#fff' : colors.textMute, fontWeight: '700', fontSize: 17 }}>
                  Start Ghost Session
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
