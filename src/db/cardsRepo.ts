/**
 * Card + review repository. Bridges the pure SRS engine with SQLite, and
 * records the Azure phonetic breakdown on every attempt.
 */
import { getDb } from './database';
import { scheduleNext, SrsState } from '../srs/srsEngine';
import type { LanguageCode } from '../config/env';
import type { PronunciationResult } from '../services/azurePronunciation';

export interface Card {
  id: number;
  language: LanguageCode;
  referenceText: string;
  phoneticIpa: string | null;
  source: string;
  dueAt: number;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastScore: number | null;
}

export async function addCard(params: {
  language: LanguageCode;
  referenceText: string;
  phoneticIpa?: string;
  source?: string;
  sourceDocId?: number;
}): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const res = await db.runAsync(
    `INSERT INTO cards
       (language, reference_text, phonetic_ipa, source, source_doc_id, created_at, due_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params.language,
    params.referenceText,
    params.phoneticIpa ?? null,
    params.source ?? 'manual',
    params.sourceDocId ?? null,
    now,
    now // immediately due
  );
  return res.lastInsertRowId;
}

/** Cards due now (or overdue) for a language, oldest-due first. */
export async function getDueCards(language: LanguageCode, limit = 50): Promise<Card[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM cards
      WHERE language = ? AND due_at <= ?
      ORDER BY due_at ASC
      LIMIT ?`,
    language,
    Date.now(),
    limit
  );
  return rows.map(mapCard);
}

export async function countDueCards(language: LanguageCode): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM cards WHERE language = ? AND due_at <= ?`,
    language,
    Date.now()
  );
  return row?.n ?? 0;
}

/**
 * Record an Azure assessment against a card: persists the full breakdown,
 * reschedules via the SRS engine, and stores per-phoneme scores.
 */
export async function recordReview(cardId: number, result: PronunciationResult): Promise<void> {
  const db = await getDb();
  const card = await db.getFirstAsync<any>('SELECT * FROM cards WHERE id = ?', cardId);
  if (!card) throw new Error(`Card ${cardId} not found`);

  const prev: SrsState = {
    intervalDays: card.interval_days,
    easeFactor: card.ease_factor,
    repetitions: card.repetitions,
    lapses: card.lapses,
  };

  const now = Date.now();
  const next = scheduleNext(prev, result.pronunciationScore, now);

  await db.withTransactionAsync(async () => {
    const review = await db.runAsync(
      `INSERT INTO reviews
         (card_id, reviewed_at, accuracy, fluency, completeness, pronunciation, prev_interval, next_interval)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      cardId,
      now,
      result.accuracyScore,
      result.fluencyScore,
      result.completenessScore,
      result.pronunciationScore,
      prev.intervalDays,
      next.intervalDays
    );

    for (const p of result.phonemes) {
      await db.runAsync(
        `INSERT INTO phoneme_scores (review_id, language, phoneme, score, reviewed_at)
         VALUES (?, ?, ?, ?, ?)`,
        review.lastInsertRowId,
        card.language,
        p.phoneme,
        p.accuracyScore,
        now
      );
    }

    await db.runAsync(
      `UPDATE cards
          SET due_at = ?, interval_days = ?, ease_factor = ?,
              repetitions = ?, lapses = ?, last_score = ?
        WHERE id = ?`,
      next.dueAt,
      next.intervalDays,
      next.easeFactor,
      next.repetitions,
      next.lapses,
      result.pronunciationScore,
      cardId
    );
  });
}

/** Phonemes a learner repeatedly struggles with — feeds the Articulation Guide. */
export async function getWeakPhonemes(
  language: LanguageCode,
  threshold = 70,
  limit = 6
): Promise<{ phoneme: string; avgScore: number; attempts: number }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT phoneme, AVG(score) AS avgScore, COUNT(*) AS attempts
       FROM phoneme_scores
      WHERE language = ?
      GROUP BY phoneme
      HAVING avgScore < ? AND attempts >= 2
      ORDER BY avgScore ASC
      LIMIT ?`,
    language,
    threshold,
    limit
  );
  return rows.map((r) => ({ phoneme: r.phoneme, avgScore: r.avgScore, attempts: r.attempts }));
}

function mapCard(r: any): Card {
  return {
    id: r.id,
    language: r.language,
    referenceText: r.reference_text,
    phoneticIpa: r.phonetic_ipa,
    source: r.source,
    dueAt: r.due_at,
    intervalDays: r.interval_days,
    easeFactor: r.ease_factor,
    repetitions: r.repetitions,
    lapses: r.lapses,
    lastScore: r.last_score,
  };
}
