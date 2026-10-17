import { randomUUID } from "node:crypto";

import { parseWebhookBody } from "@/entities/ledger/lib/bank-feed/parse";
import { isAuthEnvConfigured } from "@/shared/api/auth-session";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { hashWebhookToken } from "@/shared/api/secrets";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;
/** Transactions one key may send per minute, and one account may receive per day. */
const MAX_PER_TOKEN_MINUTE = 120;
const MAX_PER_USER_DAY = 2000;

function jsonError(message: string, status: number, code: string, extra?: Record<string, unknown>) {
  return Response.json({ success: false, error: message, code, ...extra }, { status });
}

/** The key from `Authorization: Bearer|Apikey <key>`, Casso's `secure-token`, `x-api-key`, or `?token=`. */
function tokenOf(req: Request): string | null {
  const auth = req.headers.get("authorization")?.trim();
  const fromAuth = auth?.match(/^(?:bearer|apikey|token)\s+(\S+)$/i)?.[1];
  const token = fromAuth ?? req.headers.get("secure-token") ?? req.headers.get("x-api-key") ?? new URL(req.url).searchParams.get("token");
  const t = token?.trim();
  return t && t.length <= 200 ? t : null;
}

type TokenRow = { id: string; user_id: string };

/**
 * Bank transactions from SePay, Casso or any script, authenticated by a
 * webhook key from Settings → Connect. They wait in the inbox until the
 * owner's app copies them into the ledger.
 */
export async function POST(req: Request) {
  if (!isAuthEnvConfigured()) return jsonError("Webhooks need the server database", 503, "unavailable");
  const token = tokenOf(req);
  if (!token) return jsonError("Missing webhook key", 401, "webhook_unauthorized");

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return jsonError("Body too large", 413, "too_large");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return jsonError("Body too large", 413, "too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError("Body must be JSON", 400, "invalid_body");
  }

  try {
    if (!(await ensureSchema("webhooks"))) return jsonError("Webhook storage unavailable", 503, "unavailable");
    const sql = getSql();
    const [key] = (await sql`
      SELECT id::text AS id, user_id::text AS user_id
      FROM cairn_webhook_tokens
      WHERE token_hash = ${hashWebhookToken(token)} AND revoked_at IS NULL
    `) as TokenRow[];
    if (!key) return jsonError("Unknown or revoked webhook key", 401, "webhook_unauthorized");

    const parsed = parseWebhookBody(body);
    if (!parsed.ok) return jsonError(parsed.message, 400, parsed.code, parsed.index !== undefined ? { index: parsed.index } : undefined);
    if (parsed.items.length === 0) return Response.json({ success: true, received: 0, created: 0, duplicates: 0 });

    const [usage] = (await sql`
      SELECT
        count(*) FILTER (WHERE token_id = ${key.id} AND received_at > now() - interval '1 minute')::int AS minute,
        count(*)::int AS day
      FROM cairn_inbox
      WHERE user_id = ${key.user_id} AND received_at > now() - interval '1 day'
    `) as { minute: number; day: number }[];
    if (usage.minute + parsed.items.length > MAX_PER_TOKEN_MINUTE || usage.day + parsed.items.length > MAX_PER_USER_DAY) {
      return jsonError("Too many transactions; slow down", 429, "rate_limited");
    }

    // Without the sender's id each delivery is new; with it, a repeat is ignored.
    const rows = [...new Map(parsed.items.map((i) => [i.ref ?? `auto:${randomUUID()}`, i.txn])).entries()].map(([ref, txn]) => ({ ref, txn }));
    const created = (await sql`
      INSERT INTO cairn_inbox (user_id, token_id, provider, external_ref, txn)
      SELECT ${key.user_id}::uuid, ${key.id}::uuid, ${parsed.provider}, r.ref, r.txn
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(ref text, txn jsonb)
      ON CONFLICT (user_id, provider, external_ref) DO NOTHING
      RETURNING id::text AS id
    `) as { id: string }[];
    await sql`UPDATE cairn_webhook_tokens SET last_used_at = now() WHERE id = ${key.id}`;

    return Response.json({
      success: true,
      provider: parsed.provider,
      received: parsed.items.length,
      created: created.length,
      duplicates: parsed.items.length - created.length,
      ids: created.map((c) => c.id),
    });
  } catch (e) {
    console.error("[cairn] webhook failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}
