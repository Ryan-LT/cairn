-- Live rates fallback (also created on first use by the app; see src/shared/api/lazy-schema.ts).
CREATE TABLE IF NOT EXISTS wealthtracker_rates_cache (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
