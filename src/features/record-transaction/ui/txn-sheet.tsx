"use client";

import { Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { CategoryTile, EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from "@/entities/expense";
import { accountUsdFor, newTxnId, type LedgerTxn } from "@/entities/ledger";
import { useSettingsAssets } from "@/entities/settings-asset";
import { AccountSelect } from "@/entities/settings-asset/ui";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import type { Currency } from "@/shared/lib/currency/rates";
import { useCurrency } from "@/shared/lib/currency/provider";
import { todayIso } from "@/shared/lib/date";
import { formatMoney } from "@/shared/lib/format";
import { MoneyInput } from "@/shared/ui/form";
import { Button } from "@/shared/ui/kit/button";
import { DatePicker } from "@/shared/ui/kit/date-picker";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { Label } from "@/shared/ui/kit/label";

/** What the sheet is for. */
export type TxnSheetMode =
  | { kind: "instant" }
  | { kind: "extra" }
  | { kind: "receive"; sourceId: string; sourceName: string; month: string; amount: number; amountUsd?: number; date: string; accountId?: string }
  | { kind: "edit"; txn: LedgerTxn; title?: string };

const LAST_ACCOUNT_KEY = "wealthtracker:last-account";

function lastAccount(kind: "expense" | "income"): string | undefined {
  try {
    return window.localStorage.getItem(`${LAST_ACCOUNT_KEY}:${kind}`) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberAccount(kind: "expense" | "income", id: string | undefined) {
  try {
    if (id) window.localStorage.setItem(`${LAST_ACCOUNT_KEY}:${kind}`, id);
    else window.localStorage.removeItem(`${LAST_ACCOUNT_KEY}:${kind}`);
  } catch {
    // Storage blocked: just don't remember.
  }
}

type Props = {
  mode: TxnSheetMode | null;
  onOpenChange: (open: boolean) => void;
  onSave: (txn: LedgerTxn) => void;
  onDelete?: (txn: LedgerTxn) => void;
};

/**
 * One sheet for money in and out: spending outside the plan, other money in,
 * receiving an income source, and editing (adjusting) any recorded entry.
 */
export function TxnSheet({ mode, onOpenChange, onSave, onDelete }: Props) {
  return (
    <Dialog open={mode !== null} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {mode ? (
          <TxnForm
            key={mode.kind === "edit" ? mode.txn.id : mode.kind === "receive" ? `${mode.sourceId}-${mode.month}` : mode.kind}
            mode={mode}
            onCancel={() => onOpenChange(false)}
            onSave={(t) => {
              onSave(t);
              onOpenChange(false);
            }}
            onDelete={
              onDelete && mode.kind === "edit"
                ? (t) => {
                    onOpenChange(false);
                    onDelete(t);
                  }
                : undefined
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TxnForm({ mode, onCancel, onSave, onDelete }: { mode: TxnSheetMode; onCancel: () => void; onSave: (t: LedgerTxn) => void; onDelete?: (t: LedgerTxn) => void }) {
  const { t } = useI18n();
  const l = t.ledger;
  const ids = { amount: useId(), name: useId(), account: useId(), date: useId(), note: useId() };
  const rate = useCurrency()?.rates.vndPerUsd ?? null;
  const [, , , storedAssets] = useSettingsAssets();
  const editing = mode.kind === "edit" ? mode.txn : null;
  const kind: "expense" | "income" = mode.kind === "instant" ? "expense" : mode.kind === "edit" ? mode.txn.kind : "income";

  // Amount in the currency it's typed in (dollars kept as dollars).
  const startUsd = editing?.amountUsd ?? (mode.kind === "receive" ? mode.amountUsd : undefined);
  const [currency, setCurrency] = useState<Currency>(startUsd ? "USD" : "VND");
  const [amount, setAmount] = useState<number>(startUsd ?? editing?.amount ?? (mode.kind === "receive" ? mode.amount : 0));
  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState<ExpenseCategoryId>(editing?.category ?? "other");
  const [accountId, setAccountId] = useState<string | undefined>(() =>
    editing ? editing.accountId : mode.kind === "receive" ? (mode.accountId ?? lastAccount("income")) : lastAccount(kind),
  );
  const [date, setDate] = useState(editing?.date ?? (mode.kind === "receive" ? mode.date : todayIso()));
  const [note, setNote] = useState(editing?.note ?? "");

  const isUsd = currency === "USD";
  const vnd = isUsd ? (rate ? Math.round(amount * rate) : (editing?.amount ?? 0)) : Math.round(amount);
  // A budget correction may be negative; everything else must be above zero.
  const valid = editing?.correction ? vnd !== 0 : vnd > 0 && Number.isFinite(vnd) && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const showName = mode.kind === "instant" || mode.kind === "extra" || (editing && (editing.source.type === "instant" || editing.source.type === "extra"));
  const showCategory = mode.kind === "instant" || editing?.source.type === "instant";

  const copy =
    mode.kind === "instant"
      ? { title: l.instant.title, description: l.instant.description, save: l.instant.save }
      : mode.kind === "extra"
        ? { title: l.extra.title, description: l.extra.description, save: l.extra.save }
        : mode.kind === "receive"
          ? { title: l.receive.title({ name: mode.sourceName }), description: l.receive.description, save: l.receive.confirm }
          : { title: mode.title ?? l.edit.title, description: l.edit.description, save: l.edit.save };

  const submit = () => {
    if (!valid) return;
    const asset = accountId ? storedAssets.find((a) => a.id === accountId) : undefined;
    const amountUsd = isUsd ? Math.round(amount * 100) / 100 : undefined;
    const base: LedgerTxn = editing ?? {
      id: newTxnId(),
      kind,
      date,
      at: new Date().toISOString(),
      amount: vnd,
      source: mode.kind === "instant" ? { type: "instant" } : mode.kind === "extra" ? { type: "extra" } : { type: "income", sourceId: mode.kind === "receive" ? mode.sourceId : "", month: mode.kind === "receive" ? mode.month : "" },
    };
    const next: LedgerTxn = {
      ...base,
      date,
      amount: vnd,
      amountUsd,
      name: showName ? name.trim() || undefined : base.name,
      category: showCategory ? category : base.category,
      note: note.trim() || undefined,
      accountId,
      accountUsd: accountUsdFor(asset, vnd, amountUsd, rate),
    };
    if (editing) {
      const changedAmount = editing.amount !== vnd;
      // Adjusting keeps the first amount, so the history shows what it was.
      if (changedAmount) next.originalAmount = editing.originalAmount ?? editing.amount;
      next.editedAt = new Date().toISOString();
    } else {
      rememberAccount(kind, accountId);
    }
    if (!next.accountId) delete next.accountUsd;
    onSave(next);
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={ids.amount}>{l.fields.amount}</Label>
          <MoneyInput
            id={ids.amount}
            value={amount}
            onChange={setAmount}
            currency={currency}
            onCurrencyChange={setCurrency}
            allowNegative={Boolean(editing?.correction)}
            autoFocus={!editing}
            className="h-12 text-lg font-semibold"
          />
          {editing?.originalAmount !== undefined && editing.originalAmount !== editing.amount ? (
            <p className="text-xs text-muted-foreground" data-private>
              {l.edit.adjustedFrom({ amount: formatMoney(editing.originalAmount) })}
            </p>
          ) : null}
        </div>
        {showName ? (
          <div className="grid gap-2">
            <Label htmlFor={ids.name}>{mode.kind === "extra" || editing?.source.type === "extra" ? l.extra.what : l.instant.what}</Label>
            <Input
              id={ids.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={mode.kind === "extra" || editing?.source.type === "extra" ? l.extra.whatPlaceholder : l.instant.whatPlaceholder}
            />
          </div>
        ) : null}
        {showCategory ? (
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{l.fields.category}</legend>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {EXPENSE_CATEGORY_IDS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === category}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-1.5 text-center text-xs leading-tight transition-[background-color,border-color,transform] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97]",
                    c === category ? "border-primary bg-primary-soft text-foreground" : "border-transparent hover:bg-accent",
                  )}
                >
                  <CategoryTile category={c} size="sm" />
                  <span className="line-clamp-2">{t.expenses.categories[c]}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={ids.account}>{kind === "expense" ? l.account.from : l.account.into}</Label>
            <AccountSelect id={ids.account} value={accountId} onChange={setAccountId} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={ids.date}>{l.fields.date}</Label>
            <DatePicker id={ids.date} value={date} onChange={(v) => setDate(v || todayIso())} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">{kind === "expense" ? l.account.hintExpense : l.account.hintIncome}</p>
        <div className="grid gap-2">
          <Label htmlFor={ids.note}>{l.fields.note}</Label>
          <Input id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={l.fields.notePlaceholder} />
        </div>
        {editing?.auto ? <p className="text-xs text-muted-foreground">{l.edit.autoNote}</p> : null}
        {editing?.legacy && editing.source.type === "budget" ? <p className="text-xs text-muted-foreground">{l.edit.legacyNote}</p> : null}
      </DialogBody>
      <DialogFooter>
        {editing && onDelete ? (
          <Button type="button" variant="ghost" className="text-danger hover:text-danger sm:mr-auto" onClick={() => onDelete(editing)}>
            <Trash2 />
            {l.edit.delete}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={!valid}>
          {copy.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
