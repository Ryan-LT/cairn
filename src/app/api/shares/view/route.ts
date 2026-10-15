import { isAuthEnvConfigured } from "@/shared/api/auth-session";
import { clientIpHash } from "@/shared/api/client-ip";
import { getSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import { openWithPassword, SHARE_ID_PATTERN } from "@/shared/api/secrets";

export const dynamic = "force-dynamic";

/** Wrong passwords allowed: per network per link (15 min), per link (1 h), per network (1 h). */
const MAX_IP_SHARE_15M = 10;
const MAX_SHARE_HOUR = 50;
const MAX_IP_HOUR = 100;

const NO_STORE = { "Cache-Control": "no-store" };

function jsonError(message: string, status: number, code: string) {
  return Response.json({ error: message, code }, { status, headers: NO_STORE });
}

type ShareRow = { salt: string; iv: string; ciphertext: string };

const DECOY: ShareRow = { salt: "AAAAAAAAAAAAAAAAAAAAAA==", iv: "AAAAAAAAAAAAAAAA", ciphertext: "A".repeat(44) };

/**
 * Open a shared report: `{ id, password }`. Public (no session). An unknown
 * link, an expired one and a wrong password get the same answer, and wrong
 * tries are throttled.
 */
export async function POST(req: Request) {
  if (!isAuthEnvConfigured()) return jsonError("Sharing needs the server database", 503, "unavailable");
  if (isCrossSiteRequest(req, { json: true })) return jsonError("This request didn't come from the app", 403, "cross_site");
  let id: string;
  let password: string;
  try {
    const body = (await req.json()) as { id?: unknown; password?: unknown };
    if (typeof body.id !== "string" || !SHARE_ID_PATTERN.test(body.id) || typeof body.password !== "string" || !body.password || body.password.length > 200) {
      throw new Error();
    }
    id = body.id;
    password = body.password;
  } catch {
    return jsonError("Link or password is wrong", 403, "share_invalid");
  }

  try {
    if (!(await ensureSchema("shares"))) return jsonError("Sharing is unavailable", 503, "unavailable");
    const sql = getSql();
    const ipHash = clientIpHash(req);
    await sql`DELETE FROM wealthtracker_share_failures WHERE created_at < now() - interval '1 day'`;
    const [tries] = (await sql`
      SELECT
        count(*) FILTER (WHERE ip_hash = ${ipHash} AND share_id = ${id} AND created_at > now() - interval '15 minutes')::int AS ip_share,
        count(*) FILTER (WHERE share_id = ${id})::int AS share_hour,
        count(*) FILTER (WHERE ip_hash = ${ipHash})::int AS ip_hour
      FROM wealthtracker_share_failures
      WHERE created_at > now() - interval '1 hour' AND (ip_hash = ${ipHash} OR share_id = ${id})
    `) as { ip_share: number; share_hour: number; ip_hour: number }[];
    if (tries.ip_share >= MAX_IP_SHARE_15M || tries.share_hour >= MAX_SHARE_HOUR || tries.ip_hour >= MAX_IP_HOUR) {
      return jsonError("Too many wrong tries. Try again later.", 429, "share_rate_limited");
    }

    const [row] = (await sql`
      SELECT salt, iv, ciphertext FROM wealthtracker_shares
      WHERE id = ${id} AND (expires_at IS NULL OR expires_at > now())
    `) as ShareRow[];
    // Run the key derivation either way, so timing doesn't tell whether the link exists.
    const plaintext = await openWithPassword(row ?? DECOY, password);
    if (plaintext === null) {
      await sql`INSERT INTO wealthtracker_share_failures (share_id, ip_hash) VALUES (${id}, ${ipHash})`;
      return jsonError("Link or password is wrong", 403, "share_invalid");
    }
    await sql`UPDATE wealthtracker_shares SET view_count = view_count + 1, last_viewed_at = now() WHERE id = ${id}`;
    return new Response(`{"report":${plaintext}}`, { headers: { "Content-Type": "application/json", ...NO_STORE } });
  } catch (e) {
    console.error("[wealthtracker] share view failed", e);
    return jsonError("Database error", 500, "unavailable");
  }
}
