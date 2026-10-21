/**
 * Streak + daily-goal tracking. A streak increments when the daily goal is
 * met on consecutive local calendar days.
 */
import { getDb } from './database';

export interface DailyProgress {
  dayKey: string;
  cardsReviewed: number;
  shadowSeconds: number;
  goalCards: number;
  goalMet: boolean;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  today: DailyProgress;
}

function localDayKey(ts = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function ensureToday(): Promise<DailyProgress> {
  const db = await getDb();
  const key = localDayKey();
  await db.runAsync(
    `INSERT OR IGNORE INTO daily_activity (day_key, goal_cards) VALUES (?, 20)`,
    key
  );
  const row = await db.getFirstAsync<any>('SELECT * FROM daily_activity WHERE day_key = ?', key);
  return mapProgress(row);
}

/** Call after each completed review. Returns the refreshed streak summary. */
export async function logReview(shadowSeconds = 0): Promise<StreakSummary> {
  const db = await getDb();
  const key = localDayKey();
  await ensureToday();

  await db.runAsync(
    `UPDATE daily_activity
        SET cards_reviewed = cards_reviewed + 1,
            shadow_seconds = shadow_seconds + ?
      WHERE day_key = ?`,
    shadowSeconds,
    key
  );

  // Flip goal_met if threshold reached.
  const today = await db.getFirstAsync<any>('SELECT * FROM daily_activity WHERE day_key = ?', key);
  if (today.cards_reviewed >= today.goal_cards && today.goal_met === 0) {
    await db.runAsync(`UPDATE daily_activity SET goal_met = 1 WHERE day_key = ?`, key);
  }

  return getStreakSummary();
}

export async function getStreakSummary(): Promise<StreakSummary> {
  const db = await getDb();
  const today = await ensureToday();

  // Walk backwards from today over days where the goal was met.
  const metDays = await db.getAllAsync<{ day_key: string }>(
    `SELECT day_key FROM daily_activity WHERE goal_met = 1 ORDER BY day_key DESC`
  );
  const metSet = new Set(metDays.map((r) => r.day_key));

  let current = 0;
  const cursor = new Date();
  // If today's goal not yet met, start counting from yesterday so the streak
  // isn't lost mid-day.
  if (!metSet.has(localDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (metSet.has(localDayKey(cursor.getTime()))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const longest = await computeLongest(metDays.map((r) => r.day_key));

  return { currentStreak: current, longestStreak: Math.max(longest, current), today };
}

function computeLongest(daysDesc: string[]): number {
  if (daysDesc.length === 0) return 0;
  const days = [...daysDesc].sort(); // ascending
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const cur = new Date(days[i]);
    const diff = (cur.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);
    run = diff === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return longest;
}

function mapProgress(r: any): DailyProgress {
  return {
    dayKey: r.day_key,
    cardsReviewed: r.cards_reviewed,
    shadowSeconds: r.shadow_seconds,
    goalCards: r.goal_cards,
    goalMet: r.goal_met === 1,
  };
}
