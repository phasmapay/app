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
import { SkrTierBadge } from '../../src/components/SkrTierBadge';
import { getSkrTier, SkrTier } from '../../src/services/skr';
import { colors } from '../../src/design/tokens';

export default function ReceiptScreen() {
  const params = useLocalSearchParams<{
    signature: string;
    amount: string;
    recipient: string;
    cashback: string;
    savedGas: string;
    received: string;
    skrBalance: string;
    cashbackSig: string;
  }>();

  const amount = parseFloat(params.amount ?? '0');
  const cashback = parseFloat(params.cashback ?? '0');
  const savedGas = parseFloat(params.savedGas ?? '0');
  const skrBalance = parseFloat(params.skrBalance ?? '0');
  const isReceived = params.received === 'true';
  const cashbackSig = params.cashbackSig || null;

  const skrStatus = getSkrTier(skrBalance);
  const skrStatusAfter = getSkrTier(skrBalance + cashback);

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
      message: `Just paid $${amount.toFixed(2)} USDC via PhasmaPay\nTx: ${explorerUrl(params.signature, SOLANA_NETWORK)}`,
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 32, alignItems: 'center' }}>
        <Animated.View
          style={[circleStyle, {
            width: 96, height: 96, borderRadius: 48,
            backgroundColor: 'rgba(20,241,149,0.15)',
            borderWidth: 2, borderColor: colors.green,
            alignItems: 'center', justifyContent: 'center',
          }]}
        >
          <Animated.Text style={[checkStyle, { fontSize: 48, color: colors.green }]}>✓</Animated.Text>
        </Animated.View>

        <Text style={{
          color: colors.text, fontSize: 28, fontWeight: '700', marginTop: 16,
          textShadowColor: 'rgba(20,241,149,0.3)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 20,
        }}>
          {isReceived ? 'Payment Received!' : 'Payment Sent!'}
        </Text>
        <Text style={{ color: colors.textSub, fontSize: 14, marginTop: 8 }}>
          {isReceived ? 'USDC arrived in your wallet' : 'Transaction confirmed on Solana'}
        </Text>

        <View style={{
          width: '100%', backgroundColor: colors.surface1, borderRadius: 24,
          padding: 24, marginTop: 32, borderWidth: 1, borderColor: colors.borderLit,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: colors.textSub }}>Amount</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>
              ${amount.toFixed(2)} USDC
            </Text>
          </View>

          {savedGas > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: colors.textSub }}>Route Savings</Text>
              <Text style={{ color: colors.green, fontWeight: '700' }}>
                -${savedGas.toFixed(5)}
              </Text>
            </View>
          )}

          {cashback > 0 && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <SkrTierBadge tier={skrStatus.tier} size="sm" />
                  <Text style={{ color: colors.textSub, marginLeft: 8 }}>SKR Cashback</Text>
                </View>
                <Text style={{ color: colors.green, fontWeight: '700' }}>
                  +{cashback.toFixed(4)} SKR
                </Text>
              </View>
              {/* SKR tier progress bar */}
              {skrStatus.nextTier && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: colors.textMute, fontSize: 11 }}>
                      Progress to {skrStatus.nextTier}
                    </Text>
                    <Text style={{ color: colors.textMute, fontSize: 11 }}>
                      {skrStatus.nextTierRequirement.toFixed(1)} SKR to go
                    </Text>
                  </View>
                  <View style={{ height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{
                      height: '100%', borderRadius: 2, backgroundColor: colors.green,
                      width: `${Math.min(100, (skrBalance / (skrBalance + skrStatus.nextTierRequirement)) * 100)}%`,
                    }} />
                  </View>
                  {skrStatusAfter.tier !== skrStatus.tier && (
                    <Text style={{ color: colors.green, fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' }}>
                      Tier Up! Welcome to {skrStatusAfter.tier}
                    </Text>
                  )}
                </View>
              )}
              {cashbackSig && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(explorerUrl(cashbackSig, SOLANA_NETWORK))}
                  style={{ marginBottom: 16 }}
                >
                  <Text style={{ color: colors.purple, fontSize: 12, fontWeight: '600' }}>
                    View SKR cashback on Solscan ↗
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {params.signature ? (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.borderLit, paddingTop: 16 }}>
              <Text style={{ color: colors.textSub, fontSize: 12, marginBottom: 4 }}>Transaction</Text>
              <Text style={{ color: colors.textMute, fontSize: 12 }} numberOfLines={1}>
                {params.signature}
              </Text>
            </View>
          ) : null}
        </View>

        {params.signature ? (
          <>
            <TouchableOpacity
              style={{
                width: '100%', backgroundColor: colors.surface1, borderRadius: 16,
                paddingVertical: 16, alignItems: 'center', marginTop: 16,
                borderWidth: 1, borderColor: colors.purple,
              }}
              onPress={handleViewExplorer}
            >
              <Text style={{ color: colors.purple, fontWeight: '600' }}>View on Solscan</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                width: '100%', backgroundColor: colors.surface1, borderRadius: 16,
                paddingVertical: 16, alignItems: 'center', marginTop: 12,
                borderWidth: 1, borderColor: colors.borderLit,
              }}
              onPress={handleShare}
            >
              <Text style={{ color: colors.textSub, fontWeight: '600' }}>Share Receipt</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity
          style={{
            width: '100%', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 12,
            backgroundColor: colors.purple,
            shadowColor: colors.purple, shadowOpacity: 0.4, shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 }, elevation: 8,
          }}
          onPress={() => router.replace('/')}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
