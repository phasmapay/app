import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useWallet } from '../../src/context/WalletContext';
import { useBalances } from '../../src/hooks/useBalances';
import { getTierColor } from '../../src/services/skr';
import { shortAddress } from '../../src/utils/solana';
import { Image, Linking } from 'react-native';
import { ArrowUpIcon, ArrowDownIcon, ScanIcon, DiamondIcon, NotificationIcon, SolanaIcon, GhostIcon } from '../../src/components/Icons';

function ActionButton({
  label, IconComponent, onPress, color,
}: {
  label: string;
  IconComponent: React.FC<{ size?: number; color?: string }>;
  onPress: () => void;
  color: string;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, { alignItems: 'center', flex: 1 }]}>
      <TouchableOpacity
        style={{
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: color, alignItems: 'center', justifyContent: 'center',
          shadowColor: color, shadowOpacity: 0.3, shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 }, elevation: 6,
        }}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.92); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        activeOpacity={0.8}
      >
        <IconComponent size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: '#999', marginTop: 8, fontWeight: '500' }}>{label}</Text>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { publicKey, isConnected, connect, isConnecting } = useWallet();
  const { usdc, sol, skrStatus, isLoading, error, refresh } = useBalances(
    publicKey?.toBase58() ?? null
  );

  if (!isConnected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24, backgroundColor: '#151515',
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48, borderRadius: 12 }} resizeMode="contain" />
          </View>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>PhasmaPay</Text>
          <Text style={{ color: '#666', fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            NFC tap-to-pay on Solana{'\n'}Instant. Invisible. Unstoppable.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 40, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48,
              backgroundColor: '#9945FF',
            }}
            onPress={connect}
            disabled={isConnecting}
            activeOpacity={0.8}
          >
            {isConnecting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Connect Wallet</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tierColor = getTierColor(skrStatus.tier as any);
  const progress = skrStatus.nextTier
    ? skrStatus.balance / (skrStatus.balance + skrStatus.nextTierRequirement)
    : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor="#9945FF" />}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 40, height: 40, borderRadius: 12, backgroundColor: '#151515',
              alignItems: 'center', justifyContent: 'center', marginRight: 12,
            }}>
              <Image source={require('../../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6 }} resizeMode="contain" />
            </View>
            <View>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>PhasmaPay</Text>
              <Text style={{ color: '#555', fontSize: 11, marginTop: 1 }}>
                {shortAddress(publicKey!.toBase58())}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#14F19512', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
              <Text style={{ color: '#14F195', fontSize: 11, fontWeight: '600' }}>Devnet</Text>
            </View>
            <TouchableOpacity
              style={{
                width: 36, height: 36, borderRadius: 10, backgroundColor: '#151515',
                alignItems: 'center', justifyContent: 'center', marginLeft: 8,
              }}
              onPress={() => router.push('/(tabs)/settings' as any)}
            >
              <NotificationIcon size={18} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error */}
        {error && (
          <TouchableOpacity
            onPress={refresh}
            style={{
              backgroundColor: 'rgba(255,71,71,0.08)', borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#FF4747', fontSize: 12, flex: 1 }}>{error}</Text>
            <Text style={{ color: '#FF4747', fontSize: 12, fontWeight: '700', marginLeft: 12 }}>Retry</Text>
          </TouchableOpacity>
        )}

        {/* Balance Card */}
        <View style={{ backgroundColor: '#111', borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <Text style={{ color: '#777', fontSize: 12, fontWeight: '500', letterSpacing: 0.5 }}>Balance</Text>
          {isLoading ? (
            <ActivityIndicator color="#9945FF" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1 }}>
                  ${usdc.toFixed(2)}
                </Text>
                <Text style={{ color: '#555', fontSize: 14, marginLeft: 8 }}>USDC</Text>
              </View>
              <View style={{
                flexDirection: 'row', alignItems: 'center', marginTop: 12,
                backgroundColor: '#0a0a0a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
              }}>
                <SolanaIcon size={16} color="#14F195" />
                <Text style={{ color: '#ccc', fontSize: 14, fontWeight: '600', marginLeft: 6 }}>
                  {sol.toFixed(4)}
                </Text>
                <Text style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>SOL</Text>
              </View>
            </>
          )}

          {/* Actions */}
          <View style={{ flexDirection: 'row', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#1a1a1a' }}>
            <ActionButton label="Pay" IconComponent={ArrowUpIcon} onPress={() => router.push('/pay')} color="#9945FF" />
            <ActionButton label="Receive" IconComponent={ArrowDownIcon} onPress={() => router.push('/receive')} color="#333" />
            <ActionButton label="Scan" IconComponent={ScanIcon} onPress={() => router.push('/pay')} color="#333" />
            <ActionButton label="Ghost Pay" IconComponent={GhostIcon} onPress={() => router.push('/ghost-pay')} color="#1a0a2e" />
            <ActionButton label="Ghost Recv" IconComponent={GhostIcon} onPress={() => router.push('/ghost-receive')} color="#0a1a0e" />
          </View>
        </View>

        {/* SKR Rewards */}
        <View style={{ backgroundColor: '#111', borderRadius: 20, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <DiamondIcon size={16} color={tierColor} />
              <Text style={{ color: '#888', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginLeft: 6 }}>
                REWARDS
              </Text>
            </View>
            <View style={{ backgroundColor: `${tierColor}15`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
              <Text style={{ color: tierColor, fontSize: 11, fontWeight: '700' }}>{skrStatus.tier}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>
              {skrStatus.balance.toLocaleString()} SKR
            </Text>
            <Text style={{ color: '#14F195', fontSize: 13, fontWeight: '600' }}>
              {(skrStatus.cashbackPct * 100).toFixed(1)}% back
            </Text>
          </View>

          {skrStatus.nextTier && (
            <View style={{ marginTop: 14 }}>
              <View style={{ height: 4, backgroundColor: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                <View style={{
                  height: 4, backgroundColor: tierColor, borderRadius: 2,
                  width: `${Math.max(progress * 100, 3)}%`,
                }} />
              </View>
              <Text style={{ color: '#555', fontSize: 11, marginTop: 6 }}>
                {skrStatus.nextTierRequirement.toLocaleString()} more to {skrStatus.nextTier}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
