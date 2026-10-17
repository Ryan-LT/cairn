import { requireActiveUser } from "@/shared/api/account";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import { hashWebhookToken, newWebhookToken } from "@/shared/api/secrets";

export const dynamic = "force-dynamic";

/** Active keys one account may have. */
const MAX_KEYS = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status });
}

type KeyRow = {
  id: string;
  name: string;
  token_hint: string;
  default_account_id: string | null;
  created_at: string;
  last_used_at: string | null;
};

const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
const toKey = (r: KeyRow) => ({
  id: r.id,
  name: r.name,
  hint: r.token_hint,
  defaultAccountId: r.default_account_id,
  createdAt: iso(r.created_at),
  lastUsedAt: iso(r.last_used_at),
});

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await req.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const nameOf = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 60) : "");
const accountOf = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : null);

/** The account's webhook keys and the last transactions they delivered. */
export async function GET(req: Request) {
  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("webhooks"))) return Response.json({ available: false, keys: [], recent: [] });
    const sql = getSql();
    const [keys, recent] = await Promise.all([
      sql`
        SELECT id::text AS id, name, token_hint, default_account_id, created_at, last_used_at
        FROM cairn_webhook_tokens
        WHERE user_id = ${user.sub} AND revoked_at IS NULL
        ORDER BY created_at DESC
      `,
      sql`
        SELECT i.id::text AS id, i.provider, i.txn, i.received_at, i.acked_at, i.dismissed_at, t.name AS key_name
        FROM cairn_inbox i
        LEFT JOIN cairn_webhook_tokens t ON t.id = i.token_id
        WHERE i.user_id = ${user.sub}
        ORDER BY i.received_at DESC
        LIMIT 20
      `,
    ]);
    return Response.json({
      available: true,
      keys: (keys as KeyRow[]).map(toKey),
      recent: (recent as { id: string; provider: string; txn: unknown; received_at: string; acked_at: string | null; dismissed_at: string | null; key_name: string | null }[]).map((r) => ({
        id: r.id,
        provider: r.provider,
        txn: r.txn,
        receivedAt: iso(r.received_at),
        acked: r.acked_at !== null,
        dismissed: r.dismissed_at !== null,
        keyName: r.key_name,
      })),
    });
  } catch (e) {
    console.error("[cairn] webhook keys query failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}

/** Create a key; the key itself is returned only here. */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req, { json: true })) return jsonError("This request didn't come from the app", 403, "cross_site");
  const body = await readBody(req);
  const name = nameOf(body?.name);
  if (!body || !name) return jsonError("A name is required", 400, "invalid_body");
  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("webhooks"))) return jsonError("Webhook storage unavailable", 503, "unavailable");
    const sql = getSql();
    const token = newWebhookToken();
    // Inserted only while under the limit.
    const rows = (await sql`
      INSERT INTO cairn_webhook_tokens (user_id, name, token_hash, token_hint, default_account_id)
      SELECT ${user.sub}, ${name}, ${hashWebhookToken(token)}, ${token.slice(-4)}, ${accountOf(body.defaultAccountId)}
      WHERE (SELECT count(*) FROM cairn_webhook_tokens WHERE user_id = ${user.sub} AND revoked_at IS NULL) < ${MAX_KEYS}
      RETURNING id::text AS id, name, token_hint, default_account_id, created_at, last_used_at
    `) as KeyRow[];
    if (!rows[0]) return jsonError(`At most ${MAX_KEYS} webhook keys`, 409, "webhook_key_limit");
    return Response.json({ key: toKey(rows[0]), token });
  } catch (e) {
    console.error("[cairn] webhook key create failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}

/** Rename a key or change its default account. */
export async function PATCH(req: Request) {
  if (isCrossSiteRequest(req, { json: true })) return jsonError("This request didn't come from the app", 403, "cross_site");
  const body = await readBody(req);
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!body || !id) return jsonError("Unknown key", 400, "invalid_body");
  const name = "name" in body ? nameOf(body.name) : null;
  if (name === "") return jsonError("A name is required", 400, "invalid_body");
  const setAccount = "defaultAccountId" in body;
  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("webhooks"))) return jsonError("Webhook storage unavailable", 503, "unavailable");
    const rows = (await getSql()`
      UPDATE cairn_webhook_tokens
      SET name = coalesce(${name}, name),
          default_account_id = CASE WHEN ${setAccount} THEN ${accountOf(body.defaultAccountId)} ELSE default_account_id END
      WHERE id = ${id} AND user_id = ${user.sub} AND revoked_at IS NULL
      RETURNING id::text AS id, name, token_hint, default_account_id, created_at, last_used_at
    `) as KeyRow[];
    if (!rows[0]) return jsonError("Unknown key", 404, "not_found");
    return Response.json({ key: toKey(rows[0]) });
  } catch (e) {
    console.error("[cairn] webhook key update failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}

/** Revoke a key (`?id=`): it stops working at once. */
export async function DELETE(req: Request) {
  if (isCrossSiteRequest(req)) return jsonError("This request didn't come from the app", 403, "cross_site");
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !UUID.test(id)) return jsonError("Unknown key", 400, "invalid_body");
  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("webhooks"))) return jsonError("Webhook storage unavailable", 503, "unavailable");
    const rows = (await getSql()`
      UPDATE cairn_webhook_tokens SET revoked_at = now()
      WHERE id = ${id} AND user_id = ${user.sub} AND revoked_at IS NULL
      RETURNING id
    `) as unknown[];
    if (!rows.length) return jsonError("Unknown key", 404, "not_found");
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[cairn] webhook key revoke failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}
