import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, space, radius } from '../design/tokens';

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
};

export function EmptyState({ icon, title, subtitle, ctaLabel, onCtaPress }: EmptyStateProps) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxxl }}>
      <View style={{ marginBottom: space.lg }}>{icon}</View>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600', textAlign: 'center' }}>
        {title}
      </Text>
      {subtitle && (
        <Text
          style={{
            color: colors.textSub,
            fontSize: 13,
            marginTop: space.sm,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
      )}
      {ctaLabel && onCtaPress && (
        <TouchableOpacity
          onPress={onCtaPress}
          style={{
            marginTop: space.xl,
            backgroundColor: colors.purple,
            paddingHorizontal: space.xl,
            paddingVertical: space.md,
            borderRadius: radius.md,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
