/**
 * BOLD AI — Document Import.
 * Pick a local PDF/ePub, extract sentences on-device, and turn them into SRS
 * shadowing cards. No cloud, no cost.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../src/theme/theme';
import { parseDocument } from '../src/services/documentParser';
import { addCard } from '../src/db/cardsRepo';
import { getDb } from '../src/db/database';
import { useLanguage } from '../src/state/LanguageContext';
import { haptics } from '../src/utils/haptics';

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const pickAndImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/epub+zip'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;

      setBusy(true);
      setStatus('Extracting text…');
      const asset = res.assets[0];
      const parsed = await parseDocument(asset.uri, asset.name);

      setStatus(`Creating ${parsed.sentences.length} cards…`);
      const db = await getDb();
      const docRes = await db.runAsync(
        `INSERT INTO documents (title, file_type, language, sentence_count, imported_at)
         VALUES (?, ?, ?, ?, ?)`,
        parsed.title,
        parsed.fileType,
        language,
        parsed.sentences.length,
        Date.now()
      );
      const docId = docRes.lastInsertRowId;

      for (const s of parsed.sentences) {
        await addCard({ language, referenceText: s, source: 'document', sourceDocId: docId });
      }

      haptics.success();
      setStatus(`Imported “${parsed.title}” — ${parsed.sentences.length} cards ready.`);
    } catch (e) {
      haptics.error();
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Import Document</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lead}>
          Shadow any book or article. BOLD AI extracts sentences from your PDF or ePub on-device
          and schedules them for pronunciation practice.
        </Text>

        <Pressable style={styles.dropzone} onPress={pickAndImport} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={40} color={colors.primary} />
              <Text style={styles.dropTitle}>Choose a PDF or ePub</Text>
              <Text style={styles.dropSub}>Everything stays on your device</Text>
            </>
          )}
        </Pressable>

        {status && (
          <Animated.View entering={FadeIn} style={styles.statusBox}>
            <Text style={styles.statusText}>{status}</Text>
          </Animated.View>
        )}

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={styles.noteText}>
            Scanned/image-only PDFs aren’t supported (no OCR in the free build). Text-based PDFs
            and standard ePubs work great.
          </Text>
        </View>
      </ScrollView>
    </View>
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
  body: { padding: spacing.lg, gap: spacing.lg },
  lead: { ...typography.body, color: colors.textMuted, lineHeight: 24 },
  dropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  dropTitle: { ...typography.heading, color: colors.text },
  dropSub: { ...typography.caption, color: colors.textMuted },
  statusBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusText: { ...typography.body, color: colors.text },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  noteText: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 20 },
});
