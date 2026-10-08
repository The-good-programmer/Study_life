/**
 * Schema migrations, applied once each and in order (see db.js). Never edit one that has been
 * released: add a new migration instead.
 */

export const MIGRATIONS = [
  {
    id: '001_initial',
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
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
        created_at TIMESTAMPTZ NOT NULL,
        last_login_at TIMESTAMPTZ NOT NULL
      );
      CREATE UNIQUE INDEX idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

      CREATE TABLE study_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX idx_sessions_user ON study_sessions (user_id);

      -- stats_json is the learner's study stats; character_json is how the avatar looks (never tokens or level).
      CREATE TABLE user_stats (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        stats_json TEXT NOT NULL,
        character_json TEXT,
        updated_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE shared_decks (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        author_name TEXT NOT NULL,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT,
        card_count INTEGER NOT NULL DEFAULT 0,
        likes INTEGER NOT NULL DEFAULT 0,
        deck_json TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE deck_likes (
        deck_id TEXT NOT NULL REFERENCES shared_decks(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (deck_id, user_id)
      );

      CREATE TABLE ai_usage (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, day)
      );
    `,
  },
];
