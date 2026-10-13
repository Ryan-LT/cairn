"use client";

import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DEBTS_SEED, type Debt } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { clearBillPayments, principalPart, setBillSkipped, setMonthEntry, suggestedPayment, type BillLine, type BudgetLine } from "@/entities/expense";
import { accountUsdFor, currentLedger, findTxn, newTxnId, useLedger, type LedgerTxn } from "@/entities/ledger";
import { useSettingsAssets } from "@/entities/settings-asset";
import { AccountSelect } from "@/entities/settings-asset/ui";
import { useI18n } from "@/shared/i18n";
import { useCurrency } from "@/shared/lib/currency/provider";
import { todayIso } from "@/shared/lib/date";
import { dayInMonthIso, daysInMonth } from "@/shared/lib/month";
import { formatMoney } from "@/shared/lib/format";
import { useTable } from "@/shared/storage";
import { AmountSheet } from "@/shared/ui/amount-sheet";
import { Label } from "@/shared/ui/kit/label";
import { Switch } from "@/shared/ui/kit/switch";

const SPEND_PRESETS = [50_000, 100_000, 200_000, 500_000];

type Sheet =
  | {
      kind: "pay";
      line: BillLine;
      monthKey: string;
      /** Correcting the last recorded payment. */ replaceLast?: boolean;
    }
  | { kind: "spend"; line: BudgetLine; monthKey: string }
  | { kind: "setSpent"; line: BudgetLine; monthKey: string };

/**
 * Recording money out for a month: one-tap "paid" (with undo), paying a
 * different amount, skipping a month, and adding to a budget. Every payment
 * and spend is a ledger entry (taken from the item's account unless another
 * is picked). Render `sheet` once in the page.
 */
export function useRecordSpending() {
  const { t } = useI18n();
  const m = t.expenses;
  const { storedLog, updateLog } = useExpenses();
  const ledger = useLedger();
  const [, , , storedAssets] = useSettingsAssets();
  const rate = useCurrency()?.rates.vndPerUsd ?? null;
  const [, setDebts] = useTable<Debt[]>("debts", DEBTS_SEED);
  const [open, setOpen] = useState<Sheet | null>(null);
  const [reduceDebt, setReduceDebt] = useState(false);
  const [account, setAccount] = useState<string | undefined>(undefined);
  const accountFieldId = useId();

  /** A new expense entry for a bill or budget in `monthKey`. */
  const entryFor = (
    item: BillLine["item"],
    type: "bill" | "budget",
    monthKey: string,
    amount: number,
    date: string,
    accountId: string | undefined,
    extra: Partial<LedgerTxn> = {},
  ): LedgerTxn => {
    const asset = accountId ? storedAssets.find((a) => a.id === accountId) : undefined;
    const accountUsd = accountUsdFor(asset, amount, undefined, rate);
    return {
      id: newTxnId(),
      kind: "expense",
      date,
      at: new Date().toISOString(),
      amount: Math.round(amount),
      source: { type, itemId: item.id, month: monthKey },
      ...(accountId ? { accountId } : {}),
      ...(accountUsd !== undefined ? { accountUsd } : {}),
      ...extra,
    };
  };

  /** Ledger entries behind a bill's payments in the month. */
  const billTxns = (line: BillLine): LedgerTxn[] => {
    const tables = currentLedger();
    return line.payments.flatMap((p) => (p.txnId ? [findTxn(tables, p.txnId)?.txn].filter((x): x is LedgerTxn => Boolean(x)) : []));
  };

  const undoToast = (message: string, undo: () => void, extra?: { label: string; onClick: () => void }) =>
    toast.success(message, {
      action: { label: t.common.undo, onClick: undo },
      cancel: extra ? { label: extra.label, onClick: extra.onClick } : undefined,
    });

  const openPay = (line: BillLine, monthKey: string, opts: { replaceLast?: boolean } = {}) => {
    setReduceDebt(false);
    const last = opts.replaceLast ? line.payments[line.payments.length - 1] : undefined;
    const lastTxn = last?.txnId ? findTxn(currentLedger(), last.txnId)?.txn : undefined;
    setAccount(lastTxn ? lastTxn.accountId : line.item.accountId);
    setOpen({ kind: "pay", line, monthKey, replaceLast: opts.replaceLast });
  };

  const pay = (line: BillLine, monthKey: string, amount = suggestedPayment(line), date = todayIso()) => {
    const txn = entryFor(line.item, "bill", monthKey, amount, date, line.item.accountId);
    ledger.add(txn);
    undoToast(m.toast.paid({ name: line.item.name }), () => ledger.remove([txn.id]), {
      label: m.toast.editAmount,
      onClick: () => openPay(line, monthKey, { replaceLast: true }),
    });
  };

  const unpay = (line: BillLine, monthKey: string) => {
    const removed = billTxns(line);
    const legacyBefore = storedLog.months[monthKey]?.[line.item.id];
    ledger.remove(removed.map((x) => x.id));
    // Payments from before the ledger (not carried over yet) live in the old log.
    if (legacyBefore?.payments?.length) updateLog((l) => clearBillPayments(l, monthKey, line.item.id));
    undoToast(m.toast.unpaid({ name: line.item.name }), () => {
      ledger.restore(removed);
      if (legacyBefore?.payments?.length) updateLog((l) => setMonthEntry(l, monthKey, line.item.id, legacyBefore));
    });
  };

  const skip = (line: BillLine, monthKey: string, skipped: boolean) => {
    const before = storedLog.months[monthKey]?.[line.item.id];
    const removed = skipped ? billTxns(line) : [];
    updateLog((l) =>
      setBillSkipped(l, {
        monthKey,
        itemId: line.item.id,
        planned: line.planned,
        skipped,
      }),
    );
    if (removed.length) ledger.remove(removed.map((x) => x.id));
    undoToast(skipped ? m.toast.skipped({ name: line.item.name }) : t.expenses.toast.updated, () => {
      updateLog((l) => setMonthEntry(l, monthKey, line.item.id, before));
      if (removed.length) ledger.restore(removed);
    });
  };

  const openSpend = (line: BudgetLine, monthKey: string) => {
    setAccount(line.item.accountId);
    setOpen({ kind: "spend", line, monthKey });
  };
  const openSetSpent = (line: BudgetLine, monthKey: string) => setOpen({ kind: "setSpent", line, monthKey });

  const accountField = (
    <div className="grid gap-2">
      <Label htmlFor={accountFieldId}>{t.ledger.account.from}</Label>
      <AccountSelect id={accountFieldId} value={account} onChange={setAccount} />
    </div>
  );

  const close = (o: boolean) => !o && setOpen(null);
  let sheet: ReactNode = null;
  if (open?.kind === "pay") {
    const { line, monthKey, replaceLast } = open;
    const debt = line.debt;
    const principal = debt ? principalPart(debt, suggestedPayment(line)) : 0;
    const last = replaceLast ? line.payments[line.payments.length - 1] : undefined;
    sheet = (
      <AmountSheet
        open
        onOpenChange={close}
        title={m.paySheet.title({ name: line.item.name })}
        description={m.paySheet.description}
        amountLabel={m.paySheet.amount}
        initial={last ? last.amount : suggestedPayment(line)}
        initialDate={last ? last.date : todayIso()}
        confirmLabel={m.paySheet.confirm}
        onConfirm={(amount, date) => {
          const day = date || todayIso();
          const lastTxn = last?.txnId ? findTxn(currentLedger(), last.txnId)?.txn : undefined;
          if (lastTxn) {
            // Correcting the amount adjusts the recorded payment instead of adding one.
            const asset = account ? storedAssets.find((a) => a.id === account) : undefined;
            const changed = lastTxn.amount !== Math.round(amount);
            ledger.put({
              ...lastTxn,
              amount: Math.round(amount),
              date: day,
              accountId: account,
              accountUsd: accountUsdFor(asset, Math.round(amount), undefined, rate),
              ...(changed
                ? {
                    originalAmount: lastTxn.originalAmount ?? lastTxn.amount,
                    amountUsd: undefined,
                  }
                : {}),
              editedAt: new Date().toISOString(),
            });
          } else {
            if (last && !last.txnId) updateLog((l) => clearBillPayments(l, monthKey, line.item.id));
            ledger.add(entryFor(line.item, "bill", monthKey, amount, day, account));
          }
          if (debt && reduceDebt) {
            const cut = principalPart(debt, amount);
            setDebts((all) => all.map((d) => (d.id === debt.id ? { ...d, balance: Math.max(0, d.balance - cut) } : d)));
            toast.success(m.toast.principalReduced);
          } else {
            toast.success(m.toast.paid({ name: line.item.name }));
          }
        }}
      >
        {accountField}
        {debt && principal > 0 ? (
          <div className="flex items-start justify-between gap-3 rounded-md border p-3">
            <Label htmlFor="reduce-debt" className="leading-snug font-normal">
              <span data-private>{m.paySheet.reducePrincipal({ amount: formatMoney(principal) })}</span>
            </Label>
            <Switch id="reduce-debt" checked={reduceDebt} onCheckedChange={setReduceDebt} />
          </div>
        ) : null}
      </AmountSheet>
    );
  } else if (open?.kind === "spend") {
    const { line, monthKey } = open;
    sheet = (
      <AmountSheet
        open
        onOpenChange={close}
        title={m.spendSheet.title({ name: line.item.name })}
        description={
          <span data-private>
            {m.spendSheet.description({
              spent: formatMoney(line.spent),
              planned: formatMoney(line.planned),
            })}
          </span>
        }
        amountLabel={m.spendSheet.amount}
        initial={0}
        presets={SPEND_PRESETS}
        presetMode="add"
        initialDate={todayIso()}
        confirmLabel={m.spendSheet.confirm}
        onConfirm={(amount, date) => {
          const txn = entryFor(line.item, "budget", monthKey, amount, date || todayIso(), account);
          ledger.add(txn);
          undoToast(m.toast.spent({ name: line.item.name }), () => ledger.remove([txn.id]));
        }}
      >
        {accountField}
      </AmountSheet>
    );
  } else if (open?.kind === "setSpent") {
    const { line, monthKey } = open;
    sheet = (
      <AmountSheet
        open
        onOpenChange={close}
        title={m.spendSheet.setTitle({ name: line.item.name })}
        amountLabel={m.spendSheet.setAmount}
        initial={line.spent}
        allowZero
        confirmLabel={m.spendSheet.setConfirm}
        onConfirm={(spent) => {
          // The difference is recorded as a correction (it can take spending back), on the budget's own account.
          const delta = Math.round(spent) - Math.round(line.spent);
          if (delta === 0) return;
          const date = monthKey === todayIso().slice(0, 7) ? todayIso() : dayInMonthIso(monthKey, daysInMonth(monthKey));
          const txn = entryFor(line.item, "budget", monthKey, delta, date, line.item.accountId, { correction: true });
          ledger.add(txn);
          undoToast(t.expenses.toast.updated, () => ledger.remove([txn.id]));
        }}
      />
    );
  }

  return { pay, unpay, skip, openPay, openSpend, openSetSpent, sheet };
}
