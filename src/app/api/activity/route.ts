import { requireActiveUser } from "@/shared/api/account";
import { readActivity } from "@/shared/api/audit-log";
import { AUDIT_ENTITY_TYPES } from "@/shared/lib/audit-diff";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, ...(code ? { code } : {}) }, { status });
}

/**
 * The signed-in user's change log, newest first.
 * Query: `limit` (≤ 200), `before` (id cursor), `types` (comma-separated entity types), `entity` (one record id).
 */
export async function GET(req: Request) {
  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");

    const params = new URL(req.url).searchParams;
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(params.get("limit") ?? "", 10) || DEFAULT_LIMIT));
    const beforeRaw = params.get("before");
    const before = beforeRaw && /^\d{1,18}$/.test(beforeRaw) ? Number(beforeRaw) : undefined;
    const known = new Set<string>(AUDIT_ENTITY_TYPES);
    const entityTypes = (params.get("types") ?? "").split(",").filter((t) => known.has(t));
    const entityId = params.get("entity")?.slice(0, 200) || undefined;

    // One extra row tells whether there is another page.
    const rows = await readActivity(user.sub, { limit: limit + 1, before, entityTypes, entityId });
    if (rows === null) return Response.json({ available: false, entries: [], nextBefore: null });
    const page = rows.slice(0, limit);
    return Response.json({
      available: true,
      entries: page.map((r) => ({
        id: r.id,
        at: new Date(r.occurred_at).toISOString(),
        batchId: r.batch_id,
        table: r.table_key,
        entityType: r.entity_type,
        entityId: r.entity_id,
        entityName: r.entity_name,
        action: r.action,
        changes: r.changes,
        before: r.before,
        after: r.after,
      })),
      nextBefore: rows.length > limit ? page[page.length - 1].id : null,
    });
  } catch (e) {
    console.error("[wealthtracker] activity query failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}
