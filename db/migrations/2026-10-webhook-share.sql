-- Bank webhook and password-protected report links (Oct 2026). Additive and safe to re-run.
-- The app also creates these tables on first use (src/shared/api/lazy-schema.ts); run this anyway
-- if the database role can't create tables.

-- Keys an outside service (SePay, Casso, a script) uses to send bank transactions to
-- POST /api/webhooks/transactions. Only the SHA-256 of a key is stored; it's shown once.
CREATE TABLE IF NOT EXISTS wealthtracker_webhook_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES wealthtracker_users (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  token_hash TEXT NOT NULL UNIQUE,
  /** Last 4 characters, to tell keys apart in the list. */
  token_hint TEXT NOT NULL,
  /** Asset (account) the transactions move when they don't name one. */
  default_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wealthtracker_webhook_tokens_user_idx ON wealthtracker_webhook_tokens (user_id, created_at DESC);

-- Transactions received by the webhook. The app copies them into the user's ledger
-- (ids `hook-<id>`) and marks them acknowledged; it keeps re-checking the last 45 days,
-- except rows deleted in the app (dismissed).
CREATE TABLE IF NOT EXISTS wealthtracker_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES wealthtracker_users (id) ON DELETE CASCADE,
  token_id UUID REFERENCES wealthtracker_webhook_tokens (id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('generic', 'sepay', 'casso')),
  /** The sender's transaction id (or a random one); a repeat delivery is ignored. */
  external_ref TEXT NOT NULL,
  /** { kind, amount, date, at, title?, note?, category?, account? } */
  txn JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acked_at TIMESTAMPTZ,
  /** Deleted by hand in the app: never copied into the ledger again. */
  dismissed_at TIMESTAMPTZ,
  UNIQUE (user_id, provider, external_ref)
);

CREATE INDEX IF NOT EXISTS wealthtracker_inbox_user_idx ON wealthtracker_inbox (user_id, received_at DESC);
CREATE INDEX IF NOT EXISTS wealthtracker_inbox_token_idx ON wealthtracker_inbox (token_id, received_at DESC);

-- Shared reports: a frozen snapshot encrypted with a key derived from the link's password
-- (scrypt + AES-256-GCM), so the database alone can't read them. Links are /share#<id>.
CREATE TABLE IF NOT EXISTS wealthtracker_shares (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES wealthtracker_users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  /** { from: 'YYYY-MM', to: 'YYYY-MM', all: boolean } */
  period JSONB NOT NULL,
  sections TEXT[] NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS wealthtracker_shares_user_idx ON wealthtracker_shares (user_id, created_at DESC);

-- Wrong passwords on share links, to slow down guessing (rows older than a day are pruned).
CREATE TABLE IF NOT EXISTS wealthtracker_share_failures (
  id BIGSERIAL PRIMARY KEY,
  share_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wealthtracker_share_failures_share_idx ON wealthtracker_share_failures (share_id, created_at);
CREATE INDEX IF NOT EXISTS wealthtracker_share_failures_ip_idx ON wealthtracker_share_failures (ip_hash, created_at);
