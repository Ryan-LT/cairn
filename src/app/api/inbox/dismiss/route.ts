import { requireActiveUser } from "@/shared/api/account";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { isCrossSiteRequest } from "@/shared/api/request-guard";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Webhook transactions deleted in the app (`{ ids }`), or put back by undo
 * (`{ ids, restore: true }`). Kept on the server as well as in the month's
 * ledger, so an older copy of the month saved by another device can't bring them back.
 */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req, { json: true })) {
    return Response.json({ error: "This request didn't come from the app", code: "cross_site" }, { status: 403 });
  }
  let ids: string[];
  let restore: boolean;
  try {
    const body = (await req.json()) as { ids?: unknown; restore?: unknown };
    if (!Array.isArray(body.ids) || body.ids.length > 1000 || !body.ids.every((id) => typeof id === "string" && UUID.test(id))) throw new Error();
    ids = body.ids as string[];
    restore = body.restore === true;
  } catch {
    return Response.json({ error: "Invalid JSON body", code: "invalid_body" }, { status: 400 });
  }
  try {
    const user = await requireActiveUser(req);
    if (!user) return Response.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    if (!ids.length || !(await ensureSchema("webhooks"))) return Response.json({ ok: true, changed: 0 });
    const rows = (await getSql()`
      UPDATE wealthtracker_inbox SET dismissed_at = CASE WHEN ${restore} THEN NULL ELSE now() END
      WHERE user_id = ${user.sub} AND id = ANY(${ids}::uuid[])
      RETURNING id
    `) as unknown[];
    return Response.json({ ok: true, changed: rows.length });
  } catch (e) {
    console.error("[wealthtracker] inbox dismiss failed", e);
    return Response.json({ error: "Database error", code: "unavailable" }, { status: 500 });
  }
}
