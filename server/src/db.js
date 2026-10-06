/**
 * Studify SQLite Database Engine
 * Zero-dependency, high-performance, embedded database powered by node:sqlite.
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'studify.sqlite');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode and pragmas for high concurrency and performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL DEFAULT 'password',
    password_hash TEXT,
    password_salt TEXT,
    google_id TEXT,
    picture_url TEXT,
    age INTEGER DEFAULT 15,
    country TEXT DEFAULT 'United States',
    grade TEXT DEFAULT '9th Grade',
    grade_level TEXT,
    avatar TEXT DEFAULT '🧠',
    institution TEXT,
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    data_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT PRIMARY KEY,
    stats_json TEXT NOT NULL,
    character_json TEXT,
    axolotl_json TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS shared_decks (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    author_id TEXT,
    author_name TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    card_count INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    deck_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON study_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_decks_slug ON shared_decks(slug);
`);

console.log(`[Database] SQLite connected at: ${dbPath}`);
