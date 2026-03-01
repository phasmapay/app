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
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        },
        glow && {
          shadowColor: glow,
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 12,
        },
        style,
      ]}
    >
      {/* Top highlight streak for glass physicality */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      />
      {children}
    </View>
  );
}
