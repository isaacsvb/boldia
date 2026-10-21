/**
 * SQLite bootstrap. Opens the DB once, runs migrations, and exposes a
 * singleton handle. Uses the modern synchronous-friendly expo-sqlite API.
 */
import * as SQLite from 'expo-sqlite';
import { CREATE_STATEMENTS, SCHEMA_VERSION } from './schema';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  const db = await SQLite.openDatabaseAsync('bold-ai.db');
  await db.execAsync(CREATE_STATEMENTS);
  await runMigrations(db);
  _db = db;
  return db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current < SCHEMA_VERSION) {
    // Add future migrations as: if (current < N) { await db.execAsync(...) }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

/** Test/maintenance helper — wipes all learner data. */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM phoneme_scores;
    DELETE FROM reviews;
    DELETE FROM cards;
    DELETE FROM documents;
    DELETE FROM daily_activity;
    DELETE FROM app_meta;
  `);
}
