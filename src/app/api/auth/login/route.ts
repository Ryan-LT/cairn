import { NextResponse } from "next/server";

import { checkPassword, displayNameOf, issueSessionCookies } from "@/shared/api/account";
import { isAuthEnvConfigured } from "@/shared/api/auth-session";
import { clientIpHash } from "@/shared/api/client-ip";
import { getSql } from "@/shared/api/db";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import { messagesFor } from "@/shared/i18n/active";
import { errorText, type ErrorCode } from "@/shared/i18n/error-text";

export const dynamic = "force-dynamic";

/**
 * Wrong passwords from one network before it has to wait (any accounts; see
 * db/migrations/2026-10-login-throttle.sql). Complements the per-account lockout.
 */
const MAX_FAILURES_PER_IP = 30;
const FAILURE_WINDOW_MINUTES = 15;

type Sql = ReturnType<typeof getSql>;

/** Fails open (logged) so a missing table can't block every sign-in. */
async function ipIsThrottled(sql: Sql, ipHash: string): Promise<boolean> {
  try {
    const [row] = (await sql`
      SELECT count(*)::int AS n
      FROM cairn_login_failures
      WHERE ip_hash = ${ipHash} AND created_at > now() - make_interval(mins => ${FAILURE_WINDOW_MINUTES})
    `) as { n: number }[];
    return (row?.n ?? 0) >= MAX_FAILURES_PER_IP;
  } catch (e) {
    console.error("[cairn] login throttle unavailable", e);
    return false;
  }
}

async function recordFailure(sql: Sql, ipHash: string): Promise<void> {
  try {
    await sql`DELETE FROM cairn_login_failures WHERE created_at < now() - interval '1 day'`;
    await sql`INSERT INTO cairn_login_failures (ip_hash) VALUES (${ipHash})`;
  } catch (e) {
    console.error("[cairn] login throttle unavailable", e);
  }
}

/** Errors carry a `code` for the client to translate, plus an English message. */
function jsonError(code: ErrorCode, status: number, field?: string) {
  return NextResponse.json({ error: errorText(messagesFor("en"), code), code, ...(field ? { field } : {}) }, { status });
}

export async function POST(req: Request) {
  if (!isAuthEnvConfigured()) {
    return jsonError("auth_not_configured", 503);
  }
  if (isCrossSiteRequest(req, { json: true })) {
    return jsonError("cross_site", 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_body", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("invalid_body", 400);
  }

  // `username` holds the sign-in name: username or email.
  const username = (body as { username?: unknown }).username;
  const password = (body as { password?: unknown }).password;
  if (typeof username !== "string" || typeof password !== "string") {
    return jsonError("invalid_body", 400);
  }
  if (username.length > 254 || password.length > 256) {
    return jsonError("invalid_credentials", 401);
  }

  const sql = getSql();
  const ipHash = clientIpHash(req);
  // Before checking the password, so a flood never reaches bcrypt.
  if (await ipIsThrottled(sql, ipHash)) {
    return jsonError("login_rate_limited", 429);
  }

  let check: Awaited<ReturnType<typeof checkPassword>>;
  try {
    check = await checkPassword({ identifier: username }, password);
  } catch (e) {
    console.error("[cairn] login query failed", e);
    return jsonError("unavailable", 500);
  }

  if (check.result === "locked") {
    return jsonError("locked", 429);
  }
  if (check.result !== "ok") {
    await recordFailure(sql, ipHash);
    return jsonError("invalid_credentials", 401);
  }

  const res = NextResponse.json({ ok: true });
  await issueSessionCookies(res, { sub: check.user.id, name: displayNameOf(check.user) });
  return res;
}
