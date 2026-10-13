import { requireActiveUser } from "@/shared/api/account";
import { saveTablesWithAudit } from "@/shared/api/audit-log";
import { getSql } from "@/shared/api/db";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import { isStoredKey, type StoredKey } from "@/shared/storage/table-keys";

export const dynamic = "force-dynamic";

/** Client header naming the account its pending edits belong to; must match the session. */
const USER_HEADER = "x-wt-user";

/** Longest JSON text one table may hold, in characters (real data is a few KB). */
const MAX_TABLE_JSON_LENGTH = 1_000_000;

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, ...(code ? { code } : {}) }, { status });
}

type Row = { key: string; value: unknown };

/** Log the real failure; the client only learns that the database failed. */
function databaseError(e: unknown) {
  console.error("[wealthtracker] tables query failed", e);
  return jsonError("Database error", 500, "unavailable");
}

/** The signed-in user's tables (missing keys → client uses empty seeds). */
export async function GET(req: Request) {
  try {
    const user = await requireActiveUser(req);
    if (!user) {
      return jsonError("Unauthorized", 401, "unauthorized");
    }
    const sql = getSql();
    const rows = (await sql`
      SELECT key, value
      FROM wealthtracker_kv
      WHERE user_id = ${user.sub}
    `) as Row[];

    const tables: Record<string, unknown> = {};
    for (const row of rows) {
      if (isStoredKey(row.key)) {
        tables[row.key] = row.value;
      }
    }
    return Response.json({ userId: user.sub, tables });
  } catch (e) {
    return databaseError(e);
  }
}

/** Upsert one or more of the signed-in user's tables (partial updates allowed). */
export async function PUT(req: Request) {
  if (isCrossSiteRequest(req, { json: true })) {
    return jsonError("This request didn't come from the app", 403, "cross_site");
  }
  let user: Awaited<ReturnType<typeof requireActiveUser>>;
  try {
    user = await requireActiveUser(req);
  } catch (e) {
    return databaseError(e);
  }
  if (!user) {
    return jsonError("Unauthorized", 401, "unauthorized");
  }
  // Edits cached on this device for another account must never land in this one.
  if (req.headers.get(USER_HEADER) !== user.sub) {
    return jsonError("These changes belong to a different account", 409, "account_mismatch");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError('Expected object with "tables" record', 400);
  }

  const tables = (body as { tables?: unknown }).tables;
  if (!tables || typeof tables !== "object" || Array.isArray(tables)) {
    return jsonError('"tables" must be an object', 400);
  }

  const entries = Object.entries(tables as Record<string, unknown>).filter(
    (e): e is [StoredKey, unknown] => isStoredKey(e[0]) && e[1] !== undefined,
  );

  const saves = entries.map(([key, value]) => ({ key, value, payload: JSON.stringify(value) }));
  if (saves.some((s) => s.payload.length > MAX_TABLE_JSON_LENGTH)) {
    return jsonError("Table too large", 413, "too_large");
  }

  try {
    // Every save is also written to the change log (see saveTablesWithAudit).
    await saveTablesWithAudit(user.sub, saves, req.headers.get("user-agent"));
    return Response.json({ ok: true, written: entries.map(([k]) => k) });
  } catch (e) {
    return databaseError(e);
  }
}
