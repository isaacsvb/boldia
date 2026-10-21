/**
 * BOLD AI — Local SQLite schema.
 *
 * Everything lives on-device (zero cloud cost). The schema backs three
 * concerns:
 *   1. SRS scheduling (cards + review history)  — Anki-style spacing
 *   2. Streaks & daily goals                     — retention loop
 *   3. Phonetic score history                    — per-phoneme trends
 *
 * Bump SCHEMA_VERSION and add a migration block in migrations.ts whenever
 * you change DDL.
 */

export const SCHEMA_VERSION = 1;

export const CREATE_STATEMENTS = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- A card is one shadowing target: a sentence/phrase in a given language.
CREATE TABLE IF NOT EXISTS cards (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  language      TEXT    NOT NULL,              -- 'en-US' | 'fr-FR'
  reference_text TEXT   NOT NULL,              -- what the learner must say
  phonetic_ipa  TEXT,                          -- optional IPA transcription
  source        TEXT    NOT NULL DEFAULT 'manual', -- 'manual' | 'document'
  source_doc_id INTEGER,                       -- FK -> documents.id (nullable)
  created_at    INTEGER NOT NULL,              -- epoch ms

  -- SRS state (SM-2 inspired, driven by Azure score)
  due_at        INTEGER NOT NULL,              -- epoch ms the card is next due
  interval_days REAL    NOT NULL DEFAULT 0,    -- current spacing interval
  ease_factor   REAL    NOT NULL DEFAULT 2.5,  -- SM-2 ease (min 1.3)
  repetitions   INTEGER NOT NULL DEFAULT 0,    -- consecutive successful reviews
  lapses        INTEGER NOT NULL DEFAULT 0,    -- times the card was failed
  last_score    REAL,                          -- last Azure pronunciation score

  FOREIGN KEY (source_doc_id) REFERENCES documents(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due_at);
CREATE INDEX IF NOT EXISTS idx_cards_lang ON cards(language);

-- One row per attempt. Full Azure breakdown is persisted for trends.
CREATE TABLE IF NOT EXISTS reviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id        INTEGER NOT NULL,
  reviewed_at    INTEGER NOT NULL,             -- epoch ms
  accuracy       REAL,
  fluency        REAL,
  completeness   REAL,
  pronunciation  REAL    NOT NULL,             -- the SRS driver
  prev_interval  REAL,
  next_interval  REAL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_card ON reviews(card_id);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON reviews(reviewed_at);

-- Per-phoneme score history, so the Articulation Guide can surface the
-- phonemes a learner repeatedly fails.
CREATE TABLE IF NOT EXISTS phoneme_scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id   INTEGER NOT NULL,
  language    TEXT    NOT NULL,
  phoneme     TEXT    NOT NULL,               -- e.g. 'th', 'ʁ'
  score       REAL    NOT NULL,
  reviewed_at INTEGER NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_phoneme_lang ON phoneme_scores(language, phoneme);

-- Imported PDF / ePub documents for shadowing.
CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  file_type   TEXT    NOT NULL,               -- 'pdf' | 'epub'
  language    TEXT    NOT NULL,
  sentence_count INTEGER NOT NULL DEFAULT 0,
  imported_at INTEGER NOT NULL
);

-- Streaks + daily goal progress. One row per calendar day (local).
CREATE TABLE IF NOT EXISTS daily_activity (
  day_key        TEXT PRIMARY KEY,            -- 'YYYY-MM-DD' local
  cards_reviewed INTEGER NOT NULL DEFAULT 0,
  shadow_seconds INTEGER NOT NULL DEFAULT 0,
  goal_cards     INTEGER NOT NULL DEFAULT 20,
  goal_met       INTEGER NOT NULL DEFAULT 0   -- 0/1
);

-- Single-row key/value for global app state (current streak, settings).
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;
