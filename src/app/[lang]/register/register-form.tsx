"use client";

import Link from "next/link";
import { useState } from "react";

import { SignedOutLanguageSwitcher } from "@/features/switch-language";
import { BRAND } from "@/shared/config";
import { apiErrorText, errorText as codeText, type ErrorCode, useI18n } from "@/shared/i18n";
import { validateDisplayName, validateEmail, validateUsername } from "@/shared/lib/account-fields";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/shared/lib/password-policy";
import { clearTablesResponseCache } from "@/shared/lib/service-worker";
import { Alert, AlertDescription } from "@/shared/ui/kit/alert";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { Input } from "@/shared/ui/kit/input";
import { Label } from "@/shared/ui/kit/label";
import { Logo } from "@/shared/ui/logo";

type Field = "username" | "displayName" | "email" | "password" | "confirm";
const EMPTY: Record<Field, string> = { username: "", displayName: "", email: "", password: "", confirm: "" };
/** Honeypot label: hidden from people, meant for bots, so it stays in English. */
const HONEYPOT_LABEL = "Website";

/** Validation codes per field (`t.errors[code]`). */
function fieldErrors(v: Record<Field, string>): Partial<Record<Field, ErrorCode>> {
  const errors: Partial<Record<Field, ErrorCode>> = {};
  const username = validateUsername(v.username);
  if (username) errors.username = username;
  const displayName = validateDisplayName(v.displayName);
  if (displayName) errors.displayName = displayName;
  const email = validateEmail(v.email);
  if (email) errors.email = email;
  const password = validateNewPassword(v.password, { username: v.username.trim(), email: v.email.trim() || null });
  if (password) errors.password = password;
  if (v.confirm !== v.password) errors.confirm = "password_mismatch";
  return errors;
}

/** Public sign-up: a new, empty account that is signed in right away. */
export function RegisterForm() {
  const { t } = useI18n();
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<{ message: string; field?: string } | null>(null);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);

  const errors = fieldErrors(values);
  const valid = Object.keys(errors).length === 0;
  const shown = (f: Field) =>
    (touched[f] && errors[f] ? codeText(t, errors[f]) : undefined) ?? (serverError?.field === f ? serverError.message : undefined);

  const bind = (f: Field) => ({
    id: `register-${f}`,
    value: values[f],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setValues((v) => ({ ...v, [f]: value }));
      if (serverError?.field === f) setServerError(null);
    },
    onBlur: () => setTouched((prev) => ({ ...prev, [f]: true })),
    "aria-invalid": !!shown(f),
    "aria-describedby": shown(f) ? `register-${f}-error` : undefined,
  });

  const errorText = (f: Field) =>
    shown(f) ? (
      <p id={`register-${f}-error`} className="text-xs text-destructive">
        {shown(f)}
      </p>
    ) : null;

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
          <CardTitle>{t.auth.register.title}</CardTitle>
          <CardDescription>{t.auth.register.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              setTouched({ username: true, displayName: true, email: true, password: true, confirm: true });
              if (!valid || busy) return;
              setBusy(true);
              setServerError(null);
              try {
                const res = await fetch("/api/auth/register", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    username: values.username,
                    displayName: values.displayName,
                    email: values.email,
                    password: values.password,
                    website,
                  }),
                });
                if (!res.ok) {
                  setServerError(await apiErrorText(t, res));
                  setBusy(false);
                  return;
                }
                await clearTablesResponseCache();
                // Full load so the new account starts with a clean in-memory store;
                // Home opens on the setup guide.
                window.location.replace("/");
              } catch {
                setServerError({ message: t.common.networkError });
                setBusy(false);
              }
            }}
          >
            {serverError && !serverError.field ? (
              <Alert variant="destructive">
                <AlertDescription>{serverError.message}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-username">{t.auth.register.username}</Label>
              <Input {...bind("username")} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} />
              {errorText("username") ?? <p className="text-xs text-muted-foreground">{t.auth.register.usernameHint}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-displayName">{t.auth.register.displayName}</Label>
              <Input {...bind("displayName")} name="name" autoComplete="name" />
              {errorText("displayName")}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-email">{t.auth.register.email}</Label>
              <Input {...bind("email")} name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
              {errorText("email") ?? <p className="text-xs text-muted-foreground">{t.auth.register.emailHint}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-password">{t.auth.register.password}</Label>
              <Input {...bind("password")} name="new-password" type="password" autoComplete="new-password" />
              {errorText("password") ?? <p className="text-xs text-muted-foreground">{t.auth.register.passwordHint({ min: PASSWORD_MIN_LENGTH })}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="register-confirm">{t.auth.register.confirm}</Label>
              <Input {...bind("confirm")} name="confirm-password" type="password" autoComplete="new-password" />
              {errorText("confirm")}
            </div>
            {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <label>
                {HONEYPOT_LABEL}
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? t.auth.register.submitting : t.auth.register.submit}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t.auth.register.haveAccount}{" "}
            <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
              {t.auth.register.signIn}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
