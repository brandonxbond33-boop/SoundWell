// SQLite storage with FTS5 full-text search. Uses Node's built-in driver (no deps).
// SQLite + FTS5 comfortably handles a few million rows on one box; see docs/ROADMAP.md
// for when to move to Postgres + a dedicated search engine.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const LICENSES = {
  'CC0': {
    name: 'CC0 (Public Domain)',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: false,
    commercial: true,
    plain: 'Use it for anything, commercial included. No credit required (but always appreciated).',
  },
  'CC-BY-4.0': {
    name: 'Creative Commons Attribution 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: true,
    commercial: true,
    plain: 'Use it for anything, commercial included, as long as you credit the creator.',
  },
  'CC-BY-3.0': {
    name: 'Creative Commons Attribution 3.0',
    url: 'https://creativecommons.org/licenses/by/3.0/',
    attribution: true,
    commercial: true,
    plain: 'Use it for anything, commercial included, as long as you credit the creator.',
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sounds (
  id           INTEGER PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',  -- plain-language audio description (a11y)
  kind         TEXT NOT NULL CHECK (kind IN ('sfx','music')),
  category     TEXT NOT NULL,
  tags         TEXT NOT NULL DEFAULT '',  -- space separated, lowercase
  mood         TEXT,
  duration     REAL NOT NULL,
  bpm          INTEGER,
  music_key    TEXT,
  loopable     INTEGER NOT NULL DEFAULT 0,
  license      TEXT NOT NULL,
  author       TEXT NOT NULL,
  author_url   TEXT,
  source       TEXT NOT NULL DEFAULT 'soundwell',
  source_id    TEXT,
  source_url   TEXT,
  file_url     TEXT NOT NULL,             -- full-quality download
  preview_url  TEXT NOT NULL,             -- streaming preview
  peaks        TEXT,                      -- JSON array of 0..100 ints for the waveform
  plays        INTEGER NOT NULL DEFAULT 0,
  downloads    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source, source_id)
);
CREATE INDEX IF NOT EXISTS sounds_kind_cat ON sounds(kind, category);
CREATE INDEX IF NOT EXISTS sounds_popular ON sounds(downloads DESC);
CREATE INDEX IF NOT EXISTS sounds_created ON sounds(created_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS sounds_fts USING fts5(
  title, description, tags, category, mood, author,
  content='sounds', content_rowid='id',
  tokenize='porter unicode61 remove_diacritics 2',
  prefix='2 3'
);

CREATE TRIGGER IF NOT EXISTS sounds_ai AFTER INSERT ON sounds BEGIN
  INSERT INTO sounds_fts(rowid, title, description, tags, category, mood, author)
  VALUES (new.id, new.title, new.description, new.tags, new.category, new.mood, new.author);
END;
CREATE TRIGGER IF NOT EXISTS sounds_ad AFTER DELETE ON sounds BEGIN
  INSERT INTO sounds_fts(sounds_fts, rowid, title, description, tags, category, mood, author)
  VALUES ('delete', old.id, old.title, old.description, old.tags, old.category, old.mood, old.author);
END;
CREATE TRIGGER IF NOT EXISTS sounds_au AFTER UPDATE OF title, description, tags, category, mood, author ON sounds BEGIN
  INSERT INTO sounds_fts(sounds_fts, rowid, title, description, tags, category, mood, author)
  VALUES ('delete', old.id, old.title, old.description, old.tags, old.category, old.mood, old.author);
  INSERT INTO sounds_fts(rowid, title, description, tags, category, mood, author)
  VALUES (new.id, new.title, new.description, new.tags, new.category, new.mood, new.author);
END;
`;

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

const COLS = ['slug', 'title', 'description', 'kind', 'category', 'tags', 'mood', 'duration', 'bpm',
  'music_key', 'loopable', 'license', 'author', 'author_url', 'source', 'source_id', 'source_url',
  'file_url', 'preview_url', 'peaks', 'plays', 'downloads'];

/** Insert or update by (source, source_id). Returns the row id. */
export function upsertSound(db, s) {
  const row = {
    description: '', tags: '', mood: null, bpm: null, music_key: null, loopable: 0,
    author_url: null, source: 'soundwell', source_id: null, source_url: null, peaks: null,
    plays: 0, downloads: 0, ...s,
  };
  row.source_id ??= row.slug;
  if (Array.isArray(row.tags)) row.tags = row.tags.join(' ');
  row.tags = row.tags.toLowerCase();
  if (Array.isArray(row.peaks)) row.peaks = JSON.stringify(row.peaks);
  row.loopable = row.loopable ? 1 : 0;
  if (!LICENSES[row.license]) throw new Error(`Unsupported license "${row.license}" for ${row.slug}`);

  const params = COLS.map((c) => row[c] ?? null);
  const updates = COLS.filter((c) => !['plays', 'downloads'].includes(c))
    .map((c) => `${c}=excluded.${c}`).join(', ');
  const stmt = db.prepare(
    `INSERT INTO sounds (${COLS.join(',')}) VALUES (${COLS.map(() => '?').join(',')})
     ON CONFLICT(source, source_id) DO UPDATE SET ${updates}
     RETURNING id`,
  );
  return stmt.get(...params).id;
}
