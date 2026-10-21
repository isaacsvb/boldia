/**
 * Animated circular score gauge. Sweeps from 0 to the final score on mount
 * using Reanimated-driven SVG stroke, color-coded by the score band.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useDerivedValue,
} from 'react-native-reanimated';
import { colors, scoreColor, typography } from '../theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number; // 0-100
  size?: number;
  label?: string;
}

export function ScoreRing({ score, size = 160, label = 'Pronunciation' }: Props) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(100, score)) / 100, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const color = scoreColor(score);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.surfaceElevated}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.score, { color }]}>{Math.round(score)}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  score: { ...typography.display, fontSize: 44 },
  label: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
