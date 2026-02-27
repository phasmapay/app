import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { Connection } from '@solana/web3.js';
import { useWallet } from '../src/context/WalletContext';
import { useNfc } from '../src/hooks/useNfc';
import { useGhostReceive } from '../src/hooks/useGhostReceive';
import { RPC_URL } from '../src/utils/constants';

const SOLSCAN_BASE = 'https://solscan.io/tx';
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
          borderColor: active ? '#14F195' : '#9945FF',
          backgroundColor: active ? 'rgba(20,241,149,0.1)' : 'rgba(153,69,255,0.1)',
        }}
      >
        <Text style={{ fontSize: 48 }}>👻</Text>
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
    <Text style={{ color: remaining < 30 ? '#FF4747' : '#888', fontSize: 13, marginTop: 6 }}>
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

  // Each new polling session gets a fresh countdown key
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
      Alert.alert(
        'NFC is Disabled',
        'Please enable NFC in your device settings before continuing.',
        [{ text: 'OK' }],
      );
      return;
    }
    if (nfcState.status === 'unsupported') {
      Alert.alert(
        'NFC Not Supported',
        'Your device does not have NFC hardware. Ghost Receive requires NFC.',
        [{ text: 'OK' }],
      );
      return;
    }

    await hook.start(parsed, publicKey.toBase58(), authToken ?? '');
  };

  const handleClaim = () => {
    if (!publicKey) return;
    const connection = new Connection(RPC_URL, 'confirmed');
    hook.claim(connection, publicKey.toBase58(), authToken ?? '');
  };

  const { status } = hook.state;
  const isActive = ['generating', 'writing', 'polling', 'claiming'].includes(status);
  const canStart = !!publicKey && parseFloat(amount) > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>

          {/* Header */}
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 4 }}>
            Ghost Receive
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <View style={{
              backgroundColor: 'rgba(153,69,255,0.15)', borderRadius: 6,
              paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Text style={{ color: '#9945FF', fontSize: 11, fontWeight: '600' }}>
                👻 One-time address
              </Text>
            </View>
          </View>

          {/* Amount input */}
          <View style={{
            borderRadius: 16, padding: 20, marginBottom: 20,
            backgroundColor: '#0d0d0d',
            borderWidth: 1, borderColor: isFocused ? '#9945FF' : '#1f1f1f',
          }}>
            <Text style={{ color: '#888', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>
              Amount (USDC)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: '#9945FF', fontSize: 30, fontWeight: '700', marginRight: 8 }}>$</Text>
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 30, fontWeight: '700' }}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#333"
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
            <Text style={{ color: '#888', textAlign: 'center', fontSize: 14 }}>
              Enter amount and tap to generate a one-time payment address
            </Text>
          )}

          {status === 'generating' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color="#9945FF" size="small" />
              <Text style={{ color: '#9945FF', marginTop: 10, fontWeight: '600' }}>
                Generating ephemeral keypair...
              </Text>
            </View>
          )}

          {status === 'writing' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color="#9945FF" size="small" />
              <Text style={{ color: '#9945FF', marginTop: 10, fontWeight: '600' }}>
                Writing NFC tag...
              </Text>
              <Text style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
                Hold your phone near the NFC tag
              </Text>
              {hook.state.ephemeralPubkey && (
                <Text style={{ color: '#444', fontSize: 11, marginTop: 8 }}>
                  {truncate(hook.state.ephemeralPubkey)} (stealth)
                </Text>
              )}
            </View>
          )}

          {status === 'polling' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color="#9945FF" size="small" />
              <Text style={{ color: '#9945FF', marginTop: 10, fontWeight: '600' }}>
                Waiting for payment...
              </Text>
              <CountdownTimer key={timerKey.current} totalSec={POLL_TIMEOUT_SEC} />
              {hook.state.ephemeralPubkey && (
                <Text style={{ color: '#444', fontSize: 11, marginTop: 8 }}>
                  {truncate(hook.state.ephemeralPubkey)} (stealth)
                </Text>
              )}
            </View>
          )}

          {status === 'received' && (
            <View style={{
              backgroundColor: '#141414', borderRadius: 24, padding: 20,
              borderWidth: 1, borderColor: '#14F195',
            }}>
              <Text style={{ color: '#14F195', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
                💜 Payment Received!
              </Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 16 }}>
                ${hook.state.receivedAmount ? formatUsdcRaw(hook.state.receivedAmount) : amount} USDC
              </Text>
              <Text style={{ color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
                Funds are in the one-time address. Claim to sweep to your wallet.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#9945FF', borderRadius: 16,
                  paddingVertical: 18, alignItems: 'center',
                }}
                onPress={handleClaim}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Claim to Wallet</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'claiming' && (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator color="#9945FF" size="large" />
              <Text style={{ color: '#9945FF', marginTop: 12, fontWeight: '600', fontSize: 15 }}>
                Claiming funds...
              </Text>
              <Text style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
                Approve in your wallet
              </Text>
            </View>
          )}

          {status === 'done' && (
            <View style={{
              backgroundColor: '#141414', borderRadius: 24, padding: 20,
              borderWidth: 1, borderColor: '#14F195',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>✅</Text>
              <Text style={{ color: '#14F195', fontSize: 20, fontWeight: '700', marginBottom: 6 }}>
                Payment Claimed!
              </Text>
              {hook.state.receivedAmount && (
                <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 }}>
                  ${formatUsdcRaw(hook.state.receivedAmount)} USDC
                </Text>
              )}
              {hook.state.claimSignature && (
                <View style={{
                  backgroundColor: '#1a1a1a', borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, width: '100%',
                }}>
                  <Text style={{ color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    Solscan
                  </Text>
                  <Text style={{ color: '#14F195', fontSize: 12 }} numberOfLines={1} selectable>
                    {`${SOLSCAN_BASE}/${hook.state.claimSignature}`}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={{
                  backgroundColor: '#1f1f1f', borderRadius: 14,
                  paddingVertical: 14, paddingHorizontal: 32,
                }}
                onPress={hook.reset}
              >
                <Text style={{ color: '#888', fontWeight: '600' }}>New Session</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'error' && (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#FF4747', textAlign: 'center', marginBottom: 16, lineHeight: 20 }}>
                {hook.state.message ?? 'Something went wrong'}
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#9945FF', borderRadius: 16,
                  paddingVertical: 16, paddingHorizontal: 40,
                }}
                onPress={hook.reset}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Start button — only shown in idle state */}
          {status === 'idle' && (
            <View style={{ position: 'absolute', bottom: 32, left: 20, right: 20 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: canStart ? '#9945FF' : '#1f1f1f',
                  borderRadius: 18, paddingVertical: 20, alignItems: 'center',
                  shadowColor: canStart ? '#9945FF' : 'transparent',
                  shadowOpacity: 0.5, shadowRadius: 16,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: canStart ? 10 : 0,
                }}
                onPress={handleStart}
                disabled={!canStart}
              >
                <Text style={{ color: canStart ? '#fff' : '#444', fontWeight: '700', fontSize: 17 }}>
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
