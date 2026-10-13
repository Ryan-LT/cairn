import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { diffTable, expenseNamesOf, type AuditChange, type AuditContext } from "@/shared/lib/audit-diff";
import { FOLD_FROM, FOLD_TO, foldSearch } from "@/shared/lib/search-fold";
import type { TableKey } from "@/shared/storage/table-keys";

/** Optimistic tries (another save kept landing in between) before the locking fallback. */
const MAX_ATTEMPTS = 4;
const MAX_USER_AGENT = 300;

type Sql = ReturnType<typeof getSql>;
type Save = { key: TableKey; value: unknown; payload: string };

async function readTable(sql: Sql, userId: string, key: TableKey): Promise<unknown> {
  const rows = (await sql`SELECT value FROM wealthtracker_kv WHERE user_id = ${userId} AND key = ${key}`) as { value: unknown }[];
  return rows[0]?.value ?? null;
}

async function plainUpsert(sql: Sql, userId: string, key: TableKey, payload: string) {
  await sql`
    INSERT INTO wealthtracker_kv (user_id, key, value, updated_at)
    VALUES (${userId}, ${key}, ${payload}::jsonb, now())
    ON CONFLICT (user_id, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
  `;
}

/**
 * Overwrite the table and return what it held just before, atomically (the
 * row is locked, so a concurrent save can't slip in between).
 */
async function swapTable(sql: Sql, userId: string, key: TableKey, payload: string): Promise<unknown> {
  for (;;) {
    const updated = (await sql`
      UPDATE wealthtracker_kv AS k
      SET value = ${payload}::jsonb, updated_at = now()
      FROM (SELECT user_id, key, value FROM wealthtracker_kv WHERE user_id = ${userId} AND key = ${key} FOR UPDATE) AS old
      WHERE k.user_id = old.user_id AND k.key = old.key
      RETURNING old.value AS before
    `) as { before: unknown }[];
    if (updated.length) return updated[0].before;
    const inserted = (await sql`
      INSERT INTO wealthtracker_kv (user_id, key, value, updated_at)
      VALUES (${userId}, ${key}, ${payload}::jsonb, now())
      ON CONFLICT (user_id, key) DO NOTHING
      RETURNING 1
    `) as unknown[];
    if (inserted.length) return null;
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function logRows(changes: AuditChange[]) {
  return JSON.stringify(
    changes.map((c) => ({
      entity_type: c.entityType,
      entity_id: c.entityId,
      entity_name: c.entityName,
      action: c.action,
      changes: c.changes,
      before: c.before,
      after: c.after,
    })),
  );
}

/**
 * Save the tables and log what changed, record by record.
 *
 * Each table is written only if it still holds the version the diff was made
 * against (otherwise another save got in first: re-read and diff again), and
 * the log rows go in with the same statement, so the log never disagrees with
 * the data. If the log table can't be used, the save still goes through.
 */
export async function saveTablesWithAudit(userId: string, saves: Save[], userAgent: string | null): Promise<void> {
  const sql = getSql();
  if (!(await ensureSchema("audit"))) {
    for (const s of saves) await plainUpsert(sql, userId, s.key, s.payload);
    return;
  }
  const batchId = crypto.randomUUID();
  const agent = userAgent ? userAgent.slice(0, MAX_USER_AGENT) : null;

  // Check-offs are named after their bill: the bill list being saved, else the stored one.
  let names: AuditContext["expenseNames"];
  const contextFor = async (key: TableKey): Promise<AuditContext> => {
    if (key !== "expenseLog") return {};
    if (!names) {
      const inBatch = saves.find((s) => s.key === "expenses");
      names = expenseNamesOf(inBatch ? inBatch.value : await readTable(sql, userId, "expenses"));
    }
    return { expenseNames: names };
  };

  for (const { key, value, payload } of saves) {
    const ctx = await contextFor(key);
    let written = false;
    let changes: AuditChange[] = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !written; attempt++) {
      if (attempt > 0) await pause(15 + Math.random() * 60 * attempt);
      const before = await readTable(sql, userId, key);
      changes = diffTable(key, before, value, ctx);
      const beforeJson = before === null ? null : JSON.stringify(before);
      const rows = (await sql`
        WITH saved AS (
          INSERT INTO wealthtracker_kv (user_id, key, value, updated_at)
          VALUES (${userId}, ${key}, ${payload}::jsonb, now())
          ON CONFLICT (user_id, key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
          WHERE wealthtracker_kv.value IS NOT DISTINCT FROM ${beforeJson}::jsonb
          RETURNING 1
        ), logged AS (
          INSERT INTO wealthtracker_audit_log
            (user_id, batch_id, table_key, entity_type, entity_id, entity_name, action, changes, before, after, user_agent)
          SELECT ${userId}, ${batchId}, ${key}, e.entity_type, e.entity_id, e.entity_name, e.action, e.changes, e.before, e.after, ${agent}
          FROM jsonb_to_recordset(${logRows(changes)}::jsonb)
            AS e(entity_type text, entity_id text, entity_name text, action text, changes jsonb, before jsonb, after jsonb)
          WHERE EXISTS (SELECT 1 FROM saved)
          RETURNING 1
        )
        SELECT (SELECT count(*) FROM saved)::int AS written
      `) as { written: number }[];
      written = rows[0]?.written === 1;
    }
    if (!written) {
      // Kept losing the race: swap under a row lock, then log against what it really replaced.
      const before = await swapTable(sql, userId, key, payload);
      changes = diffTable(key, before, value, ctx);
      if (changes.length) {
        await sql`
          INSERT INTO wealthtracker_audit_log
            (user_id, batch_id, table_key, entity_type, entity_id, entity_name, action, changes, before, after, user_agent)
          SELECT ${userId}, ${batchId}, ${key}, e.entity_type, e.entity_id, e.entity_name, e.action, e.changes, e.before, e.after, ${agent}
          FROM jsonb_to_recordset(${logRows(changes)}::jsonb)
            AS e(entity_type text, entity_id text, entity_name text, action text, changes jsonb, before jsonb, after jsonb)
        `;
      }
    }
  }
}

export type ActivityFilters = {
  entityTypes?: string[];
  entityId?: string;
  actions?: string[];
  /** Name contains this (case and Vietnamese accents ignored). */
  search?: string;
};

export type ActivityQuery = ActivityFilters & {
  limit: number;
  /** Entries older than this id (cursor from the previous page). */
  before?: number;
  /** Entries saved before this instant (ISO): "jump to a month". */
  until?: string;
};

export type ActivityRow = {
  id: string;
  occurred_at: string;
  batch_id: string;
  table_key: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  action: string;
  changes: unknown;
  before: unknown;
  after: unknown;
};

/** `LIKE` pattern for "contains", taking the user's `%`, `_` and backslash literally. */
function containsPattern(search: string | undefined): string | null {
  const folded = search ? foldSearch(search) : "";
  return folded ? `%${folded.replace(/[\\%_]/g, "\\$&")}%` : null;
}

/** The user's change log, newest first. `null` when the log table isn't available. */
export async function readActivity(userId: string, q: ActivityQuery): Promise<ActivityRow[] | null> {
  if (!(await ensureSchema("audit"))) return null;
  const types = q.entityTypes?.length ? q.entityTypes : null;
  const actions = q.actions?.length ? q.actions : null;
  const pattern = containsPattern(q.search);
  return (await getSql()`
    SELECT id::text, occurred_at, batch_id, table_key, entity_type, entity_id, entity_name, action, changes, before, after
    FROM wealthtracker_audit_log
    WHERE user_id = ${userId}
      AND (${q.before ?? null}::bigint IS NULL OR id < ${q.before ?? null}::bigint)
      AND (${q.until ?? null}::timestamptz IS NULL OR occurred_at < ${q.until ?? null}::timestamptz)
      AND (${types}::text[] IS NULL OR entity_type = ANY(${types}::text[]))
      AND (${actions}::text[] IS NULL OR action = ANY(${actions}::text[]))
      AND (${q.entityId ?? null}::text IS NULL OR entity_id = ${q.entityId ?? null}::text)
      AND (${pattern}::text IS NULL OR lower(translate(normalize(coalesce(entity_name, ''), NFC), ${FOLD_FROM}, ${FOLD_TO})) LIKE ${pattern}::text ESCAPE '\\')
    ORDER BY id DESC
    LIMIT ${q.limit}
  `) as ActivityRow[];
}

/** How many entries match (ignoring the cursor and month jump) and when the oldest was saved. */
export async function summarizeActivity(userId: string, q: ActivityFilters): Promise<{ total: number; oldest: string | null } | null> {
  if (!(await ensureSchema("audit"))) return null;
  const types = q.entityTypes?.length ? q.entityTypes : null;
  const actions = q.actions?.length ? q.actions : null;
  const pattern = containsPattern(q.search);
  const rows = (await getSql()`
    SELECT count(*)::int AS total, min(occurred_at) AS oldest
    FROM wealthtracker_audit_log
    WHERE user_id = ${userId}
      AND (${types}::text[] IS NULL OR entity_type = ANY(${types}::text[]))
      AND (${actions}::text[] IS NULL OR action = ANY(${actions}::text[]))
      AND (${q.entityId ?? null}::text IS NULL OR entity_id = ${q.entityId ?? null}::text)
      AND (${pattern}::text IS NULL OR lower(translate(normalize(coalesce(entity_name, ''), NFC), ${FOLD_FROM}, ${FOLD_TO})) LIKE ${pattern}::text ESCAPE '\\')
  `) as { total: number; oldest: string | Date | null }[];
  const oldest = rows[0]?.oldest;
  return { total: rows[0]?.total ?? 0, oldest: oldest ? new Date(oldest).toISOString() : null };
}
