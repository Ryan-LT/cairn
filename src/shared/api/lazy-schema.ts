import { getSql } from "@/shared/api/db";

/**
 * Tables added after launch. The same DDL is in db/schema.sql and
 * db/migrations/2026-10-activity-feedback.sql; creating them on first use as
 * well means a deploy works even before anyone runs that migration.
 */
const SCHEMAS = {
  audit: [
    `CREATE TABLE IF NOT EXISTS wealthtracker_audit_log (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES wealthtracker_users (id) ON DELETE CASCADE,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      batch_id UUID NOT NULL,
      table_key TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_name TEXT,
      action TEXT NOT NULL CHECK (action IN ('add', 'update', 'remove')),
      changes JSONB,
      before JSONB,
      after JSONB,
      user_agent TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS wealthtracker_audit_log_user_idx ON wealthtracker_audit_log (user_id, id DESC)`,
    `CREATE INDEX IF NOT EXISTS wealthtracker_audit_log_entity_idx ON wealthtracker_audit_log (user_id, entity_type, entity_id, id DESC)`,
  ],
  feedback: [
    `CREATE TABLE IF NOT EXISTS wealthtracker_feedback (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES wealthtracker_users (id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      kind TEXT NOT NULL CHECK (kind IN ('idea', 'bug', 'praise', 'other')),
      message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
      rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
      page TEXT,
      locale TEXT,
      viewport TEXT,
      user_agent TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'done'))
    )`,
    `CREATE INDEX IF NOT EXISTS wealthtracker_feedback_created_idx ON wealthtracker_feedback (created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS wealthtracker_feedback_status_idx ON wealthtracker_feedback (status, created_at DESC)`,
  ],
} as const;

export type LazySchema = keyof typeof SCHEMAS;

/** After a failure (e.g. no permission to create tables), wait this long before trying again. */
const RETRY_AFTER_MS = 5 * 60_000;

const ready = new Map<LazySchema, Promise<boolean>>();
const failedAt = new Map<LazySchema, number>();

async function create(name: LazySchema): Promise<boolean> {
  const sql = getSql();
  try {
    for (const ddl of SCHEMAS[name]) await sql.query(ddl);
    return true;
  } catch (e) {
    // Two servers creating the table at once: one loses the race but the table exists.
    try {
      for (const ddl of SCHEMAS[name]) await sql.query(ddl);
      return true;
    } catch {
      console.error(`[wealthtracker] could not create the ${name} table`, e);
      return false;
    }
  }
}

/** `true` once the schema exists (created at most once per server instance). */
export async function ensureSchema(name: LazySchema): Promise<boolean> {
  const failed = failedAt.get(name);
  if (failed !== undefined && Date.now() - failed < RETRY_AFTER_MS) return false;
  let p = ready.get(name);
  if (!p) {
    p = create(name);
    ready.set(name, p);
  }
  const ok = await p;
  if (!ok) {
    ready.delete(name);
    failedAt.set(name, Date.now());
  }
  return ok;
}
