import { requireActiveUser } from "@/shared/api/account";
import { readActivity, summarizeActivity } from "@/shared/api/audit-log";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/shared/lib/audit-diff";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function jsonError(message: string, status: number, code?: string) {
  return Response.json({ error: message, ...(code ? { code } : {}) }, { status });
}

/**
 * The signed-in user's change log, newest first.
 * Query: `limit` (≤ 200), `before` (id cursor), `types` (comma-separated entity types),
 * `actions` (add / update / remove), `entity` (one record id), `q` (name contains),
 * `until` (ISO instant: only entries saved before it). The first page (no cursor)
 * also returns `summary`: how many entries match and when the oldest was saved.
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
    const knownActions = new Set<string>(AUDIT_ACTIONS);
    const actions = (params.get("actions") ?? "").split(",").filter((a) => knownActions.has(a));
    const search = params.get("q")?.slice(0, 100) || undefined;
    const untilRaw = params.get("until");
    const until = untilRaw && !Number.isNaN(Date.parse(untilRaw)) ? new Date(untilRaw).toISOString() : undefined;
    const filters = { entityTypes, entityId, actions, search };

    // One extra row tells whether there is another page.
    const [rows, summary] = await Promise.all([
      readActivity(user.sub, { ...filters, limit: limit + 1, before, until }),
      before === undefined ? summarizeActivity(user.sub, filters) : null,
    ]);
    if (rows === null) return Response.json({ available: false, entries: [], nextBefore: null, summary: null });
    const page = rows.slice(0, limit);
    return Response.json({
      available: true,
      summary,
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
