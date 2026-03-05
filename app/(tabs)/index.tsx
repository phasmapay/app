import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWallet } from '../../src/context/WalletContext';
import { useBalances } from '../../src/hooks/useBalances';
import { getTierColor } from '../../src/services/skr';
import { GlassCard } from '../../src/components/GlassCard';
import { colors, space, radius, type } from '../../src/design/tokens';
import { getUnclaimedPayments } from '../../src/services/ghostPayment';
import { shortAddress, getConnection } from '../../src/utils/solana';
import { Image } from 'react-native';
import {
  ArrowUpIcon, ArrowDownIcon, GhostPayIcon, GhostReceiveIcon,
  GhostIcon, VaultIcon, SettingsIcon, EyeIcon, EyeOffIcon,
} from '../../src/components/Icons';
import { getVaultConfig, getVaultBalance, VaultConfig } from '../../src/services/vault';
import { getTransactions, StoredTransaction } from '../../src/services/storage';
import { relativeTime } from '../../src/utils/time';

const BALANCE_HIDDEN_KEY = 'phasma:balance_hidden';

// --- Action Button ---

type ActionConfig = {
  label: string;
  Icon: React.FC<{ size?: number; color?: string }>;
  bg: string;
  isPrimary: boolean;
  route: string;
  borderColor?: string;
};

const ACTIONS: ActionConfig[] = [
  { label: 'Pay', Icon: ArrowUpIcon, bg: colors.purple, isPrimary: true, route: '/pay' },
  { label: 'Receive', Icon: ArrowDownIcon, bg: colors.green, isPrimary: true, route: '/receive' },
  { label: 'Ghost Pay', Icon: GhostPayIcon, bg: colors.surface2, isPrimary: false, route: '/ghost-pay', borderColor: colors.purpleDim },
  { label: 'Ghost Recv', Icon: GhostReceiveIcon, bg: colors.surface2, isPrimary: false, route: '/ghost-receive', borderColor: colors.greenDim },
];

function ActionButton({ config }: { config: ActionConfig }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[style, { alignItems: 'center', flex: 1 }]}>
      <TouchableOpacity
        style={{
          width: 56, height: 56, borderRadius: 16,
          backgroundColor: config.bg, alignItems: 'center', justifyContent: 'center',
          elevation: config.isPrimary ? 8 : 0,
          ...(config.borderColor ? { borderWidth: 1.5, borderColor: config.borderColor } : {}),
        }}
        onPress={() => router.push(config.route as any)}
        onPressIn={() => { scale.value = withSpring(0.88, { damping: 20, stiffness: 300, mass: 0.8 }); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        activeOpacity={0.8}
      >
        <config.Icon size={22} color={config.isPrimary ? '#fff' : colors.text} />
      </TouchableOpacity>
      <Text style={{ fontSize: 12, color: colors.textSub, marginTop: 8, fontWeight: '500' }}>{config.label}</Text>
    </Animated.View>
  );
}

// --- Home Data ---

type HomeData = {
  claimableCount: number;
  vaultConfig: VaultConfig | null;
  vaultBalance: number;
  recentTxs: StoredTransaction[];
  balanceHidden: boolean;
};

const INITIAL_HOME: HomeData = {
  claimableCount: 0, vaultConfig: null, vaultBalance: 0, recentTxs: [], balanceHidden: false,
};

// --- Transaction Row ---

const TX_COLORS = {
  sent:     { color: colors.purple, bg: colors.purpleDim },
  received: { color: colors.green, bg: colors.greenDim },
};

function TxRow({ tx }: { tx: StoredTransaction }) {
  const direction = tx.type === 'received' ? 'received' : 'sent';
  const c = TX_COLORS[direction];
  const addr = direction === 'sent' ? tx.recipient : tx.sender;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 18, backgroundColor: c.bg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {direction === 'sent'
          ? <ArrowUpIcon size={16} color={c.color} />
          : <ArrowDownIcon size={16} color={c.color} />
        }
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
          {direction === 'sent' ? 'Sent' : 'Received'}
        </Text>
        <Text style={{ color: colors.textMute, fontSize: 11, marginTop: 2 }}>
          {relativeTime(tx.timestamp)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: c.color, fontWeight: '700', fontSize: 14 }}>
          {direction === 'sent' ? '-' : '+'}${tx.amount.toFixed(2)}
        </Text>
        <Text style={{ color: colors.textMute, fontSize: 10, marginTop: 2 }}>
          {shortAddress(addr)}
        </Text>
      </View>
    </View>
  );
}

// --- Main Screen ---

export default function HomeScreen() {
  const { publicKey, isConnected, connect, isConnecting } = useWallet();
  const { usdc, sol, skrStatus, isLoading, error, refresh } = useBalances(
    publicKey?.toBase58() ?? null
  );
  const [homeData, setHomeData] = useState<HomeData>(INITIAL_HOME);

  // Eye toggle animation
  const blur = useSharedValue(0);
  const realStyle = useAnimatedStyle(() => ({
    opacity: interpolate(blur.value, [0, 1], [1, 0]),
  }));
  const maskedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(blur.value, [0, 1], [0, 1]),
    position: 'absolute' as const,
  }));

  const toggleBalanceVisibility = useCallback(async () => {
    const next = !homeData.balanceHidden;
    setHomeData(prev => ({ ...prev, balanceHidden: next }));
    blur.value = withTiming(next ? 1 : 0, { duration: 200 });
    await AsyncStorage.setItem(BALANCE_HIDDEN_KEY, JSON.stringify(next));
  }, [homeData.balanceHidden]);

  // Consolidated data load
  useFocusEffect(
    useCallback(() => {
      if (!isConnected) return;
      let cancelled = false;

      async function load() {
        const [payments, cfg, txs, hiddenRaw] = await Promise.all([
          getUnclaimedPayments().catch(() => []),
          getVaultConfig().catch(() => null),
          getTransactions().catch(() => []),
          AsyncStorage.getItem(BALANCE_HIDDEN_KEY).catch(() => null),
        ]);
        if (cancelled) return;

        const bal = cfg ? await getVaultBalance(getConnection()).catch(() => 0) : 0;
        if (cancelled) return;

        const hidden = hiddenRaw === 'true';
        blur.value = hidden ? 1 : 0;

        setHomeData({
          claimableCount: payments.filter((p: any) => p.status === 'received' || p.status === 'failed').length,
          vaultConfig: cfg,
          vaultBalance: bal,
          recentTxs: txs.slice(0, 3),
          balanceHidden: hidden,
        });
      }

      load();
      return () => { cancelled = true; };
    }, [isConnected])
  );

  // Copied feedback
  const [copied, setCopied] = useState(false);
  const copyAddress = useCallback(() => {
    if (!publicKey) return;
    // Copy address — Clipboard removed to avoid deprecated API crash
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [publicKey]);

  // --- Disconnect State ---
  if (!isConnected) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24, backgroundColor: colors.surface0,
            alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            elevation: 4,
          }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 48, height: 48, borderRadius: 12 }} resizeMode="contain" />
          </View>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>PhasmaPay</Text>
          <Text style={{ color: colors.textSub, fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            NFC tap-to-pay on Solana{'\n'}Instant. Invisible. Unstoppable.
          </Text>
          <TouchableOpacity
            style={{
              marginTop: 40, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48,
              backgroundColor: colors.purple, elevation: 8,
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

  const maskedUsdc = usdc.toFixed(2).replace(/\d/g, '\u2022');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.base }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.purple} />}
      >
        {/* 1. Header — User pill left, Phasma + Devnet + Settings right */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, paddingBottom: 20 }}>
          <TouchableOpacity
            onPress={copyAddress}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surface2, borderRadius: radius.full,
              paddingHorizontal: 14, paddingVertical: 8,
            }}
          >
            <View style={{
              width: 28, height: 28, borderRadius: 14, backgroundColor: colors.purpleDim,
              alignItems: 'center', justifyContent: 'center', marginRight: 8,
            }}>
              <Text style={{ color: colors.purple, fontSize: 14, fontWeight: '700' }}>
                {publicKey!.toBase58().charAt(0)}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>
              {copied ? 'Copied!' : shortAddress(publicKey!.toBase58())}
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.greenDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
              <Text style={{ color: colors.green, fontSize: 11, fontWeight: '600' }}>Devnet</Text>
            </View>
            <TouchableOpacity
              style={{
                width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2,
                alignItems: 'center', justifyContent: 'center', marginLeft: 8,
              }}
              onPress={() => router.push('/(tabs)/settings' as any)}
            >
              <SettingsIcon size={18} color={colors.textSub} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error */}
        {error && (
          <TouchableOpacity
            onPress={refresh}
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: colors.error, fontSize: 12, flex: 1 }}>{error}</Text>
            <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700', marginLeft: 12 }}>Retry</Text>
          </TouchableOpacity>
        )}

        {/* 2. Balance Card */}
        <GlassCard glow={colors.purple} style={{ padding: space.xl, marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...type.label, color: colors.textSub }}>AVAILABLE BALANCE</Text>
            <TouchableOpacity onPress={toggleBalanceVisibility} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              {homeData.balanceHidden
                ? <EyeOffIcon size={20} color={colors.textSub} />
                : <EyeIcon size={20} color={colors.textSub} />
              }
            </TouchableOpacity>
          </View>
          {isLoading ? (
            <ActivityIndicator color={colors.purple} style={{ marginVertical: 20 }} />
          ) : (
            <View style={{ marginTop: 8 }}>
              <View style={{ position: 'relative' }}>
                <Animated.Text style={[{ ...type.amountHero, color: colors.text }, realStyle]}>
                  ${usdc.toFixed(2)}
                </Animated.Text>
                <Animated.Text style={[{ ...type.amountHero, color: colors.text }, maskedStyle]}>
                  ${maskedUsdc}
                </Animated.Text>
              </View>
              <Text style={{ color: colors.textMute, fontSize: 13, marginTop: 4 }}>USDC</Text>
            </View>
          )}

          {/* SKR tier strip inside balance card */}
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <View style={{
              width: 22, height: 22, borderRadius: 11, backgroundColor: '#1A1A2E',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Image source={require('../../assets/tokens/skr.png')} style={{ width: 14, height: 14 }} resizeMode="contain" />
            </View>
            <View style={{
              backgroundColor: `${getTierColor(skrStatus.tier)}20`,
              paddingHorizontal: 7, paddingVertical: 1.5, borderRadius: 5, marginLeft: 8,
            }}>
              <Text style={{ color: getTierColor(skrStatus.tier), fontSize: 10, fontWeight: '700' }}>
                {skrStatus.tier}
              </Text>
            </View>
            <Text style={{ color: colors.textSub, fontWeight: '600', fontSize: 12, marginLeft: 8 }}>
              {skrStatus.balance.toLocaleString()} SKR
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ color: colors.green, fontSize: 11, fontWeight: '600' }}>
              {(skrStatus.cashbackPct * 100).toFixed(1)}% back
            </Text>
          </View>
        </GlassCard>

        {/* 3. Quick Actions */}
        <View style={{ flexDirection: 'row', marginBottom: space.lg }}>
          {ACTIONS.map(a => <ActionButton key={a.label} config={a} />)}
        </View>

        {/* 4. Assets Card */}
        <GlassCard style={{ padding: space.base, marginBottom: space.lg }}>
          <Text style={{ ...type.label, color: colors.textSub, marginBottom: 12, paddingHorizontal: 4 }}>ASSETS</Text>

          {/* USDC */}
          <View style={s.assetRow}>
            <Image source={require('../../assets/tokens/usdc.png')} style={{ width: 36, height: 36, borderRadius: 18 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>USDC</Text>
              <Text style={{ color: colors.textMute, fontSize: 11 }}>USD Coin</Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
              {homeData.balanceHidden ? '\u2022\u2022\u2022\u2022' : `$${usdc.toFixed(2)}`}
            </Text>
          </View>

          <View style={s.separator} />

          {/* SOL */}
          <View style={s.assetRow}>
            <Image source={require('../../assets/tokens/sol.png')} style={{ width: 36, height: 36, borderRadius: 18 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>SOL</Text>
              <Text style={{ color: colors.textMute, fontSize: 11 }}>Solana</Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
              {homeData.balanceHidden ? '\u2022\u2022\u2022\u2022' : sol.toFixed(4)}
            </Text>
          </View>

          <View style={s.separator} />

          {/* SKR */}
          <View style={s.assetRow}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' }}>
              <Image source={require('../../assets/tokens/skr.png')} style={{ width: 24, height: 24 }} resizeMode="contain" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>SKR</Text>
              <Text style={{ color: colors.textMute, fontSize: 11 }}>Seeker</Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
              {homeData.balanceHidden ? '\u2022\u2022\u2022\u2022' : skrStatus.balance.toLocaleString()}
            </Text>
          </View>
        </GlassCard>

        {/* 5. Vault Card */}
        {homeData.vaultConfig?.enabled && (
          <TouchableOpacity onPress={() => router.push('/vault')} activeOpacity={0.7}>
            <GlassCard glow={colors.green} style={{ padding: space.base, marginBottom: space.base }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <VaultIcon size={20} color={colors.green} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Tap Vault</Text>
                    <Text style={{ color: colors.textSub, fontSize: 11, marginTop: 2 }}>
                      ${homeData.vaultBalance.toFixed(2)} USDC
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.green, fontWeight: '600', fontSize: 13 }}>
                    ${(homeData.vaultConfig.dailyLimit - homeData.vaultConfig.spentToday).toFixed(2)} left
                  </Text>
                  <Text style={{ color: colors.textSub, fontSize: 10 }}>
                    of ${homeData.vaultConfig.dailyLimit} daily
                  </Text>
                </View>
              </View>
              {/* Progress bar */}
              <View style={{ height: 3, backgroundColor: colors.surface2, borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                <View style={{
                  height: '100%', borderRadius: 2, backgroundColor: colors.green,
                  width: `${Math.min((homeData.vaultConfig.spentToday / homeData.vaultConfig.dailyLimit) * 100, 100)}%`,
                }} />
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}

        {/* 6. Claimable Banner */}
        {homeData.claimableCount > 0 && (
          <TouchableOpacity
            style={{
              backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 16, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: colors.warning,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
            onPress={() => router.push('/claimable')}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <GhostIcon size={20} color={colors.warning} />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 15 }}>
                  {homeData.claimableCount} unclaimed payment{homeData.claimableCount > 1 ? 's' : ''}
                </Text>
                <Text style={{ color: colors.textSub, fontSize: 11, marginTop: 2 }}>
                  Tap to claim to your wallet
                </Text>
              </View>
            </View>
            <Text style={{ color: colors.warning, fontSize: 20 }}>›</Text>
          </TouchableOpacity>
        )}

        {/* 7. Recent Transactions */}
        <GlassCard style={{ padding: space.base, marginBottom: space.base }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingHorizontal: 4 }}>
            <Text style={{ ...type.label, color: colors.textSub }}>RECENT TRANSACTIONS</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/history' as any)}>
              <Text style={{ color: colors.purple, fontSize: 12, fontWeight: '600' }}>See all</Text>
            </TouchableOpacity>
          </View>
          {homeData.recentTxs.length === 0 ? (
            <Text style={{ color: colors.textMute, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
              No transactions yet
            </Text>
          ) : (
            homeData.recentTxs.map((tx, i) => (
              <React.Fragment key={tx.signature}>
                <TxRow tx={tx} />
                {i < homeData.recentTxs.length - 1 && <View style={s.separator} />}
              </React.Fragment>
            ))
          )}
        </GlassCard>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  assetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
});
