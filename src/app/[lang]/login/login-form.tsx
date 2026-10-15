"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { SignedOutLanguageSwitcher } from "@/features/switch-language";
import { BRAND } from "@/shared/config";
import { apiErrorText, useI18n } from "@/shared/i18n";
import { clearTablesResponseCache } from "@/shared/lib/service-worker";
import { Alert, AlertDescription } from "@/shared/ui/kit/alert";
import { Button } from "@/shared/ui/kit/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/kit/card";
import { Input } from "@/shared/ui/kit/input";
import { Label } from "@/shared/ui/kit/label";
import { Logo } from "@/shared/ui/logo";
import { PasswordInput } from "@/shared/ui/password-input";

/**
 * The in-app page to return to after sign-in, else `/`. Resolved as a URL so
 * tricks like `/\evil.com` (browsers read `\` as `/`) can't leave the site.
 */
function safeReturnPath(from: string | null): string {
  if (!from) return "/";
  try {
    const url = new URL(from, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname === "/login") return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export function LoginForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          setError((await apiErrorText(t, res)).message);
          setBusy(false);
          return;
        }
        await clearTablesResponseCache();
        // Full load so nothing from a previous account stays in memory.
        window.location.replace(safeReturnPath(searchParams.get("from")));
        return;
      } catch {
        setError(t.common.networkError);
      }
      setBusy(false);
    },
    [username, password, searchParams, t],
  );

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <SignedOutLanguageSwitcher ariaLabel={t.common.language} />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo size={48} decorative />
        <h1 className="text-xl font-semibold tracking-tight">{BRAND.name}</h1>
        <p className="text-sm text-muted-foreground">{t.common.tagline}</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t.auth.login.title}</CardTitle>
          <CardDescription>{t.auth.login.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-username">{t.auth.login.username}</Label>
              <Input
                id="login-username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(ev) => setUsername(ev.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">{t.auth.login.password}</Label>
              <PasswordInput
                id="login-password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? t.auth.login.submitting : t.auth.login.submit}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.auth.login.newHere}{" "}
            <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
              {t.auth.login.createAccount}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
