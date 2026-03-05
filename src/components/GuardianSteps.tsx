import React, { useEffect, useRef } from 'react';
import { View, Text, Animated as RNAnimated } from 'react-native';
import { GuardianStep, GuardianVerdict, RiskLevel } from '../services/guardian';
import { colors, space, radius } from '../design/tokens';

const riskColors: Record<RiskLevel, string> = {
  green: colors.green,
  yellow: colors.warning,
  red: colors.error,
};

function StepRow({ step, index, animate }: { step: GuardianStep; index: number; animate: boolean }) {
  const opacity = useRef(new RNAnimated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new RNAnimated.Value(animate ? 10 : 0)).current;

  useEffect(() => {
    if (!animate) return;
    const delay = index * 300;
    RNAnimated.parallel([
      RNAnimated.timing(opacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      RNAnimated.timing(translateY, { toValue: 0, duration: 250, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <RNAnimated.View
      style={{
        opacity,
        transform: [{ translateY }],
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
      }}
    >
      <Text style={{ fontSize: 14, marginRight: 8 }}>
        {step.passed ? '✓' : '✗'}
      </Text>
      <Text style={{ color: step.passed ? colors.textSub : colors.error, fontSize: 13, flex: 1 }}>
        {step.check}
      </Text>
      <Text style={{ color: step.passed ? colors.green : colors.error, fontSize: 12, fontWeight: '600' }}>
        {step.result}
      </Text>
    </RNAnimated.View>
  );
}

export function GuardianSteps({
  verdict,
  animate = true,
}: {
  verdict: GuardianVerdict;
  animate?: boolean;
}) {
  const badgeColor = riskColors[verdict.risk];

  return (
    <View>
      {/* Risk badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
        <View style={{
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: badgeColor, marginRight: 8,
        }} />
        <Text style={{ color: badgeColor, fontWeight: '700', fontSize: 14 }}>
          {verdict.summary}
        </Text>
        <Text style={{ color: colors.textSub, fontSize: 11, marginLeft: 'auto' }}>
          Score: {verdict.score}/100
        </Text>
      </View>

      {/* Steps */}
      {verdict.steps.map((step, i) => (
        <StepRow key={step.check} step={step} index={i} animate={animate} />
      ))}
    </View>
  );
}

export function GuardianBadge({ risk, summary }: { risk: RiskLevel; summary: string }) {
  const badgeColor = riskColors[risk];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: `${badgeColor}15`, borderRadius: radius.sm,
      paddingHorizontal: space.md, paddingVertical: space.xs,
      alignSelf: 'flex-start',
    }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: badgeColor, marginRight: 6 }} />
      <Text style={{ color: badgeColor, fontSize: 12, fontWeight: '600' }}>{summary}</Text>
    </View>
  );
}
