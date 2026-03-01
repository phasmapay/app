import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const COLORS = ['#9945FF', '#14F195', '#00FF88', '#FFD700', '#FF3B5C'];
const PARTICLE_COUNT = 40;

type Particle = {
  angle: number;
  distance: number;
  color: string;
  size: number;
  delay: number;
};

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    angle: Math.random() * Math.PI * 2,
    distance: 80 + Math.random() * 120,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 4 + Math.random() * 4,
    delay: Math.random() * 100,
  }));
}

function ConfettiParticle({ particle }: { particle: Particle }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      particle.delay,
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const x = Math.cos(particle.angle) * particle.distance * p;
    const y = Math.sin(particle.angle) * particle.distance * p + 40 * p * p; // gravity
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale: 1 - p * 0.5 }],
      opacity: 1 - p,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

type ConfettiBurstProps = {
  trigger: boolean;
};

export function ConfettiBurst({ trigger }: ConfettiBurstProps) {
  const [particles, setParticles] = React.useState<Particle[]>([]);

  useEffect(() => {
    if (trigger) {
      setParticles(generateParticles());
    }
  }, [trigger]);

  if (!trigger || particles.length === 0) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        width: 0,
        height: 0,
      }}
      pointerEvents="none"
    >
      {particles.map((p, i) => (
        <ConfettiParticle key={i} particle={p} />
      ))}
    </View>
  );
}
