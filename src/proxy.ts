import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isAuthEnvConfigured, verifySessionToken, WT_SESSION_COOKIE } from "@/shared/api/auth-session";
import { LEGACY_LOCALE_COOKIE, LOCALE_COOKIE, LOCALES, resolveLocale } from "@/shared/i18n/locale";

/**
 * Serve a page in the visitor's language without changing the URL: `/goals`
 * is rewritten to the prerendered `/vi/goals` or `/en/goals`. The language is
 * the `wt_locale` cookie (a choice the person or their account made), else
 * Vietnamese — the browser language is deliberately not used.
 */
function servePage(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/_")) return NextResponse.next();
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return NextResponse.next();

  const lang = resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.rewrite(url);
  // The old cookie was set from the browser language, not chosen; drop it.
  if (request.cookies.has(LEGACY_LOCALE_COOKIE)) res.cookies.delete(LEGACY_LOCALE_COOKIE);
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/swe-worker-") ||
    pathname.startsWith("/workbox-")
  ) {
    return NextResponse.next();
  }

  if (!isAuthEnvConfigured()) {
    return servePage(request);
  }

  const token = request.cookies.get(WT_SESSION_COOKIE)?.value ?? "";
  const secret = process.env.AUTH_SECRET!.trim();
  const ok = token.length > 0 && (await verifySessionToken(token, secret)) !== null;

  // Sign-in and sign-up pages: signed-in visitors go straight to the app.
  if (["/login", "/register"].some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (ok) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return servePage(request);
  }

  if (
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/auth/logout") ||
    pathname.startsWith("/api/auth/register") ||
    // Public market data (exchange rate, gold prices), cached at the CDN.
    pathname === "/api/rates" ||
    // Bank webhook (its own key) and opening a shared report (its password).
    pathname === "/api/webhooks/transactions" ||
    pathname === "/api/shares/view"
  ) {
    return NextResponse.next();
  }

  // Shared report page: anyone with the link and password, signed in or not.
  if (pathname === "/share" || LOCALES.some((l) => pathname === `/${l}/share`)) {
    return servePage(request);
  }

  if (!ok) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return servePage(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
