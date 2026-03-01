import React from 'react';
import { View, Text } from 'react-native';
import { getTierColor, SkrTier } from '../services/skr';
import { radius } from '../design/tokens';

type SkrTierBadgeProps = {
  tier: SkrTier;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: { badge: 28, font: 10, glow: 48 },
  md: { badge: 40, font: 13, glow: 64 },
  lg: { badge: 56, font: 16, glow: 80 },
};

export function SkrTierBadge({ tier, size = 'md' }: SkrTierBadgeProps) {
  const color = getTierColor(tier);
  const s = SIZES[size];

  return (
    <View style={{ width: s.glow, height: s.glow, alignItems: 'center', justifyContent: 'center' }}>
      {/* Glow circle behind badge */}
      <View style={{
        position: 'absolute',
        width: s.glow,
        height: s.glow,
        borderRadius: s.glow / 2,
        backgroundColor: color,
        opacity: 0.15,
      }} />
      {/* Badge */}
      <View style={{
        width: s.badge,
        height: s.badge,
        borderRadius: s.badge / 2,
        backgroundColor: `${color}30`,
        borderWidth: 1.5,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ color, fontSize: s.font, fontWeight: '800' }}>
          {tier[0]}
        </Text>
      </View>
    </View>
  );
}
