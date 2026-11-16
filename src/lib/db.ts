import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databasePath } from "./config";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  consent_at TEXT,
  consent_version TEXT,
  tier TEXT NOT NULL DEFAULT 'free' CHECK(tier IN ('free','annual')),
  membership_expires_at TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS industries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  industry_id INTEGER NOT NULL REFERENCES industries(id),
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_form TEXT NOT NULL,
  publish_date TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  is_sample INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topics_date ON topics(publish_date, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_topics_industry ON topics(industry_id, status);

CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_label TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  title TEXT NOT NULL,
  prep_label TEXT NOT NULL DEFAULT '',
  caution TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  event_type TEXT NOT NULL CHECK(event_type IN ('holiday','solar_term','campaign','solemn')),
  is_sample INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_start ON calendar_events(start_date, sort_order);

CREATE TABLE IF NOT EXISTS calendar_directions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  industry_name TEXT NOT NULL,
  direction TEXT NOT NULL,
  UNIQUE(event_id, industry_name)
);

CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  industry_id INTEGER REFERENCES industries(id),
  teaser TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, topic_id)
);

CREATE TABLE IF NOT EXISTS legal_docs (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount_fen INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','paid','cancelled')),
  provider TEXT NOT NULL,
  provider_ref TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  activated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_key ON login_attempts(attempt_key, created_at);

CREATE TABLE IF NOT EXISTS daily_page_views (
  day TEXT PRIMARY KEY,
  views INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_visitors (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (day, visitor_hash)
);
CREATE INDEX IF NOT EXISTS idx_daily_visitors_hash ON daily_visitors(visitor_hash, day);

CREATE TABLE IF NOT EXISTS daily_active_users (
  day TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  PRIMARY KEY (day, user_id)
);
`;

const globalForDb = globalThis as unknown as { __xuantiDb?: DatabaseSync; __xuantiPath?: string };

export function openDatabase(filename: string): DatabaseSync {
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  return db;
}

export function migrate(db: DatabaseSync): void {
  db.exec(SCHEMA);
  const existing = db.prepare("SELECT id FROM schema_migrations WHERE id = 1").get();
  if (!existing) {
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (1, ?)").run(new Date().toISOString());
  }
}

export function getDb(): DatabaseSync {
  const filename = path.resolve(databasePath());
  if (!globalForDb.__xuantiDb || globalForDb.__xuantiPath !== filename) {
    if (globalForDb.__xuantiDb) {
      try {
        globalForDb.__xuantiDb.close();
      } catch {
        /* ignore close errors during hot reload */
      }
    }
    const db = openDatabase(filename);
    migrate(db);
    globalForDb.__xuantiDb = db;
    globalForDb.__xuantiPath = filename;
  }
  return globalForDb.__xuantiDb;
}

export function insertId(result: { lastInsertRowid: number | bigint }): number {
  return Number(result.lastInsertRowid);
}

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  const connection = db as DatabaseSync & { isTransaction?: boolean };
  if (connection.isTransaction) return fn();
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    throw error;
  }
}
