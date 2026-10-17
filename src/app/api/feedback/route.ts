import { requireActiveUser } from "@/shared/api/account";
import { isAuthEnvConfigured } from "@/shared/api/auth-session";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH } from "@/shared/config/feedback";

export const dynamic = "force-dynamic";

/** Messages one account may send per hour. */
const MAX_PER_HOUR = 10;

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status });
}

const clip = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Store one piece of feedback from the in-app "Góp ý" button (cairn_feedback). */
export async function POST(req: Request) {
  if (isCrossSiteRequest(req, { json: true })) {
    return jsonError("This request didn't come from the app", 403, "cross_site");
  }
  if (!isAuthEnvConfigured()) {
    return jsonError("Feedback needs the server database", 503, "unavailable");
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON body", 400, "invalid_body");
  }

  const kind = typeof body.kind === "string" && (FEEDBACK_KINDS as readonly string[]).includes(body.kind) ? body.kind : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rating = typeof body.rating === "number" && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 ? body.rating : null;
  if (!kind || !message || message.length > FEEDBACK_MAX_LENGTH) {
    return jsonError("Kind and a message (1–4000 characters) are required", 400, "invalid_body");
  }

  try {
    const user = await requireActiveUser(req);
    if (!user) return jsonError("Unauthorized", 401, "unauthorized");
    if (!(await ensureSchema("feedback"))) return jsonError("Feedback storage unavailable", 503, "unavailable");

    const sql = getSql();
    const [recent] = (await sql`
      SELECT count(*)::int AS n FROM cairn_feedback
      WHERE user_id = ${user.sub} AND created_at > now() - interval '1 hour'
    `) as { n: number }[];
    if (recent.n >= MAX_PER_HOUR) return jsonError("Too much feedback at once; try again later", 429, "rate_limited");

    const locale = body.locale === "vi" || body.locale === "en" ? body.locale : null;
    const [row] = (await sql`
      INSERT INTO cairn_feedback (user_id, kind, message, rating, page, locale, viewport, user_agent)
      VALUES (
        ${user.sub}, ${kind}, ${message}, ${rating},
        ${clip(body.page, 300)}, ${locale}, ${clip(body.viewport, 40)}, ${clip(req.headers.get("user-agent"), 300)}
      )
      RETURNING id::text
    `) as { id: string }[];
    return Response.json({ ok: true, id: row.id });
  } catch (e) {
    console.error("[cairn] feedback insert failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}
