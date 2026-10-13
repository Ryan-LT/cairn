-- WealthTracker cloud sync (Neon Postgres). Run once per project: Neon SQL Editor or `psql "$DATABASE_URL" -f db/schema.sql`
-- Upgrading a database created before multi-account login? Run db/migrations/2026-10-multi-user.sql instead.

-- bcrypt password hashing (`crypt` / `gen_salt`) so accounts can be created in plain SQL.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Login accounts. Add one with db/create-user.sql.
CREATE TABLE IF NOT EXISTS wealthtracker_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE CHECK (username = lower(username) AND char_length(username) BETWEEN 1 AND 64),
  display_name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  /** Optional second sign-in name. */
  email TEXT CHECK (email = lower(email)),
  /** Sessions issued before this instant are void (set when the password changes). */
  password_changed_at TIMESTAMPTZ,
  /** Wrong passwords in a row; 5 locks the account for 15 minutes. */
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS wealthtracker_users_email_idx ON wealthtracker_users (email) WHERE email IS NOT NULL;

-- App tables (assets, debts, …) as one JSON document per user and key.
CREATE TABLE IF NOT EXISTS wealthtracker_kv (
  user_id UUID NOT NULL REFERENCES wealthtracker_users (id) ON DELETE CASCADE,
  key TEXT NOT NULL CHECK (char_length(key) > 0 AND char_length(key) <= 64),
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE INDEX IF NOT EXISTS wealthtracker_kv_updated_at_idx ON wealthtracker_kv (updated_at DESC);

-- USD → VND rate from ExchangeRate-API (see `src/shared/api/usd-vnd-exchange-rate.ts`). Shared by all users; refreshed at most once per day.
CREATE TABLE IF NOT EXISTS wealthtracker_fx_cache (
  base_code TEXT NOT NULL,
  quote_code TEXT NOT NULL,
  rate NUMERIC(20, 8) NOT NULL CHECK (rate > 0),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT NOT NULL DEFAULT 'exchangerate-api',
  api_time_last_update_utc TIMESTAMPTZ,
  /** Provider `time_next_update_utc` — cache is valid until this instant when set. */
  api_time_next_update_utc TIMESTAMPTZ,
  PRIMARY KEY (base_code, quote_code)
);

CREATE INDEX IF NOT EXISTS wealthtracker_fx_cache_fetched_at_idx ON wealthtracker_fx_cache (fetched_at DESC);

-- Existing databases from before `api_time_next_update_utc`:
ALTER TABLE wealthtracker_fx_cache
  ADD COLUMN IF NOT EXISTS api_time_next_update_utc TIMESTAMPTZ;

-- Rate-limit log for the public sign-up page (rows older than a day are pruned by the app).
CREATE TABLE IF NOT EXISTS wealthtracker_signup_attempts (
  /** HMAC of the client IP (never the raw address). */
  ip_hash TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wealthtracker_signup_attempts_ip_idx ON wealthtracker_signup_attempts (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS wealthtracker_signup_attempts_created_idx ON wealthtracker_signup_attempts (created_at DESC);

-- Wrong sign-ins per network, for the login throttle (rows older than a day are pruned by the app).
CREATE TABLE IF NOT EXISTS wealthtracker_login_failures (
  /** HMAC of the client IP (never the raw address). */
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wealthtracker_login_failures_ip_idx ON wealthtracker_login_failures (ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS wealthtracker_login_failures_created_idx ON wealthtracker_login_failures (created_at DESC);

-- Every add / edit / remove of a user's data, one row per record, written by PUT /api/tables in the
-- same statement as the save. Query it to trace back decisions, e.g. a debt's history:
--   SELECT occurred_at, action, changes FROM wealthtracker_audit_log
--   WHERE user_id = '…' AND entity_type = 'debt' AND entity_id = 'd1' ORDER BY id;
CREATE TABLE IF NOT EXISTS wealthtracker_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES wealthtracker_users (id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  /** Rows saved together (one sync) share a batch. */
  batch_id UUID NOT NULL,
  /** wealthtracker_kv key the record lives in (expenses, debts, goals, …). */
  table_key TEXT NOT NULL,
  /** expense, expense_month, income_source, asset, debt, personal_loan, goal_plan, settings, … */
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  /** Readable name at the time (bill name, debt name, the person for a loan). */
  entity_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('add', 'update', 'remove')),
  /** Updates: [{ field, before, after }]. */
  changes JSONB,
  /** The whole record before / after (null when added / removed). */
  before JSONB,
  after JSONB,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS wealthtracker_audit_log_user_idx ON wealthtracker_audit_log (user_id, id DESC);
CREATE INDEX IF NOT EXISTS wealthtracker_audit_log_entity_idx ON wealthtracker_audit_log (user_id, entity_type, entity_id, id DESC);

-- Feedback sent from the in-app "Góp ý" button (read it here until there is a screen for it):
--   SELECT created_at, kind, rating, message, page FROM wealthtracker_feedback WHERE status = 'new' ORDER BY id DESC;
CREATE TABLE IF NOT EXISTS wealthtracker_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES wealthtracker_users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL CHECK (kind IN ('idea', 'bug', 'praise', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  /** Page it was sent from, language, window size and browser. */
  page TEXT,
  locale TEXT,
  viewport TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'done'))
);

CREATE INDEX IF NOT EXISTS wealthtracker_feedback_created_idx ON wealthtracker_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS wealthtracker_feedback_status_idx ON wealthtracker_feedback (status, created_at DESC);

-- Last good live rates (USD/VND, gold per chỉ) for when every source is down; GET /api/rates fills it.
CREATE TABLE IF NOT EXISTS wealthtracker_rates_cache (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
