import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { SkrStatus, getTierColor } from '../services/skr';
import { SkrTierBadge } from './SkrTierBadge';
import { GlassCard } from './GlassCard';
import { colors, space } from '../design/tokens';

type SkrTierCardProps = {
  skrStatus: SkrStatus;
};

function AnimatedProgressBar({ progress, color }: { progress: number; color: string }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(progress, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(width.value * 100, 2)}%` as any,
  }));

  return (
    <View style={{ height: 4, backgroundColor: colors.surface2, borderRadius: 2, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 4, backgroundColor: color, borderRadius: 2 }, barStyle]} />
    </View>
  );
}

export function SkrTierCard({ skrStatus }: SkrTierCardProps) {
  const tierColor = getTierColor(skrStatus.tier);
  const progress = skrStatus.nextTier
    ? skrStatus.balance / (skrStatus.balance + skrStatus.nextTierRequirement)
    : 1;

  return (
    <GlassCard glow={tierColor} style={{ padding: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <SkrTierBadge tier={skrStatus.tier} size="md" />
        <View style={{ marginLeft: space.md, flex: 1 }}>
          <Text style={{ color: colors.textSub, fontSize: 10, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' }}>
            SKR Rewards
          </Text>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 2 }}>
            {skrStatus.balance.toLocaleString()}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: `${tierColor}20`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
            <Text style={{ color: tierColor, fontSize: 11, fontWeight: '700' }}>{skrStatus.tier}</Text>
          </View>
          <Text style={{ color: colors.green, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
            {(skrStatus.cashbackPct * 100).toFixed(1)}% back
          </Text>
        </View>
      </View>

      {skrStatus.nextTier && (
        <View style={{ marginTop: space.base }}>
          <AnimatedProgressBar progress={progress} color={tierColor} />
          <Text style={{ color: colors.textSub, fontSize: 11, marginTop: space.xs }}>
            {skrStatus.nextTierRequirement.toLocaleString()} more to {skrStatus.nextTier}
          </Text>
        </View>
      )}
    </GlassCard>
  );
}
