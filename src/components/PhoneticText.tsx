/**
 * Color-codes a reference sentence word-by-word (and phoneme-by-phoneme on
 * tap) using the Azure breakdown. Green/yellow/red communicate articulation
 * quality at a glance — the signature "BoldVoice" visual.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, scoreColor, spacing, radius, typography } from '../theme/theme';
import type { WordScore } from '../services/azurePronunciation';
import { haptics } from '../utils/haptics';

interface Props {
  words: WordScore[];
}

export function PhoneticText({ words }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <View style={styles.wrap}>
      <View style={styles.sentence}>
        {words.map((w, i) => {
          const color = w.errorType === 'Omission' ? colors.textFaint : scoreColor(w.accuracyScore);
          return (
            <Pressable
              key={`${w.word}-${i}`}
              onPress={() => {
                haptics.tap();
                setExpanded(expanded === i ? null : i);
              }}
              style={({ pressed }) => [styles.wordChip, pressed && styles.wordPressed]}
            >
              <Text style={[styles.word, { color }]}>{w.word}</Text>
              <View style={[styles.underline, { backgroundColor: color }]} />
            </Pressable>
          );
        })}
      </View>

      {expanded !== null && words[expanded] && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.phonemeCard}>
          <Text style={styles.phonemeTitle}>“{words[expanded].word}”</Text>
          <View style={styles.phonemeRow}>
            {words[expanded].phonemes.map((p, j) => (
              <View key={j} style={styles.phonemePill}>
                <Text style={[styles.phoneme, { color: scoreColor(p.accuracyScore) }]}>
                  {p.phoneme}
                </Text>
                <Text style={styles.phonemeScore}>{Math.round(p.accuracyScore)}</Text>
              </View>
            ))}
          </View>
          {words[expanded].errorType !== 'None' && (
            <Text style={styles.errorType}>{words[expanded].errorType}</Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  wordChip: { marginRight: 8, marginBottom: 10, alignItems: 'center' },
  wordPressed: { opacity: 0.6 },
  word: { ...typography.title, lineHeight: 32 },
  underline: { height: 3, borderRadius: 2, width: '100%', marginTop: 2 },
  phonemeCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phonemeTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
  phonemeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  phonemePill: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 44,
  },
  phoneme: { ...typography.mono },
  phonemeScore: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  errorType: { color: colors.warning, marginTop: spacing.sm, fontWeight: '600' },
});
