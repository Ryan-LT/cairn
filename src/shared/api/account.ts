import type { NextResponse } from "next/server";

import {
  SESSION_MAX_AGE_SEC,
  WT_SESSION_COOKIE,
  WT_USER_COOKIE,
  createSessionToken,
  encodeUserCookie,
  getSessionUser,
  type SessionClaims,
  type SessionUserClaims,
} from "@/shared/api/auth-session";
import { getSql } from "@/shared/api/db";

/** Wrong passwords in a row before the account locks. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/**
 * The request's session, if it is still valid in the database: the account
 * exists and its password hasn't changed since the session was issued.
 * Use in route handlers (the proxy only checks the signature).
 */
export async function requireActiveUser(req: Request): Promise<SessionClaims | null> {
  const claims = await getSessionUser(req);
  if (!claims) return null;
  const rows = (await getSql()`
    SELECT 1
    FROM cairn_users
    WHERE id = ${claims.sub}
      AND (password_changed_at IS NULL OR password_changed_at <= to_timestamp(${claims.iat}::double precision))
  `) as unknown[];
  return rows.length > 0 ? claims : null;
}

/** Signed HttpOnly session cookie plus the readable `wt_user` companion. */
export async function issueSessionCookies(res: NextResponse, claims: SessionUserClaims): Promise<void> {
  const token = await createSessionToken(process.env.AUTH_SECRET!.trim(), claims);
  const cookie = {
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  };
  res.cookies.set(WT_SESSION_COOKIE, token, { ...cookie, httpOnly: true });
  res.cookies.set(WT_USER_COOKIE, encodeUserCookie(claims), { ...cookie, httpOnly: false });
}

export type AccountUser = { id: string; username: string; displayName: string | null; email: string | null };

export type PasswordCheck =
  | { result: "ok"; user: AccountUser }
  /** Unknown account or wrong password (deliberately indistinguishable). */
  | { result: "invalid" }
  /** Right password, but the account is locked after too many wrong ones. */
  | { result: "locked" };

type CheckRow = {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  locked: boolean;
  ok: boolean;
};

/**
 * Check a password with lockout: every wrong one counts, and the
 * {@link MAX_FAILED_ATTEMPTS}th locks the account for {@link LOCK_MINUTES} minutes.
 * Look the account up by sign-in name (username or email) or by id.
 */
export async function checkPassword(
  who: { identifier: string } | { userId: string },
  password: string,
): Promise<PasswordCheck> {
  const sql = getSql();
  // bcrypt runs in Postgres (pgcrypto); see db/create-user.sql.
  const rows = (
    "userId" in who
      ? await sql`
          SELECT id::text AS id, username, display_name, email,
                 (locked_until IS NOT NULL AND locked_until > now()) AS locked,
                 (password_hash = crypt(${password}, password_hash)) AS ok
          FROM cairn_users
          WHERE id = ${who.userId}
        `
      : await sql`
          SELECT id::text AS id, username, display_name, email,
                 (locked_until IS NOT NULL AND locked_until > now()) AS locked,
                 (password_hash = crypt(${password}, password_hash)) AS ok
          FROM cairn_users
          WHERE username = lower(trim(${who.identifier})) OR email = lower(trim(${who.identifier}))
          ORDER BY (username = lower(trim(${who.identifier}))) DESC
          LIMIT 1
        `
  ) as CheckRow[];
  const row = rows[0];
  if (!row) return { result: "invalid" };

  if (!row.ok) {
    if (!row.locked) {
      await sql`
        UPDATE cairn_users
        SET failed_attempts = CASE WHEN failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 0 ELSE failed_attempts + 1 END,
            locked_until = CASE
              WHEN failed_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} THEN now() + make_interval(mins => ${LOCK_MINUTES})
              ELSE locked_until
            END
        WHERE id = ${row.id}
      `;
    }
    return { result: "invalid" };
  }
  if (row.locked) return { result: "locked" };

  await sql`
    UPDATE cairn_users
    SET failed_attempts = 0, locked_until = NULL
    WHERE id = ${row.id} AND (failed_attempts <> 0 OR locked_until IS NOT NULL)
  `;
  return {
    result: "ok",
    user: { id: row.id, username: row.username, displayName: row.display_name, email: row.email },
  };
}

/** Name shown in the app for an account. */
export function displayNameOf(user: AccountUser): string {
  return user.displayName?.trim() || user.username;
}
