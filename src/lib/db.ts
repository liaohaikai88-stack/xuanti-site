import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ensureSubIndustries } from "./catalog";
import { databasePath } from "./config";
import { ensureForbiddenWords } from "./forbidden";
import { ensurePlans } from "./membership";

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

CREATE TABLE IF NOT EXISTS topic_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  style_label TEXT NOT NULL,
  body TEXT NOT NULL,
  breakdown_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  storyboard TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_topic_copies_topic ON topic_copies(topic_id, status, sort_order);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, id);

CREATE TABLE IF NOT EXISTS hot_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  rank INTEGER NOT NULL,
  title TEXT NOT NULL,
  heat TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hot_source_time ON hot_items(source, fetched_at);

CREATE TABLE IF NOT EXISTS hot_fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  ok INTEGER NOT NULL,
  message TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hot_pitches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hot_title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL,
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  platform TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT '',
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
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
  const columns = db.prepare("PRAGMA table_info(users)").all();
  if (!columns.some((column) => column.name === "vip_expires_at")) {
    db.exec("ALTER TABLE users ADD COLUMN vip_expires_at TEXT");
  }
  const copyColumns = db.prepare("PRAGMA table_info(topic_copies)").all();
  if (copyColumns.length > 0 && !copyColumns.some((column) => column.name === "storyboard")) {
    db.exec("ALTER TABLE topic_copies ADD COLUMN storyboard TEXT NOT NULL DEFAULT ''");
  }
  const topicColumns = db.prepare("PRAGMA table_info(topics)").all();
  if (topicColumns.length > 0 && !topicColumns.some((column) => column.name === "sub_industry")) {
    db.exec("ALTER TABLE topics ADD COLUMN sub_industry TEXT NOT NULL DEFAULT ''");
  }
  if (topicColumns.length > 0 && !topicColumns.some((column) => column.name === "difficulty")) {
    db.exec("ALTER TABLE topics ADD COLUMN difficulty INTEGER NOT NULL DEFAULT 2");
  }
  if (topicColumns.length > 0 && !topicColumns.some((column) => column.name === "heat_source")) {
    db.exec("ALTER TABLE topics ADD COLUMN heat_source TEXT NOT NULL DEFAULT '常青'");
  }
  if (topicColumns.length > 0 && !topicColumns.some((column) => column.name === "shoot_minutes")) {
    db.exec("ALTER TABLE topics ADD COLUMN shoot_minutes INTEGER");
  }
  if (!columns.some((column) => column.name === "ai_beta")) {
    db.exec("ALTER TABLE users ADD COLUMN ai_beta INTEGER NOT NULL DEFAULT 0");
  }
  ensureExtensibleTables(db);
  ensurePlans(db);
  ensureForbiddenWords(db);
  ensureSubIndustries(db);
  const existing = db.prepare("SELECT id FROM schema_migrations WHERE id = 1").get();
  if (!existing) {
    db.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (1, ?)").run(new Date().toISOString());
  }
}

function ensureExtensibleTables(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sub_industries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      industry_id INTEGER NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      extra_json TEXT NOT NULL DEFAULT '{}',
      UNIQUE(industry_id, slug)
    );
    CREATE TABLE IF NOT EXISTS shop_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      shop_name TEXT NOT NULL DEFAULT '',
      industry_id INTEGER REFERENCES industries(id),
      sub_industry_id INTEGER REFERENCES sub_industries(id),
      city TEXT NOT NULL DEFAULT '',
      profile_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS membership_plans (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      quotas_json TEXT NOT NULL DEFAULT '{}',
      features_json TEXT NOT NULL DEFAULT '{}',
      extra_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS user_memberships (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tier_slug TEXT NOT NULL,
      expires_at TEXT,
      granted_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS benchmark_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_title TEXT NOT NULL,
      benchmark_title TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      likes INTEGER,
      favorites INTEGER,
      url TEXT NOT NULL DEFAULT '',
      looked_up_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_benchmark_title ON benchmark_cases(topic_title);
    CREATE TABLE IF NOT EXISTS forbidden_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phrase TEXT NOT NULL UNIQUE,
      replacement TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS tool_usage (
      day TEXT NOT NULL,
      actor_key TEXT NOT NULL,
      tool TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, actor_key, tool)
    );
    CREATE TABLE IF NOT EXISTS ai_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic_id INTEGER,
      kind TEXT NOT NULL,
      output_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ai_generations_user ON ai_generations(user_id, kind, created_at);
    CREATE TABLE IF NOT EXISTS hot_manual (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT '',
      rank INTEGER,
      heat TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      fetched_at TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT '',
      idea TEXT NOT NULL DEFAULT '',
      hidden INTEGER NOT NULL DEFAULT 0
    );
  `);
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
