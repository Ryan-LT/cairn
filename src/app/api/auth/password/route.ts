import { NextResponse } from "next/server";

import {
  checkPassword,
  displayNameOf,
  issueSessionCookies,
  requireActiveUser,
} from "@/shared/api/account";
import { getSql } from "@/shared/api/db";
import { isCrossSiteRequest } from "@/shared/api/request-guard";
import { validateNewPassword } from "@/shared/lib/password-policy";
import { messagesFor } from "@/shared/i18n/active";
import { errorText, type ErrorCode } from "@/shared/i18n/error-text";

export const dynamic = "force-dynamic";

/** Errors carry a `code` for the client to translate, plus an English message. */
function jsonError(code: ErrorCode, status: number, field?: string) {
  return NextResponse.json({ error: errorText(messagesFor("en"), code), code, ...(field ? { field } : {}) }, { status });
}

/**
 * Change the signed-in user's password. Signs out every other device
 * (their sessions predate `password_changed_at`); this one gets a fresh session.
 */
export async function POST(req: Request) {
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
  const currentPassword = (body as { currentPassword?: unknown }).currentPassword;
  const newPassword = (body as { newPassword?: unknown }).newPassword;
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return jsonError("invalid_body", 400);
  }

  try {
    const session = await requireActiveUser(req);
    if (!session) {
      return jsonError("unauthorized", 401);
    }

    const check = await checkPassword({ userId: session.sub }, currentPassword);
    if (check.result === "locked") {
      return jsonError("locked", 429);
    }
    if (check.result !== "ok") {
      return jsonError("current_incorrect", 400);
    }

    const problem = validateNewPassword(newPassword, {
      current: currentPassword,
      username: check.user.username,
      email: check.user.email,
    });
    if (problem) {
      return jsonError(problem, 400, "newPassword");
    }

    await getSql()`
      UPDATE cairn_users
      SET password_hash = crypt(${newPassword}, gen_salt('bf', 12)),
          password_changed_at = date_trunc('second', now()),
          failed_attempts = 0,
          locked_until = NULL
      WHERE id = ${check.user.id}
    `;

    const res = NextResponse.json({ ok: true });
    await issueSessionCookies(res, { sub: check.user.id, name: displayNameOf(check.user) });
    return res;
  } catch (e) {
    console.error("[cairn] password change failed", e);
    return jsonError("unavailable", 500);
  }
}
