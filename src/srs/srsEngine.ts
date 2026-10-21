/**
 * BOLD AI — SRS engine (Anki / SM-2 inspired).
 *
 * The novelty vs. vanilla Anki: the learner never self-grades. The Azure
 * Pronunciation Score (0-100) is converted into an SM-2 "quality" grade and
 * the spacing interval falls out of that automatically.
 *
 * Mapping (from the project scope):
 *   score < 70  -> fail  -> review again today
 *   70-84       -> hard  -> short interval
 *   85-94       -> good  -> standard interval
 *   >= 95       -> easy  -> long interval
 */

export interface SrsState {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

export interface SrsResult extends SrsState {
  dueAt: number; // epoch ms
  grade: ReviewGrade;
}

export type ReviewGrade = 'fail' | 'hard' | 'good' | 'easy';

const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function gradeFromScore(score: number): ReviewGrade {
  if (score < 70) return 'fail';
  if (score < 85) return 'hard';
  if (score < 95) return 'good';
  return 'easy';
}

/** SM-2 quality value 0-5 derived from the pronunciation grade. */
function qualityFor(grade: ReviewGrade): number {
  switch (grade) {
    case 'fail':
      return 1;
    case 'hard':
      return 3;
    case 'good':
      return 4;
    case 'easy':
      return 5;
  }
}

/**
 * Compute the next SRS state from the previous state + an Azure score.
 * Pure function — easy to unit test, no DB dependency.
 */
export function scheduleNext(prev: SrsState, score: number, now: number = Date.now()): SrsResult {
  const grade = gradeFromScore(score);
  const q = qualityFor(grade);

  let { intervalDays, easeFactor, repetitions, lapses } = prev;

  if (grade === 'fail') {
    // Lapse: reset the learning streak, keep ease but nudge it down, due today.
    repetitions = 0;
    lapses += 1;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
    intervalDays = 0; // "review today" — shown again in the same session queue
  } else {
    repetitions += 1;

    // Standard SM-2 ease update.
    easeFactor = Math.max(MIN_EASE, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

    if (repetitions === 1) {
      intervalDays = grade === 'easy' ? 3 : 1;
    } else if (repetitions === 2) {
      intervalDays = grade === 'easy' ? 7 : 4;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor * (grade === 'hard' ? 0.8 : 1));
    }

    // Guarantee the scope's rule: a strong score (>85) lands 7+ days out once learned.
    if (grade !== 'hard' && repetitions >= 2) {
      intervalDays = Math.max(intervalDays, 7);
    }
  }

  const dueAt = grade === 'fail' ? now : now + intervalDays * DAY_MS;

  return { intervalDays, easeFactor, repetitions, lapses, dueAt, grade };
}
