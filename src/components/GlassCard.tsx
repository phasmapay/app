import React from 'react';
import { View, ViewStyle } from 'react-native';
import { radius } from '../design/tokens';

type GlassCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  glow?: string;
};

export function GlassCard({ children, style, glow }: GlassCardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.06)',
          elevation: 2,
          overflow: 'hidden',
        },
        glow && {
          borderColor: `${glow}30`,
          elevation: 4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
