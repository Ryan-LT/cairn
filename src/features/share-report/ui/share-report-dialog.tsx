"use client";

import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
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
  const months = useMemo(() => {
    const first = data.txns.reduce((m, x) => (x.date.slice(0, 7) < m ? x.date.slice(0, 7) : m), addMonths(current, -23));
    const out: string[] = [];
    for (let m = current; m >= first && out.length < 120; m = addMonths(m, -1)) out.push(m);
    return out;
  }, [data.txns, current]);

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

  const mismatch = confirm.length > 0 && confirm !== password;
  const valid = title.trim().length > 0 && password.length >= SHARE_PASSWORD_MIN && password === confirm && (all || from <= to);

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
    if (!valid || busy) return;
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
          <Input id={ids.title} value={title} maxLength={SHARE_TITLE_MAX} placeholder={d.namePlaceholder} onChange={(e) => setTitle(e.target.value)} />
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
          <div className="grid gap-1.5">
            <Label htmlFor={ids.password}>{d.password}</Label>
            <Input id={ids.password} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.confirm}>{d.confirm}</Label>
            <Input id={ids.confirm} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
          </div>
          <p className={mismatch ? "text-xs text-destructive sm:col-span-2" : "text-xs text-muted-foreground sm:col-span-2"}>
            {mismatch ? t.errors.password_mismatch : d.passwordHint({ min: SHARE_PASSWORD_MIN })}
          </p>
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
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={!valid || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Link2 />}
          {busy ? d.submitting : d.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}
