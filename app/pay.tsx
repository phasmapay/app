import React, { useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useWallet } from '../src/context/WalletContext';
import { useNfc } from '../src/hooks/useNfc';
import { mockNfcRead, enableForegroundNfc, disableForegroundNfc } from '../src/services/nfc';
import { usePayment } from '../src/hooks/usePayment';
import { useBalances } from '../src/hooks/useBalances';
import { NfcRipple } from '../src/components/NfcRipple';
import { GlassCard } from '../src/components/GlassCard';
import { colors, space, radius } from '../src/design/tokens';

export default function PayScreen() {
  const { publicKey, authToken } = useWallet();
  const { state: nfcState, startScan, reset: resetNfc } = useNfc();
  const { skrStatus } = useBalances(publicKey?.toBase58() ?? null);
  const { state: payState, prepare, confirm, reset: resetPay } = usePayment(
    publicKey?.toBase58() ?? null,
    authToken,
    skrStatus.balance
  );

  useEffect(() => {
    enableForegroundNfc();
    return () => { disableForegroundNfc(); };
  }, []);

  const paymentStarted = React.useRef(false);

  useEffect(() => {
    if (nfcState.status === 'success' && !paymentStarted.current) {
      paymentStarted.current = true;
      prepare(nfcState.data);
    }
  }, [nfcState.status]);

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

  const nfcStage = isScanning ? 'scanning' as const
    : isProcessing ? 'processing' as const
    : 'idle' as const;

  const getStatusText = () => {
    if (isScanning) return 'Hold near NFC tag...';
    if (payState.status === 'optimizing') return 'AI optimizing route...';
    if (payState.status === 'signing') return 'Approve in wallet...';
    if (payState.status === 'confirming') return 'Confirming on Solana...';
    if (hasError) return errorMessage;
    return 'Tap to scan NFC tag';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <View style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.xl, alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: space.sm, alignSelf: 'flex-start' }}>
          Pay
        </Text>
        <Text style={{ color: colors.textSub, fontSize: 14, marginBottom: space.xxxl, alignSelf: 'flex-start' }}>
          Tap your phone to an NFC payment tag
        </Text>

        {/* NFC Animation */}
        <TouchableOpacity onPress={handleDevTap} activeOpacity={1}>
          <NfcRipple stage={nfcStage} />
        </TouchableOpacity>

        {/* Status */}
        <Text
          style={{
            fontSize: 18, marginTop: space.xxl, fontWeight: '600', textAlign: 'center',
            color: hasError ? colors.error : isScanning ? colors.purple : colors.textSub,
            letterSpacing: 0.5,
          }}
        >
          {getStatusText()}
        </Text>

        {/* Payment confirmation card */}
        {payState.status === 'awaiting_approval' && (
          <GlassCard glow={colors.purple} style={{ width: '100%', padding: space.lg, marginTop: space.xl }}>
            <Text style={{ color: colors.textSub, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: space.md }}>
              Confirm Payment
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md }}>
              <Text style={{ color: colors.textSub }}>Amount</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, fontFamily: 'JetBrainsMono-Bold' }}>
                ${payState.paymentData.amount.toFixed(2)} USDC
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.base }}>
              <Text style={{ color: colors.textSub }}>Strategy</Text>
              <Text style={{ color: colors.green, fontWeight: '600', textTransform: 'capitalize' }}>
                {payState.optimization.strategy} transfer
              </Text>
            </View>
            {payState.optimization.savedGas > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.base }}>
                <Text style={{ color: colors.textSub }}>Route Savings</Text>
                <Text style={{ color: colors.green, fontWeight: '600' }}>
                  ${payState.optimization.savedGas.toFixed(5)}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.lg, paddingVertical: space.base, alignItems: 'center' }}
                onPress={handleReset}
              >
                <Text style={{ color: colors.textSub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: colors.purple, borderRadius: radius.lg, paddingVertical: space.base, alignItems: 'center' }}
                onPress={confirm}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        )}

        {/* Bottom buttons */}
        {payState.status !== 'awaiting_approval' && (
          <View style={{ position: 'absolute', bottom: 90, left: space.lg, right: space.lg }}>
            {hasError ? (
              <View>
                <Text style={{ color: colors.error, textAlign: 'center', fontSize: 14, marginBottom: space.base }}>{errorMessage}</Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.purple, borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center' }}
                  onPress={handleReset}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : isScanning || isProcessing ? (
              <TouchableOpacity
                style={{ backgroundColor: colors.surface1, borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.surface2 }}
                onPress={handleReset}
              >
                <ActivityIndicator color={colors.purple} />
                <Text style={{ color: colors.textSub, fontSize: 14, marginTop: space.sm }}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{ backgroundColor: colors.purple, borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center' }}
                onPress={
                  nfcState.status === 'disabled'
                    ? () => Alert.alert('NFC is Disabled', 'Please enable NFC in your device settings before continuing.', [{ text: 'OK' }])
                    : nfcState.status === 'unsupported'
                    ? () => Alert.alert('NFC Not Supported', 'Your device does not have NFC hardware.', [{ text: 'OK' }])
                    : startScan
                }
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>Scan NFC Tag</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
