import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../design/tokens';

type NfcStage = 'idle' | 'scanning' | 'read' | 'processing';

type NfcRippleProps = {
  stage: NfcStage;
  size?: number;
  ghost?: boolean;
};

function getStageColor(stage: NfcStage, ghost: boolean): string {
  if (ghost) return colors.ghost;
  switch (stage) {
    case 'scanning': return colors.purple;
    case 'read': return colors.green;
    case 'processing': return colors.purple;
    default: return colors.purple;
  }
}

function Ring({ delay, color, size }: { delay: number; color: string; size: number }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(withTiming(2.5, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }), -1, false),
    );
  }, [color]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

export function NfcRipple({ stage, size = 200, ghost = false }: NfcRippleProps) {
  const color = getStageColor(stage, ghost);
  const active = stage !== 'idle';

  if (!active) return null;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ring delay={0} color={color} size={size} />
      <Ring delay={600} color={color} size={size} />
      <Ring delay={1200} color={color} size={size} />
      {/* Center dot */}
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
