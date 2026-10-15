"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { apiErrorText, errorText, useI18n } from "@/shared/i18n";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/shared/lib/password-policy";
import { Alert, AlertDescription } from "@/shared/ui/kit/alert";
import { Button } from "@/shared/ui/kit/button";
import { Label } from "@/shared/ui/kit/label";
import { FieldError } from "@/shared/ui/field-error";
import { PasswordInput } from "@/shared/ui/password-input";

const EMPTY = { current: "", next: "", confirm: "" };

/** Current + new password. Other devices are signed out on success; this one stays signed in. */
export function ChangePasswordForm() {
  const { t } = useI18n();
  const p = t.settings.password;
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentMissing = values.current.length === 0;
  const policyError = validateNewPassword(values.next, { current: values.current || undefined });
  const mismatch = values.confirm !== values.next;
  const valid = !currentMissing && !policyError && !mismatch;
  const show = {
    current: touched.current && currentMissing,
    next: touched.next && !!policyError,
    // A mismatch shows once left, or as soon as the confirmation is as long as the new password.
    confirm: mismatch && (touched.confirm || (values.confirm.length > 0 && values.confirm.length >= values.next.length)),
  };

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <form
      className="grid gap-4 sm:max-w-sm"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (!valid) {
          setTouched({ current: true, next: true, confirm: true });
          document.getElementById(currentMissing ? "current-password" : policyError ? "new-password" : "confirm-password")?.focus();
          return;
        }
        setBusy(true);
        setError(null);
        try {
          const res = await fetch("/api/auth/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentPassword: values.current, newPassword: values.next }),
          });
          if (!res.ok) {
            setError((await apiErrorText(t, res)).message);
            return;
          }
          setValues(EMPTY);
          setTouched({ current: false, next: false, confirm: false });
          toast.success(p.changed, { description: p.changedDescription });
        } catch {
          setError(t.common.networkError);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="current-password">{p.current}</Label>
        <PasswordInput
          id="current-password"
          autoComplete="current-password"
          value={values.current}
          onChange={set("current")}
          onBlur={() => setTouched((prev) => ({ ...prev, current: true }))}
          aria-invalid={show.current}
        />
        <FieldError>{show.current ? p.currentRequired : null}</FieldError>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-password">{p.next}</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          value={values.next}
          onChange={set("next")}
          onBlur={() => setTouched((prev) => ({ ...prev, next: true }))}
          aria-invalid={show.next}
          aria-describedby="new-password-hint"
        />
        {show.next && policyError ? (
          <FieldError id="new-password-hint">{errorText(t, policyError)}</FieldError>
        ) : (
          <p id="new-password-hint" className="text-xs text-muted-foreground">
            {p.hint({ min: PASSWORD_MIN_LENGTH })}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirm-password">{p.confirm}</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={set("confirm")}
          onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
          aria-invalid={show.confirm}
        />
        <FieldError>{show.confirm ? t.errors.password_mismatch : null}</FieldError>
      </div>
      <div>
        <Button type="submit" disabled={busy}>
          <KeyRound />
          {busy ? p.submitting : p.submit}
        </Button>
      </div>
    </form>
  );
}
