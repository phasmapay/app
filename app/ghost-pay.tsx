import React, { useEffect, useCallback, useState } from 'react';
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
import { GuardianSteps, GuardianBadge } from '../src/components/GuardianSteps';
import { VaultIcon } from '../src/components/Icons';
import { colors, space, radius } from '../src/design/tokens';

export default function GhostPayScreen() {
  const { publicKey, authToken } = useWallet();
  const { state: nfcState, startScan, reset: resetNfc } = useNfc();
  const { skrStatus } = useBalances(publicKey?.toBase58() ?? null);
  const { state: payState, prepare, confirm, reset: resetPay } = usePayment(
    publicKey?.toBase58() ?? null,
    authToken,
    skrStatus.balance,
  );
  const [showGuardianDetails, setShowGuardianDetails] = useState(false);

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
          ghostMode: 'true',
          skrBalance: skrStatus.balance.toString(),
        },
      });
    }
  }, [payState.status]);

  const tapCount = React.useRef(0);
  const lastTapTime = React.useRef(0);
  const tapResetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleReset = useCallback(() => {
    paymentStarted.current = false;
    setShowGuardianDetails(false);
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

    if (__DEV__ && tapCount.current >= 3) {
      tapCount.current = 0;
      prepare(mockNfcRead('5HhoQzBkQ19W5vNZSK46tmUCtVPJNJDkxA83QdD21itN', 1.00));
    }
  }, [payState.status, prepare]);

  const isScanning = nfcState.status === 'scanning';
  const isProcessing = ['optimizing', 'guarding', 'signing', 'confirming'].includes(payState.status);
  const hasError = nfcState.status === 'error' || payState.status === 'error';
  const errorMessage =
    (nfcState.status === 'error' && nfcState.message) ||
    (payState.status === 'error' && payState.message) || '';

  const nfcStage = isScanning ? 'scanning' as const
    : isProcessing ? 'processing' as const
    : 'idle' as const;

  const getStatusText = () => {
    if (isScanning) return 'Hold near Ghost NFC tag...';
    if (payState.status === 'optimizing') return 'AI optimizing route...';
    if (payState.status === 'guarding') return 'Guardian scanning recipient...';
    if (payState.status === 'signing') return 'Approve in wallet...';
    if (payState.status === 'confirming') return 'Confirming on Solana...';
    if (hasError) return errorMessage;
    return 'Tap to scan Ghost NFC tag';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <View style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.xl, alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700', marginBottom: space.sm, alignSelf: 'flex-start' }}>
          Ghost Pay
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xxxl, alignSelf: 'flex-start' }}>
          <View style={{
            backgroundColor: colors.ghostDim, paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center',
          }}>
            <Text style={{ color: colors.ghost, fontSize: 11, fontWeight: '700' }}>GHOST MODE</Text>
          </View>
          <Text style={{ color: colors.textSub, fontSize: 13, marginLeft: space.sm }}>
            One-time address payment
          </Text>
        </View>

        {/* NFC Animation — ghost green */}
        <TouchableOpacity onPress={handleDevTap} activeOpacity={1}>
          <NfcRipple stage={nfcStage} ghost />
        </TouchableOpacity>

        {/* Status */}
        <Text
          style={{
            fontSize: 18, marginTop: space.xxl, fontWeight: '600', textAlign: 'center',
            color: hasError ? colors.error : isScanning ? colors.ghost : colors.textSub,
            letterSpacing: 0.5,
          }}
        >
          {getStatusText()}
        </Text>

        {/* Payment confirmation card */}
        {payState.status === 'awaiting_approval' && (
          <GlassCard glow={colors.ghost} style={{ width: '100%', padding: space.lg, marginTop: space.xl }}>
            {/* Guardian verdict badge */}
            <View style={{ marginBottom: space.md }}>
              <GuardianBadge risk={payState.guardian.risk} summary={payState.guardian.summary} />
            </View>

            <Text style={{ color: colors.textSub, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, marginBottom: space.md }}>
              Confirm Ghost Payment
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.ghostDim, borderRadius: radius.sm,
              padding: space.sm, marginBottom: space.md,
            }}>
              <Text style={{ color: colors.ghost, fontSize: 13, fontWeight: '600' }}>
                Ghost Mode — one-time address
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md }}>
              <Text style={{ color: colors.textSub }}>Amount</Text>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, fontFamily: 'JetBrainsMono-Bold' }}>
                ${payState.paymentData.amount.toFixed(2)} USDC
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md }}>
              <Text style={{ color: colors.textSub }}>Recipient</Text>
              <Text style={{ color: colors.textMute, fontSize: 14 }} numberOfLines={1}>
                {payState.paymentData.recipient
                  ? `${payState.paymentData.recipient.slice(0, 6)}...${payState.paymentData.recipient.slice(-4)} (stealth)`
                  : '-'}
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

            {/* Guardian details (collapsible) */}
            <TouchableOpacity
              onPress={() => setShowGuardianDetails(!showGuardianDetails)}
              style={{ marginBottom: space.md }}
            >
              <Text style={{ color: colors.ghost, fontSize: 12, fontWeight: '600' }}>
                {showGuardianDetails ? 'Hide analysis ▲' : 'View analysis ▼'}
              </Text>
            </TouchableOpacity>
            {showGuardianDetails && (
              <View style={{ marginBottom: space.md }}>
                <GuardianSteps verdict={payState.guardian} animate={false} />
              </View>
            )}

            {/* Vault info */}
            {payState.vaultEligible && (
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.greenDim, borderRadius: radius.sm,
                padding: space.sm, marginBottom: space.md,
              }}>
                <VaultIcon size={14} color={colors.green} />
                <Text style={{ color: colors.green, fontSize: 11, marginLeft: 6 }}>
                  Vault: ${payState.vaultRemaining.toFixed(2)} remaining today
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={{ gap: space.sm }}>
              {payState.vaultEligible && (
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.green, borderRadius: radius.lg,
                    paddingVertical: space.base, alignItems: 'center',
                    flexDirection: 'row', justifyContent: 'center',
                  }}
                  onPress={() => confirm(true)}
                >
                  <VaultIcon size={16} color="#000" />
                  <Text style={{ color: '#000', fontWeight: '700', marginLeft: 8 }}>Ghost Pay from Vault (instant)</Text>
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: colors.surface2, borderRadius: radius.lg, paddingVertical: space.base, alignItems: 'center' }}
                  onPress={handleReset}
                >
                  <Text style={{ color: colors.textSub, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1, borderRadius: radius.lg, paddingVertical: space.base, alignItems: 'center',
                    backgroundColor: payState.guardian.risk === 'red' ? colors.warning : colors.ghost,
                  }}
                  onPress={() => confirm(false)}
                >
                  <Text style={{ color: colors.base, fontWeight: '700' }}>
                    {payState.guardian.risk === 'red' ? 'Proceed Anyway' : 'Confirm'}
                  </Text>
                </TouchableOpacity>
              </View>
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
                  style={{ backgroundColor: colors.ghost, borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center' }}
                  onPress={handleReset}
                >
                  <Text style={{ color: colors.base, fontWeight: '700', fontSize: 17 }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : isScanning || isProcessing ? (
              <TouchableOpacity
                style={{ backgroundColor: colors.surface1, borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.surface2 }}
                onPress={handleReset}
              >
                <ActivityIndicator color={colors.ghost} />
                <Text style={{ color: colors.textSub, fontSize: 14, marginTop: space.sm }}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{ backgroundColor: colors.ghost, borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center' }}
                onPress={
                  nfcState.status === 'disabled'
                    ? () => Alert.alert('NFC is Disabled', 'Please enable NFC in your device settings.', [{ text: 'OK' }])
                    : nfcState.status === 'unsupported'
                    ? () => Alert.alert('NFC Not Supported', 'Your device does not have NFC hardware.', [{ text: 'OK' }])
                    : startScan
                }
              >
                <Text style={{ color: colors.base, fontWeight: '700', fontSize: 17 }}>Scan Ghost Tag</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
