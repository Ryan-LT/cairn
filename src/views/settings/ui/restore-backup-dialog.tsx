"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import { formatDate, formatTime } from "@/shared/lib/format";
import { Callout } from "@/shared/ui/callout";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";

import { applyBackup, parseBackup, type ParsedBackup } from "../lib/restore-backup";

/** Pick a backup file, see what's in it, then restore (with undo). */
export function RestoreBackupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const r = t.settings.restore;
  const input = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (o: boolean) => {
    if (!o) setParsed(null);
    onOpenChange(o);
  };

  const errorText = (p: Extract<ParsedBackup, { ok: false }>) =>
    p.code === "invalid_table" ? r.errors.invalid_table({ table: p.table ? r.tables[p.table] : "?" }) : r.errors[p.code];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{r.title}</DialogTitle>
          <DialogDescription>{r.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) setParsed(parseBackup(await file.text(), todayIso()));
            }}
          />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <FileUp />
            {t.settings.data.restoreJson}
          </Button>
          {parsed && !parsed.ok ? <Callout tone="danger">{errorText(parsed)}</Callout> : null}
          {parsed?.ok ? (
            <div className="grid gap-3 text-sm">
              {parsed.summary.exportedAt ? (
                <p className="text-muted-foreground">{r.exportedAt({ date: `${formatDate(parsed.summary.exportedAt)} ${formatTime(new Date(parsed.summary.exportedAt))}` })}</p>
              ) : null}
              <div>
                <p className="mb-1.5 font-medium">{r.contains}</p>
                <ul className="grid gap-1">
                  {parsed.summary.tables.map((x) => (
                    <li key={x.key} className="flex justify-between gap-3">
                      <span>{r.tables[x.key]}</span>
                      <span className="text-muted-foreground tabular-nums">{r.records({ count: x.count })}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {parsed.summary.missing.length ? <Callout tone="info">{r.keeps({ names: parsed.summary.missing.map((k) => r.tables[k]).join(", ") })}</Callout> : null}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={!parsed?.ok || busy}
            onClick={async () => {
              if (!parsed?.ok) return;
              setBusy(true);
              const { previous, synced } = await applyBackup(parsed.tables);
              setBusy(false);
              close(false);
              toast.success(synced ? r.done : r.doneLocal, {
                action: { label: t.common.undo, onClick: () => void applyBackup(previous) },
              });
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            {r.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
