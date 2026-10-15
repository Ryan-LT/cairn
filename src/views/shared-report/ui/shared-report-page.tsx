"use client";

import { Languages, LockKeyhole } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { sanitizeSharedReport, type SharedReport } from "@/entities/report";
import { LANGUAGE_OPTIONS } from "@/features/switch-language";
import { BRAND } from "@/shared/config";
import { apiErrorText, I18nProvider, useI18n, type Locale } from "@/shared/i18n";
import { Callout } from "@/shared/ui/callout";
import { Alert, AlertDescription } from "@/shared/ui/kit/alert";
import { Button } from "@/shared/ui/kit/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { Input } from "@/shared/ui/kit/input";
import { Label } from "@/shared/ui/kit/label";
import { Logo } from "@/shared/ui/logo";
import { SegmentedControl } from "@/shared/ui/segmented-control";

import { ReportView } from "./report-view";

const ID = /^[A-Za-z0-9_-]{22}$/;

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/** The link's id, from after `#` (never sent to the server with the page request). */
function useShareId(): string | null | undefined {
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => undefined,
  );
  if (hash === undefined) return undefined;
  return ID.test(hash) ? hash : null;
}

/**
 * `/share#<id>`: anyone with the link enters the password to see the report.
 * The viewer can switch language in place (a reload would lock it again).
 */
export function SharedReportPage() {
  const { locale: pageLocale, t } = useI18n();
  const [locale, setLocale] = useState<Locale>(pageLocale);
  const switcher = (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Languages className="size-4" aria-hidden />
      <SegmentedControl<Locale> aria-label={t.common.language} value={locale} onValueChange={setLocale} options={LANGUAGE_OPTIONS} />
    </div>
  );
  return (
    <I18nProvider locale={locale}>
      <Viewer switcher={switcher} />
    </I18nProvider>
  );
}

function Viewer({ switcher }: { switcher: React.ReactNode }) {
  const { t } = useI18n();
  const v = t.connect.view;
  const id = useShareId();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SharedReport | null>(null);

  if (report) {
    return (
      <main className="min-h-svh bg-background">
        <ReportView
          report={report}
          languageSwitcher={switcher}
          onLock={() => {
            setReport(null);
            setPassword("");
          }}
        />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-12">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">{switcher}</div>
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo size={48} decorative />
        <p className="text-sm text-muted-foreground">{v.sharedWith({ brand: BRAND.name })}</p>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-muted-foreground" aria-hidden />
            {v.lockedTitle}
          </CardTitle>
          <CardDescription>{v.lockedBody}</CardDescription>
        </CardHeader>
        <CardContent>
          {id === null ? (
            <Callout tone="warning">{v.noLink}</Callout>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!id || !password || busy) return;
                setBusy(true);
                setError(null);
                try {
                  const res = await fetch("/api/shares/view", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id, password }),
                  });
                  if (!res.ok) {
                    setError((await apiErrorText(t, res)).message);
                    return;
                  }
                  const data = (await res.json()) as { report?: unknown };
                  const opened = sanitizeSharedReport(data.report);
                  if (!opened) {
                    setError(t.errors.unavailable);
                    return;
                  }
                  setReport(opened);
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="share-password">{v.password}</Label>
                <Input id="share-password" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus required />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !password || !id}>
                {busy ? v.opening : v.open}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
