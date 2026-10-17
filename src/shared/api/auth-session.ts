/** HttpOnly cookie set on successful login. */
export const WT_SESSION_COOKIE = "wt_session";

/**
 * Readable (non-HttpOnly) companion cookie: `{ id, name }` of the signed-in user,
 * for display and per-account device caches. Never trusted by the server.
 */
export const WT_USER_COOKIE = "wt_user";

/** Default session length (also used for cookie Max-Age). */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function timingSafeEqualB64(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256B64Url(payloadB64: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return base64urlEncode(new Uint8Array(sig));
}

/** Who a session belongs to: `sub` is the `cairn_users.id`. */
export type SessionUserClaims = { sub: string; name: string };

/**
 * A verified session. `iat` (issued at, epoch seconds) lets a password change
 * void older sessions; tokens from before it was added read as `0`.
 */
export type SessionClaims = SessionUserClaims & { iat: number };

export async function createSessionToken(secret: string, claims: SessionUserClaims): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_MAX_AGE_SEC;
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify({ sub: claims.sub, name: claims.name, iat, exp })));
  const sig = await hmacSha256B64Url(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/** The session's claims, or `null` when the token is forged, expired or from before multi-account login. */
export async function verifySessionToken(token: string, secret: string): Promise<SessionClaims | null> {
  const dot = token.indexOf(".");
  if (dot < 1) {
    return null;
  }
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payloadB64 || !sig) {
    return null;
  }
  const expected = await hmacSha256B64Url(payloadB64, secret);
  if (!timingSafeEqualB64(sig, expected)) {
    return null;
  }
  try {
    const json = new TextDecoder().decode(base64urlToBytes(payloadB64));
    const { sub, name, iat, exp } = JSON.parse(json) as { sub?: unknown; name?: unknown; iat?: unknown; exp?: unknown };
    if (typeof exp !== "number" || exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (typeof sub !== "string" || sub.length === 0) {
      return null;
    }
    return { sub, name: typeof name === "string" ? name : "", iat: typeof iat === "number" ? iat : 0 };
  } catch {
    return null;
  }
}

/** Value of the readable {@link WT_USER_COOKIE}. */
export function encodeUserCookie(claims: SessionUserClaims): string {
  return base64urlEncode(encoder.encode(JSON.stringify({ id: claims.sub, name: claims.name })));
}

/**
 * Login is required whenever the app has a database: accounts live in
 * `cairn_users`. With no `DATABASE_URL` (local sandbox) the gate is off.
 */
export function isAuthEnvConfigured(): boolean {
  const db = process.env.DATABASE_URL?.trim();
  const secret = process.env.AUTH_SECRET?.trim();
  return Boolean(db && secret);
}

/** Verified session of the request, or `null` when signed out (or auth is not configured). */
export async function getSessionUser(request: Request): Promise<SessionClaims | null> {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;
  const token = readCookie(request.headers.get("cookie"), WT_SESSION_COOKIE);
  return token ? verifySessionToken(token, secret) : null;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}
