/**
 * BOLD AI — Dashboard.
 * Streak + daily goal, due-card count, weak-phoneme articulation shortcuts,
 * and the entry point into the Shadowing Studio.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography, scoreColor, shadow } from '../src/theme/theme';
import { StreakCard } from '../src/components/StreakCard';
import { LanguageToggle } from '../src/components/LanguageToggle';
import { useLanguage } from '../src/state/LanguageContext';
import { getStreakSummary, StreakSummary } from '../src/db/streaksRepo';
import { countDueCards, getWeakPhonemes } from '../src/db/cardsRepo';

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();
  const [summary, setSummary] = useState<StreakSummary | null>(null);
  const [due, setDue] = useState(0);
  const [weak, setWeak] = useState<{ phoneme: string; avgScore: number }[]>([]);

  const refresh = useCallback(() => {
    getStreakSummary().then(setSummary).catch(() => {});
    countDueCards(language).then(setDue).catch(() => {});
    getWeakPhonemes(language).then(setWeak).catch(() => {});
  }, [language]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.brand}>BOLD AI</Text>
        </View>
        <LanguageToggle />
      </View>

      {summary && (
        <Animated.View entering={FadeInDown.delay(60)}>
          <StreakCard summary={summary} />
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(120)}>
        <Pressable
          style={({ pressed }) => [styles.reviewCta, shadow.card, pressed && styles.pressed]}
          onPress={() => router.push('/shadowing')}
        >
          <View style={styles.ctaLeft}>
            <Ionicons name="mic" size={28} color={colors.text} />
            <View>
              <Text style={styles.ctaTitle}>Shadowing Studio</Text>
              <Text style={styles.ctaSub}>
                {due > 0 ? `${due} card${due === 1 ? '' : 's'} due now` : 'Practice any time'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180)} style={styles.section}>
        <Text style={styles.sectionTitle}>Focus phonemes</Text>
        <Text style={styles.sectionSub}>Sounds you repeatedly struggle with</Text>
        {weak.length === 0 ? (
          <View style={styles.emptyWeak}>
            <Text style={styles.emptyText}>
              No trouble sounds yet — complete a few reviews to see targeted guides.
            </Text>
          </View>
        ) : (
          <View style={styles.phonemeGrid}>
            {weak.map((w) => (
              <View key={w.phoneme} style={styles.phonemeTile}>
                <Text style={[styles.phonemeGlyph, { color: scoreColor(w.avgScore) }]}>
                  /{w.phoneme}/
                </Text>
                <Text style={styles.phonemeAvg}>avg {Math.round(w.avgScore)}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting: { ...typography.caption, color: colors.textMuted },
  brand: { ...typography.display, color: colors.text },
  reviewCta: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.85 },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ctaTitle: { ...typography.heading, color: colors.text },
  ctaSub: { ...typography.caption, color: '#E6E2FF' },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.title, color: colors.text },
  sectionSub: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  phonemeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  phonemeTile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 90,
  },
  phonemeGlyph: { ...typography.title },
  phonemeAvg: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  emptyWeak: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
});
