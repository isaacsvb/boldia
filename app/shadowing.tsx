/**
 * BOLD AI — Shadowing Studio.
 *
 * Flow: pick/sample a sentence -> hear Azure TTS reference -> hold-to-record
 * -> waveform loader while Azure assesses -> animated score ring + phoneme
 * color-coding -> SRS reschedules the card + streak updates.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { colors, radius, spacing, typography } from '../src/theme/theme';
import { HoldToRecordButton } from '../src/components/HoldToRecordButton';
import { WaveformLoader } from '../src/components/WaveformLoader';
import { ScoreRing } from '../src/components/ScoreRing';
import { PhoneticText } from '../src/components/PhoneticText';
import { useLanguage } from '../src/state/LanguageContext';
import { speak } from '../src/services/azureTts';
import {
  assessPronunciation,
  PronunciationResult,
  AzureConfigError,
} from '../src/services/azurePronunciation';
import { addCard, getDueCards, recordReview, Card } from '../src/db/cardsRepo';
import { logReview } from '../src/db/streaksRepo';
import { celebrateScore, haptics } from '../src/utils/haptics';

// Fallback sentences so the Studio is usable before any documents are imported.
const SAMPLES: Record<string, string[]> = {
  'en-US': [
    'The weather is absolutely beautiful this afternoon.',
    'She thought the thorough theory was thrilling.',
    'I would really like a cup of coffee right now.',
  ],
  'fr-FR': [
    'Le temps est vraiment magnifique cet après-midi.',
    'Je voudrais une tasse de café, s’il vous plaît.',
    'Les grenouilles vertes chantent près de la rivière.',
  ],
};

type Phase = 'idle' | 'assessing' | 'result' | 'error';

export default function ShadowingStudio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();

  const [card, setCard] = useState<Card | null>(null);
  const [sentence, setSentence] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const loadNext = useCallback(async () => {
    setPhase('idle');
    setResult(null);
    setError(null);
    const due = await getDueCards(language, 1).catch(() => []);
    if (due.length > 0) {
      setCard(due[0]);
      setSentence(due[0].referenceText);
    } else {
      // No due cards: seed from samples and create a card so SRS can track it.
      const pool = SAMPLES[language];
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const id = await addCard({ language, referenceText: pick, source: 'manual' });
      const fresh = await getDueCards(language, 50);
      setCard(fresh.find((c) => c.id === id) ?? null);
      setSentence(pick);
    }
  }, [language]);

  useEffect(() => {
    loadNext();
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, [loadNext]);

  const playReference = async (rate = '0%') => {
    try {
      haptics.tap();
      await soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = await speak(sentence, language, rate);
    } catch (e) {
      handleError(e as Error);
    }
  };

  const onRecorded = async (uri: string) => {
    setPhase('assessing');
    try {
      const res = await assessPronunciation(uri, sentence, language);
      setResult(res);
      setPhase('result');
      celebrateScore(res.pronunciationScore);
      if (card) {
        await recordReview(card.id, res);
        await logReview();
      }
    } catch (e) {
      handleError(e as Error);
    }
  };

  const handleError = (e: Error) => {
    haptics.error();
    setError(
      e instanceof AzureConfigError
        ? 'Add your Azure Speech key to .env to enable pronunciation scoring.'
        : e.message
    );
    setPhase('error');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Shadowing Studio</Text>
        <Pressable onPress={() => router.push('/import')} hitSlop={12}>
          <Ionicons name="document-attach-outline" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Reference sentence */}
        <Animated.View entering={FadeIn} style={styles.sentenceCard}>
          {phase === 'result' && result ? (
            <PhoneticText words={result.words} />
          ) : (
            <Text style={styles.sentence}>{sentence}</Text>
          )}

          <View style={styles.playRow}>
            <Pressable style={styles.playBtn} onPress={() => playReference('0%')}>
              <Ionicons name="volume-high" size={18} color={colors.text} />
              <Text style={styles.playText}>Listen</Text>
            </Pressable>
            <Pressable style={styles.playBtnGhost} onPress={() => playReference('-25%')}>
              <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
              <Text style={[styles.playText, { color: colors.primary }]}>Slow</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Result / loader / record zone */}
        <View style={styles.stage}>
          {phase === 'assessing' && (
            <Animated.View entering={FadeIn} style={styles.center}>
              <WaveformLoader />
              <Text style={styles.assessing}>Analyzing your pronunciation…</Text>
            </Animated.View>
          )}

          {phase === 'result' && result && (
            <Animated.View entering={FadeInUp} style={styles.center}>
              <ScoreRing score={result.pronunciationScore} />
              <View style={styles.subScores}>
                <SubScore label="Accuracy" value={result.accuracyScore} />
                <SubScore label="Fluency" value={result.fluencyScore} />
                <SubScore label="Complete" value={result.completenessScore} />
              </View>
            </Animated.View>
          )}

          {phase === 'error' && (
            <Animated.View entering={FadeIn} style={styles.errorBox}>
              <Ionicons name="warning-outline" size={24} color={colors.warning} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* Footer controls */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {phase === 'result' || phase === 'error' ? (
          <Pressable style={styles.nextBtn} onPress={loadNext}>
            <Text style={styles.nextText}>Next sentence</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.text} />
          </Pressable>
        ) : (
          <HoldToRecordButton
            disabled={phase === 'assessing'}
            onComplete={onRecorded}
            onError={handleError}
          />
        )}
      </View>
    </View>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  return (
    <Animated.View entering={SlideInRight.delay(200)} style={styles.subScore}>
      <Text style={styles.subValue}>{Math.round(value)}</Text>
      <Text style={styles.subLabel}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.heading, color: colors.text },
  body: { padding: spacing.lg, gap: spacing.xl, flexGrow: 1 },
  sentenceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sentence: { ...typography.title, color: colors.text, lineHeight: 34 },
  playRow: { flexDirection: 'row', gap: spacing.sm },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  playBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  playText: { ...typography.caption, color: colors.text },
  stage: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: spacing.lg },
  assessing: { ...typography.body, color: colors.textMuted },
  subScores: { flexDirection: 'row', gap: spacing.xl },
  subScore: { alignItems: 'center' },
  subValue: { ...typography.title, color: colors.text },
  subLabel: { ...typography.caption, color: colors.textMuted },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning + '55',
  },
  errorText: { ...typography.body, color: colors.textMuted, flex: 1, lineHeight: 22 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  nextText: { ...typography.heading, color: colors.text },
});
