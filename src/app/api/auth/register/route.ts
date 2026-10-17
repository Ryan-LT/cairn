import { NextResponse } from "next/server";

import { issueSessionCookies } from "@/shared/api/account";
import { isAuthEnvConfigured } from "@/shared/api/auth-session";
import { clientIpHash } from "@/shared/api/client-ip";
import { getSql } from "@/shared/api/db";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import {
  normalizeSignInName,
  validateDisplayName,
  validateEmail,
  validateUsername,
} from "@/shared/lib/account-fields";
import { validateNewPassword } from "@/shared/lib/password-policy";
import { messagesFor } from "@/shared/i18n/active";
import { errorText, type ErrorCode } from "@/shared/i18n/error-text";

export const dynamic = "force-dynamic";

/** Public sign-up limits (see db/migrations/2026-10-signup.sql). */
const MAX_ATTEMPTS_PER_IP_HOUR = 20;
const MAX_ACCOUNTS_PER_IP_HOUR = 3;
const MAX_ACCOUNTS_PER_DAY = 50;

/** Errors carry a `code` for the client to translate, plus an English message. */
function jsonError(code: ErrorCode, status: number, field?: string) {
  return NextResponse.json({ error: errorText(messagesFor("en"), code), code, ...(field ? { field } : {}) }, { status });
}

type Limits = { ip_attempts: number; ip_created: number; day_created: number };

/** Create an account (empty data) and sign it in. */
export async function POST(req: Request) {
  if (!isAuthEnvConfigured()) {
    return jsonError("auth_not_configured", 503);
  }
  if (isCrossSiteRequest(req, { json: true })) {
    return jsonError("cross_site", 403);
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("invalid_body", 400);
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  // Hidden field a person never fills in; bots usually do.
  if (str("website")) {
    return jsonError("signup_rejected", 400);
  }

  const username = normalizeSignInName(str("username"));
  const email = normalizeSignInName(str("email"));
  const displayName = str("displayName").trim();
  const password = str("password");

  const sql = getSql();
  const ipHash = clientIpHash(req);
  const recordAttempt = (succeeded: boolean) =>
    sql`INSERT INTO cairn_signup_attempts (ip_hash, succeeded) VALUES (${ipHash}, ${succeeded})`;

  try {
    await sql`DELETE FROM cairn_signup_attempts WHERE created_at < now() - interval '1 day'`;
    const [limits] = (await sql`
      SELECT
        count(*) FILTER (WHERE ip_hash = ${ipHash} AND created_at > now() - interval '1 hour')::int AS ip_attempts,
        count(*) FILTER (WHERE ip_hash = ${ipHash} AND succeeded AND created_at > now() - interval '1 hour')::int AS ip_created,
        count(*) FILTER (WHERE succeeded)::int AS day_created
      FROM cairn_signup_attempts
    `) as Limits[];
    if (limits.ip_attempts >= MAX_ATTEMPTS_PER_IP_HOUR || limits.ip_created >= MAX_ACCOUNTS_PER_IP_HOUR) {
      return jsonError("signup_rate_limited", 429);
    }
    if (limits.day_created >= MAX_ACCOUNTS_PER_DAY) {
      return jsonError("signup_paused", 429);
    }

    const invalid =
      (validateUsername(username) && { field: "username", error: validateUsername(username)! }) ||
      (validateDisplayName(displayName) && { field: "displayName", error: validateDisplayName(displayName)! }) ||
      (validateEmail(email) && { field: "email", error: validateEmail(email)! }) ||
      (validateNewPassword(password, { username, email }) && {
        field: "password",
        error: validateNewPassword(password, { username, email })!,
      });
    if (invalid) {
      await recordAttempt(false);
      return jsonError(invalid.error, 400, invalid.field);
    }

    // Sign-in looks names up as username OR email, so neither may collide with any account's.
    const taken = (await sql`
      SELECT
        bool_or(username = ${username} OR email = ${username}) AS username_taken,
        bool_or(${email} <> '' AND (username = ${email} OR email = ${email})) AS email_taken
      FROM cairn_users
    `) as { username_taken: boolean | null; email_taken: boolean | null }[];
    if (taken[0]?.username_taken) {
      await recordAttempt(false);
      return jsonError("username_taken", 409, "username");
    }
    if (taken[0]?.email_taken) {
      await recordAttempt(false);
      return jsonError("email_taken", 409, "email");
    }

    let created: { id: string }[];
    try {
      created = (await sql`
        INSERT INTO cairn_users (username, display_name, email, password_hash)
        VALUES (${username}, ${displayName || null}, ${email || null}, crypt(${password}, gen_salt('bf', 12)))
        RETURNING id::text AS id
      `) as { id: string }[];
    } catch (e) {
      // Lost a race with a sign-up for the same name.
      if ((e as { code?: string }).code === "23505") {
        await recordAttempt(false);
        return jsonError("name_taken", 409);
      }
      throw e;
    }
    await recordAttempt(true);

    const res = NextResponse.json({ ok: true });
    await issueSessionCookies(res, { sub: created[0]!.id, name: displayName || username });
    return res;
  } catch (e) {
    console.error("[cairn] sign-up failed", e);
    return jsonError("unavailable", 500);
  }
}
