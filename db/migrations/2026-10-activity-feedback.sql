-- Change log and in-app feedback (Oct 2026). Additive and safe to re-run.
-- The app also creates both tables on first use (src/shared/api/lazy-schema.ts), so running this
-- first is optional; run it anyway if the database role can't create tables.

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
