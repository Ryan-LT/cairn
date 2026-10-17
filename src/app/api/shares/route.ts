import {
  REPORT_SECTIONS,
  SHARE_EXPIRY_DAYS,
  SHARE_PASSWORD_MAX,
  SHARE_PASSWORD_MIN,
  SHARE_TITLE_MAX,
  type ReportSection,
} from "@/entities/report/model";
import { sanitizeSharedReport } from "@/entities/report/lib/sanitize";
import { requireActiveUser } from "@/shared/api/account";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import { newShareId, SHARE_ID_PATTERN, sealWithPassword } from "@/shared/api/secrets";

export const dynamic = "force-dynamic";

const MAX_REPORT_JSON = 256 * 1024;
/** Links one account may have at a time. */
const MAX_SHARES = 50;

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status });
}

type ShareRow = {
  id: string;
  title: string;
  period: { from: string; to: string; all: boolean };
  sections: string[];
  created_at: string;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
};

const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
const toShare = (r: ShareRow) => ({
  id: r.id,
  title: r.title,
  period: r.period,
  sections: r.sections,
  createdAt: iso(r.created_at),
  expiresAt: iso(r.expires_at),
  viewCount: r.view_count,
  lastViewedAt: iso(r.last_viewed_at),
});

/** The account's share links (the reports themselves stay encrypted). */
export async function GET(req: Request) {
  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("shares"))) return Response.json({ available: false, shares: [] });
    const rows = (await getSql()`
      SELECT id, title, period, sections, created_at, expires_at, view_count, last_viewed_at
      FROM cairn_shares
      WHERE user_id = ${user.sub}
      ORDER BY created_at DESC
    `) as ShareRow[];
    return Response.json({ available: true, shares: rows.map(toShare) });
  } catch (e) {
    console.error("[cairn] shares query failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}

/**
 * Create a link: `{ password, expiresInDays, report }`. The report (built on
 * the owner's device) is checked, then stored encrypted with the password.
 */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req, { json: true })) return jsonError("This request didn't come from the app", 403, "cross_site");
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400, "invalid_body");
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < SHARE_PASSWORD_MIN || password.length > SHARE_PASSWORD_MAX) {
    return jsonError(`The password needs ${SHARE_PASSWORD_MIN}–${SHARE_PASSWORD_MAX} characters`, 400, "share_password_short");
  }
  const expiresInDays = body.expiresInDays ?? null;
  if (!(SHARE_EXPIRY_DAYS as readonly unknown[]).includes(expiresInDays)) return jsonError("Invalid expiry", 400, "invalid_body");
  const report = sanitizeSharedReport(body.report);
  if (!report) return jsonError("The report is incomplete", 400, "invalid_body");
  const plaintext = JSON.stringify(report);
  if (plaintext.length > MAX_REPORT_JSON) return jsonError("The report is too large", 413, "too_large");
  const sections = report.sections.filter((s): s is ReportSection => (REPORT_SECTIONS as readonly string[]).includes(s));

  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("shares"))) return jsonError("Share storage unavailable", 503, "unavailable");
    const sql = getSql();
    const sealed = await sealWithPassword(plaintext, password);
    const rows = (await sql`
      INSERT INTO cairn_shares (id, user_id, title, period, sections, salt, iv, ciphertext, expires_at)
      SELECT ${newShareId()}, ${user.sub}, ${report.title.slice(0, SHARE_TITLE_MAX)}, ${JSON.stringify(report.period)}::jsonb, ${sections}::text[],
             ${sealed.salt}, ${sealed.iv}, ${sealed.ciphertext},
             CASE WHEN ${expiresInDays}::int IS NULL THEN NULL ELSE now() + make_interval(days => ${expiresInDays}::int) END
      WHERE (SELECT count(*) FROM cairn_shares WHERE user_id = ${user.sub}) < ${MAX_SHARES}
      RETURNING id, title, period, sections, created_at, expires_at, view_count, last_viewed_at
    `) as ShareRow[];
    if (!rows[0]) return jsonError(`At most ${MAX_SHARES} share links; remove an old one first`, 409, "share_limit");
    return Response.json({ share: toShare(rows[0]) });
  } catch (e) {
    console.error("[cairn] share create failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}

/** Remove a link (`?id=`): it stops working at once. */
export async function DELETE(req: Request) {
  if (isCrossSiteRequest(req)) return jsonError("This request didn't come from the app", 403, "cross_site");
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !SHARE_ID_PATTERN.test(id)) return jsonError("Unknown link", 400, "invalid_body");
  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("shares"))) return jsonError("Share storage unavailable", 503, "unavailable");
    const rows = (await getSql()`DELETE FROM cairn_shares WHERE id = ${id} AND user_id = ${user.sub} RETURNING id`) as unknown[];
    if (!rows.length) return jsonError("Unknown link", 404, "not_found");
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[cairn] share delete failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}
