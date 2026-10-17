import { requireActiveUser } from "@/shared/api/account";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { isCrossSiteRequest } from "@/shared/api/request-guard";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark inbox rows as copied into the ledger: `{ ids: string[] }`. */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req, { json: true })) {
    return Response.json({ error: "This request didn't come from the app", code: "cross_site" }, { status: 403 });
  }
  let ids: string[];
  try {
    const body = (await req.json()) as { ids?: unknown };
    if (!Array.isArray(body.ids) || body.ids.length > 1000 || !body.ids.every((id) => typeof id === "string" && UUID.test(id))) throw new Error();
    ids = body.ids as string[];
  } catch {
    return Response.json({ error: "Invalid JSON body", code: "invalid_body" }, { status: 400 });
  }
  try {
    const user = await requireActiveUser(req);
    if (!user) return Response.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    if (!ids.length || !(await ensureSchema("webhooks"))) return Response.json({ ok: true, acked: 0 });
    const rows = (await getSql()`
      UPDATE cairn_inbox SET acked_at = now()
      WHERE user_id = ${user.sub} AND id = ANY(${ids}::uuid[]) AND acked_at IS NULL
      RETURNING id
    `) as unknown[];
    return Response.json({ ok: true, acked: rows.length });
  } catch (e) {
    console.error("[cairn] inbox ack failed", e);
    return Response.json({ error: "Database error", code: "unavailable" }, { status: 500 });
  }
}
