/**
 * Dashboard streak + daily-goal card. Flame scales with the streak, and a
 * progress bar animates toward the daily card goal.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { colors, radius, spacing, typography, shadow } from '../theme/theme';
import type { StreakSummary } from '../db/streaksRepo';

export function StreakCard({ summary }: { summary: StreakSummary }) {
  const { currentStreak, today } = summary;
  const pct = Math.min(1, today.cardsReviewed / Math.max(1, today.goalCards));

  const progress = useSharedValue(0);
  const flame = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 700, easing: Easing.out(Easing.cubic) });
    flame.value = withSpring(1 + Math.min(currentStreak, 30) * 0.01);
  }, [pct, currentStreak, progress, flame]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const flameStyle = useAnimatedStyle(() => ({ transform: [{ scale: flame.value }] }));

  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.header}>
        <View style={styles.streakRow}>
          <Animated.Text style={[styles.flame, flameStyle]}>🔥</Animated.Text>
          <View>
            <Text style={styles.streakNum}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>
        {today.goalMet && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Goal met ✓</Text>
          </View>
        )}
      </View>

      <Text style={styles.goalText}>
        {today.cardsReviewed}/{today.goalCards} cards reviewed today
      </Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flame: { fontSize: 40 },
  streakNum: { ...typography.display, color: colors.streak },
  streakLabel: { ...typography.caption, color: colors.textMuted },
  badge: {
    backgroundColor: colors.accent + '22',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  badgeText: { color: colors.accent, ...typography.caption },
  goalText: { ...typography.body, color: colors.textMuted },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: colors.accent },
});
