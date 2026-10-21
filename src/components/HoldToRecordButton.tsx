/**
 * Hold-to-record mic button — the core shadowing interaction.
 *
 * Press & hold starts recording (haptic + pulsing glow ring driven by live
 * mic metering); release stops and fires onComplete(uri). Built on
 * react-native-gesture-handler + Reanimated for a native 60fps feel.
 */
import React, { useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSpring,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme/theme';
import { Recorder } from '../services/recorder';
import { haptics } from '../utils/haptics';

interface Props {
  disabled?: boolean;
  onComplete: (uri: string) => void;
  onError?: (e: Error) => void;
}

export function HoldToRecordButton({ disabled, onComplete, onError }: Props) {
  const recorder = useRef(new Recorder()).current;
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const meter = useSharedValue(0);

  const begin = async () => {
    try {
      const ok = await recorder.requestPermission();
      if (!ok) throw new Error('Microphone permission denied');
      haptics.press();
      await recorder.start((level) => {
        meter.value = withTiming(level, { duration: 80 });
      });
      scale.value = withSpring(1.12);
      glow.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
    } catch (e) {
      onError?.(e as Error);
    }
  };

  const end = async () => {
    cancelAnimation(glow);
    glow.value = withTiming(0);
    scale.value = withSpring(1);
    meter.value = withTiming(0);
    if (!recorder.isRecording) return;
    try {
      const uri = await recorder.stop();
      haptics.tap();
      onComplete(uri);
    } catch (e) {
      onError?.(e as Error);
    }
  };

  const gesture = Gesture.LongPress()
    .minDuration(120)
    .maxDistance(10000)
    .enabled(!disabled)
    .onStart(() => runOnJS(begin)())
    .onEnd(() => runOnJS(end)())
    .onFinalize(() => runOnJS(end)());

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glow.value * 0.4 + meter.value * 0.3,
    transform: [{ scale: 1.25 + meter.value * 0.5 + glow.value * 0.15 }],
  }));

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <View style={styles.hitbox}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.View style={[styles.button, buttonStyle, disabled && styles.disabled]}>
            <Ionicons name="mic" size={40} color={colors.text} />
          </Animated.View>
        </View>
      </GestureDetector>
      <Text style={styles.hint}>Hold to speak</Text>
    </View>
  );
}

const SIZE = 96;
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12 },
  hitbox: { width: SIZE * 2, height: SIZE * 2, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.primary,
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  disabled: { backgroundColor: colors.border },
  hint: { ...typography.caption, color: colors.textMuted },
});
