import React, { useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { useWallet } from '../../src/context/WalletContext';
import { useBalances } from '../../src/hooks/useBalances';
import { getTierColor, getTierEmoji } from '../../src/services/skr';
import { shortAddress } from '../../src/utils/solana';

function BalanceCard({ usdc, sol, isLoading }: { usdc: number; sol: number; isLoading: boolean }) {
  return (
    <View
      className="rounded-3xl p-6 mb-4"
      style={{
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#1f1f1f',
      }}
    >
      <Text className="text-[#888] text-xs uppercase tracking-widest mb-2">Total Balance</Text>
      {isLoading ? (
        <ActivityIndicator color="#9945FF" />
      ) : (
        <>
          <Text className="text-white text-4xl font-bold">
            ${usdc.toFixed(2)}
          </Text>
          <Text className="text-[#888] text-sm mt-1">
            {sol.toFixed(4)} SOL
          </Text>
        </>
      )}
    </View>
  );
}

function SkrCard({
  tier, balance, cashbackPct, nextTier, nextTierRequirement,
}: {
  tier: string;
  balance: number;
  cashbackPct: number;
  nextTier: string | null;
  nextTierRequirement: number;
}) {
  const color = getTierColor(tier as any);
  const emoji = getTierEmoji(tier as any);

  return (
    <View
      className="rounded-3xl p-5 mb-4"
      style={{
        backgroundColor: '#141414',
        borderWidth: 1,
        borderColor: '#1f1f1f',
      }}
    >
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-[#888] text-xs uppercase tracking-widest">SKR Rewards</Text>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${color}22` }}
        >
          <Text className="text-xs font-bold" style={{ color }}>
            {emoji} {tier}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between">
        <View>
          <Text className="text-white text-xl font-bold">
            {balance.toLocaleString()} SKR
          </Text>
          <Text className="text-[#888] text-sm mt-1">
            {(cashbackPct * 100).toFixed(1)}% cashback on every payment
          </Text>
        </View>
      </View>

      {nextTier && (
        <View className="mt-3 pt-3 border-t border-[#1f1f1f]">
          <Text className="text-[#555] text-xs">
            {nextTierRequirement.toLocaleString()} more SKR to reach {nextTier}
          </Text>
        </View>
      )}
    </View>
  );
}

function ActionButton({
  label, emoji, onPress, primary,
}: {
  label: string;
  emoji: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, { flex: 1 }]}>
      <TouchableOpacity
        className="rounded-2xl py-5 items-center mx-1"
        style={{
          backgroundColor: primary ? '#9945FF' : '#141414',
          borderWidth: primary ? 0 : 1,
          borderColor: '#1f1f1f',
        }}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95); }}
        onPressOut={() => { scale.value = withSpring(1); }}
      >
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
        <Text
          className="text-sm font-semibold mt-1"
          style={{ color: primary ? '#FFFFFF' : '#888888' }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { publicKey, isConnected, connect, isConnecting } = useWallet();
  const { usdc, sol, skrStatus, isLoading, refresh } = useBalances(
    publicKey?.toBase58() ?? null
  );

  if (!isConnected) {
    return (
      <SafeAreaView className="flex-1 bg-[#0a0a0a]">
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 80 }}>👻</Text>
          <Text className="text-white text-4xl font-bold mt-4 text-center">PhasmaPay</Text>
          <Text className="text-[#888] text-base mt-3 text-center">
            NFC tap-to-pay on Solana.{'\n'}Instant. Invisible. Unstoppable.
          </Text>
          <TouchableOpacity
            className="mt-10 rounded-2xl py-5 px-10 items-center"
            style={{ backgroundColor: '#9945FF' }}
            onPress={connect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Connect Wallet</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0a0a0a]">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor="#9945FF"
          />
        }
      >
        {/* Header */}
        <View className="flex-row justify-between items-center py-4 mb-2">
          <View>
            <Text className="text-white text-2xl font-bold">PhasmaPay 👻</Text>
            <Text className="text-[#555] text-xs mt-0.5">
              {shortAddress(publicKey!.toBase58())}
            </Text>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: '#14F19522' }}
          >
            <Text className="text-[#14F195] text-xs font-bold">● Devnet</Text>
          </View>
        </View>

        {/* Balances */}
        <BalanceCard usdc={usdc} sol={sol} isLoading={isLoading} />

        {/* Action Buttons */}
        <View className="flex-row mb-4">
          <ActionButton
            label="Pay"
            emoji="📱"
            onPress={() => router.push('/pay')}
            primary
          />
          <ActionButton
            label="Receive"
            emoji="📡"
            onPress={() => router.push('/receive')}
          />
        </View>

        {/* SKR Rewards */}
        <SkrCard
          tier={skrStatus.tier}
          balance={skrStatus.balance}
          cashbackPct={skrStatus.cashbackPct}
          nextTier={skrStatus.nextTier}
          nextTierRequirement={skrStatus.nextTierRequirement}
        />

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
