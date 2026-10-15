"use client";

import { Check, CircleAlert, Copy, Link2, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { buildSharedReport, REPORT_SECTIONS, SHARE_PASSWORD_MIN, SHARE_TITLE_MAX, type ReportSection } from "@/entities/report";
import { apiErrorText, useI18n } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import { formatDate } from "@/shared/lib/format";
import { addMonths } from "@/shared/lib/month";
import { Alert, AlertDescription } from "@/shared/ui/kit/alert";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { Label } from "@/shared/ui/kit/label";
import { FieldError } from "@/shared/ui/field-error";
import { PasswordInput } from "@/shared/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Switch } from "@/shared/ui/kit/switch";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { StatusBadge } from "@/shared/ui/status-badge";

import { useReportData } from "../model/use-report-data";

/** A share link as `GET /api/shares` lists it. */
export type ShareLink = {
  id: string;
  title: string;
  period: { from: string; to: string; all: boolean };
  sections: ReportSection[];
  createdAt: string;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
};

export function shareUrl(id: string): string {
  return `${window.location.origin}/share#${id}`;
}

export async function copyShareLink(id: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(shareUrl(id));
    toast.success(done);
  } catch {
    // No clipboard (insecure context, denied): the link stays visible to copy by hand.
  }
}

const EXPIRY = ["7", "30", "90", "never"] as const;
type Expiry = (typeof EXPIRY)[number];

/** Pick a period, sections, password and expiry; creates an encrypted snapshot link. */
export function ShareReportDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated?: (share: ShareLink) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">{open ? <ShareForm onClose={() => onOpenChange(false)} onCreated={onCreated} /> : null}</DialogContent>
    </Dialog>
  );
}

function ShareForm({ onClose, onCreated }: { onClose: () => void; onCreated?: (share: ShareLink) => void }) {
  const { t } = useI18n();
  const d = t.connect.shareDialog;
  const ids = { title: useId(), password: useId(), confirm: useId(), from: useId(), to: useId() };
  const data = useReportData();
  const today = todayIso();
  const current = today.slice(0, 7);

  // Months that can be picked: from the first record (or two years back) to this month, newest first.
  const first = data.txns.reduce((m, x) => (x.date.slice(0, 7) < m ? x.date.slice(0, 7) : m), addMonths(current, -23));
  const months: string[] = [];
  for (let m = current; m >= first && months.length < 120; m = addMonths(m, -1)) months.push(m);

  const [title, setTitle] = useState(d.defaultTitle);
  const [all, setAll] = useState(false);
  const [from, setFrom] = useState(addMonths(current, -2));
  const [to, setTo] = useState(current);
  const [sections, setSections] = useState<Set<ReportSection>>(() => new Set(["cashflow", "categories"]));
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [expiry, setExpiry] = useState<Expiry>("30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ShareLink | null>(null);
  // Fields left (or a submit tried): only then are their problems shown.
  const [touched, setTouched] = useState({ title: false, password: false, confirm: false });
  const [attempted, setAttempted] = useState(false);
  const touch = (f: keyof typeof touched) => () => setTouched((prev) => ({ ...prev, [f]: true }));

  const problems = {
    title: title.trim() ? null : d.titleRequired,
    password: password.length >= SHARE_PASSWORD_MIN ? null : d.passwordShort({ min: SHARE_PASSWORD_MIN, count: password.length }),
    confirm: confirm === password ? null : t.errors.password_mismatch,
  };
  const shown = {
    title: touched.title ? problems.title : null,
    password: touched.password ? problems.password : null,
    // A mismatch shows as soon as the confirmation is as long as the password.
    confirm: touched.confirm || (confirm.length >= password.length && confirm.length > 0) ? problems.confirm : null,
  };
  const valid = !problems.title && !problems.password && !problems.confirm && (all || from <= to);
  const problemCount = [problems.title, problems.password, problems.confirm].filter(Boolean).length;

  if (created) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{d.readyTitle}</DialogTitle>
          <DialogDescription>{d.readyBody}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-2">
          <div className="flex gap-2">
            <Input readOnly value={shareUrl(created.id)} onFocus={(e) => e.currentTarget.select()} aria-label={t.connect.share.copyLink} className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={() => void copyShareLink(created.id, t.connect.share.linkCopied)}>
              <Copy />
              {d.copy}
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>
            <Check />
            {d.done}
          </Button>
        </DialogFooter>
      </>
    );
  }

  const submit = async () => {
    if (busy) return;
    if (!valid) {
      setAttempted(true);
      setTouched({ title: true, password: true, confirm: true });
      // Take the person to the first field that needs fixing.
      const first = problems.title ? ids.title : problems.password ? ids.password : ids.confirm;
      document.getElementById(first)?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const report = buildSharedReport({
        ...data,
        title: title.trim(),
        period: all ? { all: true } : { all: false, from, to },
        sections: [...sections],
        today,
        now: new Date().toISOString(),
      });
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, expiresInDays: expiry === "never" ? null : Number(expiry), report }),
      });
      if (!res.ok) {
        setError((await apiErrorText(t, res)).message);
        return;
      }
      const { share } = (await res.json()) as { share: ShareLink };
      setCreated(share);
      onCreated?.(share);
    } catch {
      setError(t.common.networkError);
    } finally {
      setBusy(false);
    }
  };

  const monthSelect = (id: string, label: string, value: string, onChange: (v: string) => void) => (
    <div className="grid flex-1 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {formatDate(`${m}-01`, "monthYear")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{d.title}</DialogTitle>
        <DialogDescription>{d.description}</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-5">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor={ids.title}>{d.name}</Label>
          <Input
            id={ids.title}
            value={title}
            maxLength={SHARE_TITLE_MAX}
            placeholder={d.namePlaceholder}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={touch("title")}
            aria-invalid={!!shown.title}
            aria-describedby={shown.title ? `${ids.title}-error` : undefined}
          />
          <FieldError id={`${ids.title}-error`}>{shown.title}</FieldError>
        </div>

        <div className="grid gap-2">
          <Label>{d.period}</Label>
          <SegmentedControl
            value={all ? "all" : "custom"}
            onValueChange={(v) => setAll(v === "all")}
            options={[
              { value: "custom", label: d.custom },
              { value: "all", label: d.allTime },
            ]}
            fullWidth
          />
          {all ? null : (
            <div className="flex gap-3">
              {monthSelect(ids.from, d.from, from, (v) => {
                setFrom(v);
                if (v > to) setTo(v);
              })}
              {monthSelect(ids.to, d.to, to, (v) => {
                setTo(v);
                if (v < from) setFrom(v);
              })}
            </div>
          )}
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{d.include}</legend>
          {REPORT_SECTIONS.map((s) => {
            const id = `share-section-${s}`;
            const fixed = s === "cashflow";
            return (
              <div key={s} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                <Label htmlFor={id} className="font-normal">
                  {t.connect.share.sections[s]}
                </Label>
                {fixed ? (
                  <StatusBadge>{d.always}</StatusBadge>
                ) : (
                  <Switch
                    id={id}
                    checked={sections.has(s)}
                    onCheckedChange={(on) =>
                      setSections((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(s);
                        else next.delete(s);
                        return next;
                      })
                    }
                  />
                )}
              </div>
            );
          })}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Label htmlFor={ids.password}>{d.password}</Label>
            <PasswordInput
              id={ids.password}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={touch("password")}
              aria-invalid={!!shown.password}
              aria-describedby={`${ids.password}-hint`}
            />
            {shown.password ? (
              <FieldError id={`${ids.password}-hint`}>{shown.password}</FieldError>
            ) : (
              <p id={`${ids.password}-hint`} className="text-xs text-muted-foreground">
                {/* While typing: how far off the minimum it still is. */}
                {problems.password && password.length > 0 ? problems.password : d.passwordHint({ min: SHARE_PASSWORD_MIN })}
              </p>
            )}
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor={ids.confirm}>{d.confirm}</Label>
            <PasswordInput
              id={ids.confirm}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={touch("confirm")}
              aria-invalid={!!shown.confirm}
              aria-describedby={shown.confirm ? `${ids.confirm}-error` : undefined}
            />
            <FieldError id={`${ids.confirm}-error`}>{shown.confirm}</FieldError>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>{d.expiry}</Label>
          <SegmentedControl
            value={expiry}
            onValueChange={setExpiry}
            options={EXPIRY.map((e) => ({ value: e, label: e === "never" ? d.never : d.expiryDays({ count: Number(e) }) }))}
            fullWidth
          />
        </div>
      </DialogBody>
      <DialogFooter>
        {attempted && problemCount > 0 ? (
          // Beside the button that was pressed, so a refused submit is never silent.
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-danger max-sm:order-last max-sm:justify-center sm:mr-auto">
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {d.fixErrors({ count: problemCount })}
          </p>
        ) : null}
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Link2 />}
          {busy ? d.submitting : d.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}
