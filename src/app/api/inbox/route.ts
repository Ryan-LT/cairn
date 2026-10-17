import { requireActiveUser } from "@/shared/api/account";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";

export const dynamic = "force-dynamic";

/** How far back the app re-checks that webhook transactions are in the ledger. */
const RECHECK_DAYS = 45;
const MAX_ROWS = 1000;

type Row = { id: string; provider: string; txn: unknown; received_at: string; acked_at: string | null; default_account_id: string | null };

/**
 * Webhook transactions for the app to copy into the ledger. `?scope=pending`:
 * only those no device has copied yet (cheap to poll); otherwise everything
 * from the last 45 days, so a copy lost to an older save is put back.
 * Rows deleted in the app are left out.
 */
export async function GET(req: Request) {
  try {
    const user = await requireActiveUser(req);
    if (!user) return Response.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    if (!(await ensureSchema("webhooks"))) return Response.json({ items: [] });
    const pending = new URL(req.url).searchParams.get("scope") === "pending";
    const rows = (await getSql()`
      SELECT i.id::text AS id, i.provider, i.txn, i.received_at, i.acked_at, t.default_account_id
      FROM cairn_inbox i
      LEFT JOIN cairn_webhook_tokens t ON t.id = i.token_id
      WHERE i.user_id = ${user.sub} AND i.dismissed_at IS NULL
        AND (${pending} AND i.acked_at IS NULL OR NOT ${pending} AND i.received_at > now() - make_interval(days => ${RECHECK_DAYS}))
      ORDER BY i.received_at DESC
      LIMIT ${MAX_ROWS}
    `) as Row[];
    return Response.json(
      {
        items: rows.map((r) => ({
          id: r.id,
          provider: r.provider,
          receivedAt: new Date(r.received_at).toISOString(),
          defaultAccountId: r.default_account_id,
          acked: r.acked_at !== null,
          txn: r.txn,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[cairn] inbox query failed", e);
    return Response.json({ error: "Database error", code: "unavailable" }, { status: 500 });
  }
}
