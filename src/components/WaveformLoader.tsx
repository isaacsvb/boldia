/**
 * Audio-wave skeleton loader shown while waiting for the Azure response, so
 * the app never feels frozen. Pure Reanimated, runs on the UI thread at 60fps.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../theme/theme';

const BARS = 7;

function Bar({ index }: { index: number }) {
  const h = useSharedValue(0.3);
  useEffect(() => {
    h.value = withDelay(
      index * 90,
      withRepeat(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
  }, [h, index]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: h.value }],
    opacity: 0.6 + h.value * 0.4,
  }));

  return <Animated.View style={[styles.bar, style]} />;
}

export function WaveformLoader() {
  return (
    <View style={styles.row} accessibilityLabel="Analyzing your pronunciation">
      {Array.from({ length: BARS }).map((_, i) => (
        <Bar key={i} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 6,
  },
  bar: {
    width: 6,
    height: 48,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
