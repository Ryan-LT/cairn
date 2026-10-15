"use client";

import { ArrowDownLeft, ArrowUpRight, Copy, KeyRound, Loader2, Plus, Trash2, Webhook } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { isAccountAsset, type WebhookProvider } from "@/entities/ledger";
import { useSettingsAssets } from "@/entities/settings-asset";
import { apiErrorText, useI18n } from "@/shared/i18n";
import { formatDate, formatMoney, formatRelative } from "@/shared/lib/format";
import { Callout } from "@/shared/ui/callout";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Alert, AlertDescription } from "@/shared/ui/kit/alert";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { Label } from "@/shared/ui/kit/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Section } from "@/shared/ui/section";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { StatusBadge } from "@/shared/ui/status-badge";

import { sendJson, useWebhookKeys, type WebhookKey } from "../model/use-connect-data";

const NO_ACCOUNT = "__none";
const BRANDS: Record<Exclude<WebhookProvider, "generic">, string> = { sepay: "SePay", casso: "Casso" };

const CURL = (url: string) => `curl -X POST ${url} \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Highlands Coffee", "amount": -59000, "date": "2026-10-15 08:30", "id": "txn-123"}'`;

function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    // No clipboard access: the text is on screen to copy by hand.
  }
}

function useAccounts() {
  const [, , , stored] = useSettingsAssets();
  return stored.filter(isAccountAsset);
}

function AccountSelect({ id, value, onChange }: { id?: string; value: string | null; onChange: (v: string | null) => void }) {
  const { t } = useI18n();
  const accounts = useAccounts();
  return (
    <Select value={value ?? NO_ACCOUNT} onValueChange={(v) => onChange(v === NO_ACCOUNT ? null : v)}>
      <SelectTrigger id={id} className="w-full sm:w-56" aria-label={t.connect.webhook.account}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_ACCOUNT}>{t.connect.webhook.noAccount}</SelectItem>
        {accounts.length ? <SelectSeparator /> : null}
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Webhook URL, keys, setup steps for SePay / Casso / a script, and what arrived lately. */
export function WebhookSection({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const w = t.connect.webhook;
  const origin = useOrigin();
  const url = `${origin}/api/webhooks/transactions`;
  const { status, data, reload, setData } = useWebhookKeys();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<WebhookKey | null>(null);
  const [guide, setGuide] = useState<"sepay" | "casso" | "script">("sepay");

  if (!enabled || status === "unavailable") {
    return (
      <Section icon={Webhook} tone="teal" title={w.title} description={w.description} help="connectWebhook">
        <Callout>{w.unavailable}</Callout>
      </Section>
    );
  }

  const updateAccount = async (key: WebhookKey, defaultAccountId: string | null) => {
    setData((d) => ({ ...d, keys: d.keys.map((k) => (k.id === key.id ? { ...k, defaultAccountId } : k)) }));
    const res = await sendJson("/api/webhooks/tokens", "PATCH", { id: key.id, defaultAccountId }).catch(() => null);
    if (res?.ok) toast.success(w.saved);
    else {
      toast.error(res ? (await apiErrorText(t, res)).message : t.common.networkError);
      reload();
    }
  };

  return (
    <Section
      icon={Webhook}
      tone="teal"
      title={w.title}
      description={w.description}
      help="connectWebhook"
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus />
          {w.newKey}
        </Button>
      }
    >
      <div className="grid gap-6">
        <div className="grid gap-1.5">
          <Label htmlFor="webhook-url">{w.endpoint}</Label>
          <div className="flex gap-2">
            <Input id="webhook-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => void copy(url, t.common.copied)} aria-label={t.common.copy}>
              <Copy />
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{w.keys}</h3>
          {status === "loading" ? (
            <p className="text-sm text-muted-foreground">{t.common.loading}</p>
          ) : status === "error" ? (
            <p className="text-sm text-destructive">{t.errors.unavailable}</p>
          ) : data.keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{w.noKeys}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {data.keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                  <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.hint({ hint: k.hint })} · {k.lastUsedAt ? w.lastUsed({ when: formatRelative(new Date(k.lastUsedAt)) }) : w.neverUsed}
                    </p>
                  </div>
                  <AccountSelect value={k.defaultAccountId} onChange={(v) => void updateAccount(k, v)} />
                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setRevoking(k)}>
                    <Trash2 />
                    {w.revoke}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3">
          <h3 className="text-sm font-medium">{w.setup}</h3>
          <SegmentedControl
            value={guide}
            onValueChange={setGuide}
            options={[
              { value: "sepay", label: BRANDS.sepay },
              { value: "casso", label: BRANDS.casso },
              { value: "script", label: w.script },
            ]}
          />
          {guide === "script" ? (
            <div className="grid gap-2 text-sm">
              <p>{w.scriptIntro}</p>
              <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
                {w.scriptFields.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="text-muted-foreground">{w.scriptBatch}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{w.example}</p>
              <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-xs leading-relaxed">{CURL(url)}</pre>
            </div>
          ) : (
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
              {(guide === "sepay" ? w.sepaySteps : w.cassoSteps).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          )}
        </div>

        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{w.recent}</h3>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{w.recentEmpty}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {data.recent.map((r) => {
                const out = r.txn.kind === "expense";
                return (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                    {out ? <ArrowUpRight className="size-4 shrink-0 text-danger" aria-label={w.moneyOut} /> : <ArrowDownLeft className="size-4 shrink-0 text-success" aria-label={w.moneyIn} />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{r.txn.title ?? (out ? w.moneyOut : w.moneyIn)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.txn.date)} · {r.provider === "generic" ? w.script : BRANDS[r.provider]}
                        {r.keyName ? ` · ${r.keyName}` : ""}
                      </p>
                    </div>
                    <div className="grid shrink-0 justify-items-end gap-1">
                      <span className={out ? "text-sm font-medium tabular-nums text-danger" : "text-sm font-medium tabular-nums text-success"}>
                        {formatMoney(out ? -r.txn.amount : r.txn.amount, { currency: "VND", signDisplay: "always" })}
                      </span>
                      <StatusBadge tone={r.dismissed ? "warning" : r.acked ? "success" : "neutral"} dot>
                        {r.dismissed ? w.deleted : r.acked ? w.inHistory : w.waiting}
                      </StatusBadge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <CreateKeyDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(key) => setData((d) => ({ ...d, keys: [key, ...d.keys] }))}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={w.revokeTitle}
        description={w.revokeBody}
        confirmLabel={w.revoke}
        onConfirm={async () => {
          if (!revoking) return;
          const res = await sendJson(`/api/webhooks/tokens?id=${encodeURIComponent(revoking.id)}`, "DELETE").catch(() => null);
          if (res?.ok) {
            setData((d) => ({ ...d, keys: d.keys.filter((k) => k.id !== revoking.id) }));
            toast.success(w.revoked);
          } else toast.error(res ? (await apiErrorText(t, res)).message : t.common.networkError);
          setRevoking(null);
        }}
      />
    </Section>
  );
}

function CreateKeyDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (key: WebhookKey) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">{open ? <CreateKeyForm onClose={() => onOpenChange(false)} onCreated={onCreated} /> : null}</DialogContent>
    </Dialog>
  );
}

function CreateKeyForm({ onClose, onCreated }: { onClose: () => void; onCreated: (key: WebhookKey) => void }) {
  const { t } = useI18n();
  const w = t.connect.webhook;
  const ids = { name: useId(), account: useId(), token: useId() };
  const [name, setName] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  if (token) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{w.tokenTitle}</DialogTitle>
          <DialogDescription>{w.tokenBody}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex gap-2">
            <Input id={ids.token} readOnly value={token} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label={w.keys} />
            <Button variant="outline" size="icon" onClick={() => void copy(token, t.common.copied)} aria-label={t.common.copy}>
              <Copy />
            </Button>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>{w.tokenDone}</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form
      className="contents"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
          const res = await sendJson("/api/webhooks/tokens", "POST", { name: name.trim(), defaultAccountId: account });
          if (!res.ok) {
            setError((await apiErrorText(t, res)).message);
            return;
          }
          const data = (await res.json()) as { key: WebhookKey; token: string };
          onCreated(data.key);
          setToken(data.token);
        } catch {
          setError(t.common.networkError);
        } finally {
          setBusy(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{w.newKey}</DialogTitle>
        <DialogDescription>{w.description}</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor={ids.name}>{w.keyName}</Label>
          <Input id={ids.name} value={name} maxLength={60} placeholder={w.keyNamePlaceholder} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={ids.account}>{w.account}</Label>
          <AccountSelect id={ids.account} value={account} onChange={setAccount} />
          <p className="text-xs text-muted-foreground">{w.accountHint}</p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={!name.trim() || busy}>
          {busy ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {busy ? w.creating : w.create}
        </Button>
      </DialogFooter>
    </form>
  );
}
