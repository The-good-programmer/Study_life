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
  {
    // Supabase publishes the public schema through its own web API (PostgREST), readable with the project's
    // public key. Row-level security with no policies turns that off for every table: only this server, which
    // connects as the table owner, can read or write them.
    id: '002_lock_down_tables',
    sql: `
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
      ALTER TABLE shared_decks ENABLE ROW LEVEL SECURITY;
      ALTER TABLE deck_likes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
      ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

      -- Belt and braces on Supabase (these roles don't exist elsewhere).
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
        END IF;
      END $$;
    `,
  },
  {
    // Shared AI limits beyond the per-account one: per network ('ip:<address>') and for the whole service ('all').
    // Shared decks can be reported by readers and are hidden once enough different people report them.
    id: '003_ai_pools_and_deck_reports',
    sql: `
      CREATE TABLE ai_usage_pools (
        pool TEXT NOT NULL,
        day TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (pool, day)
      );

      ALTER TABLE shared_decks ADD COLUMN hidden_at TIMESTAMPTZ;
      CREATE INDEX idx_shared_decks_author ON shared_decks (author_id);

      CREATE TABLE deck_reports (
        deck_id TEXT NOT NULL REFERENCES shared_decks(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (deck_id, user_id)
      );

      ALTER TABLE ai_usage_pools ENABLE ROW LEVEL SECURITY;
      ALTER TABLE deck_reports ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON ai_usage_pools, deck_reports FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON ai_usage_pools, deck_reports FROM authenticated;
        END IF;
      END $$;
    `,
  },
  {
    // A student's planner as a calendar feed, so Google, Apple and Outlook calendars can subscribe to it. The
    // token in the feed's link is the only key to it: whoever has the link can read the feed, and resetting
    // the token cuts them off.
    id: '004_calendar_feeds',
    sql: `
      CREATE TABLE calendar_feeds (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        ics TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      ALTER TABLE calendar_feeds ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON calendar_feeds FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON calendar_feeds FROM authenticated;
        END IF;
      END $$;
    `,
  },
  {
    // Synced study data other than decks, one JSON document per kind (subjects, planner, Focus tasks, the focus
    // log, Focus notes, and the record of what was deleted). The app merges them; the server only stores them.
    id: '005_user_documents',
    sql: `
      CREATE TABLE user_documents (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, kind)
      );

      ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON user_documents FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON user_documents FROM authenticated;
        END IF;
      END $$;
    `,
  },
  {
    // Password reset links (only a hash of each token is kept), push subscriptions for study reminders, and
    // secrets the server makes for itself (its Web Push keys), so nothing needs setting up by hand.
    id: '006_resets_and_reminders',
    sql: `
      CREATE TABLE password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX idx_password_resets_user ON password_resets (user_id);

      CREATE TABLE push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        keys_json TEXT NOT NULL,
        time_zone TEXT NOT NULL,
        remind_at TEXT NOT NULL,
        last_sent_day TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

      CREATE TABLE app_secrets (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
      ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON password_resets, push_subscriptions, app_secrets FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON password_resets, push_subscriptions, app_secrets FROM authenticated;
        END IF;
      END $$;
    `,
  },
  {
    // Friends (each student's invite code, and friendships stored both ways) and the weekly progress email.
    id: '007_friends_and_digest',
    sql: `
      CREATE TABLE friend_codes (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE friendships (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (user_id, friend_id)
      );
      CREATE INDEX idx_friendships_friend ON friendships (friend_id);

      CREATE TABLE digest_subscriptions (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        time_zone TEXT NOT NULL,
        unsubscribe_token TEXT NOT NULL UNIQUE,
        last_sent_week TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );

      ALTER TABLE friend_codes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
      ALTER TABLE digest_subscriptions ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON friend_codes, friendships, digest_subscriptions FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON friend_codes, friendships, digest_subscriptions FROM authenticated;
        END IF;
      END $$;
    `,
  },
  {
    // Duels between friends: the same multiple-choice questions for both, each answered once, graded here.
    id: '008_duels',
    sql: `
      CREATE TABLE duels (
        id TEXT PRIMARY KEY,
        challenger_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opponent_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deck_title TEXT NOT NULL,
        questions_json TEXT NOT NULL,
        challenger_answers_json TEXT NOT NULL,
        challenger_score INTEGER NOT NULL,
        challenger_ms INTEGER NOT NULL,
        opponent_answers_json TEXT,
        opponent_score INTEGER,
        opponent_ms INTEGER,
        created_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX idx_duels_challenger ON duels (challenger_id);
      CREATE INDEX idx_duels_opponent ON duels (opponent_id);

      ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON duels FROM anon;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON duels FROM authenticated;
        END IF;
      END $$;
    `,
  },
  {
    // Sharing decks: a privacy-safe author name (first name and initial; never named under 16), the
    // sharer's confirmation that they may share the cards, and the AI content check's result.
    id: '009_deck_sharing_privacy',
    sql: `
      ALTER TABLE shared_decks ADD COLUMN rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE shared_decks ADD COLUMN content_check TEXT NOT NULL DEFAULT 'unchecked';
      UPDATE shared_decks d SET author_name = 'a Studify student'
        FROM users u WHERE d.author_id = u.id AND (u.age IS NULL OR u.age < 16);
      UPDATE shared_decks SET author_name = split_part(author_name, ' ', 1) ||
        CASE WHEN strpos(trim(author_name), ' ') > 0 THEN ' ' || upper(left(split_part(trim(author_name), ' ', 2), 1)) || '.' ELSE '' END
        WHERE author_name <> 'a Studify student';
    `,
  },
  {
    // After-class notifications: whether this browser wants one when each lesson in the timetable ends
    // (on unless turned off), and up to when (local day and time) lessons have been notified.
    id: '010_after_class_notifications',
    sql: `
      ALTER TABLE push_subscriptions ADD COLUMN after_class BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE push_subscriptions ADD COLUMN lessons_notified_through TEXT;
    `,
  },
];
