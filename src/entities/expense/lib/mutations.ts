import { addMonths, monthKeyOf, type MonthKey } from "@/shared/lib/month";

import type { ExpenseTemplate } from "../config/templates";
import type { ExpenseItem, ExpenseLogDoc, ExpenseMonthEntry, ExpensesDoc } from "../model";

/** Months of check-off history kept (older months are dropped on the next write). */
export const EXPENSE_LOG_KEEP_MONTHS = 36;

export function newExpenseId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `exp-${Date.now().toString(36)}-${random}`;
}

/** A blank monthly bill, added today. */
export function createExpenseDraft(today: string, init: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    id: newExpenseId(),
    name: "",
    category: "other",
    kind: "bill",
    amount: 0,
    frequency: "monthly",
    createdAt: today,
    ...init,
  };
}

/** An item from a template with the name, amount and due day the person entered. */
export function createItemFromTemplate(
  template: ExpenseTemplate,
  input: { name: string; amount: number; dueDay?: number; debtId?: string },
  today: string,
): ExpenseItem {
  return createExpenseDraft(today, {
    name: input.name,
    category: template.category,
    kind: template.kind,
    frequency: template.frequency,
    amount: Math.max(0, input.amount),
    dueDay: input.dueDay ?? template.dueDay,
    dueMonth: template.dueMonth,
    debtId: input.debtId,
  });
}

export function upsertExpenseItem(doc: ExpensesDoc, item: ExpenseItem): ExpensesDoc {
  const exists = doc.items.some((i) => i.id === item.id);
  return { ...doc, items: exists ? doc.items.map((i) => (i.id === item.id ? item : i)) : [...doc.items, item] };
}

/** True when any month has a record for the item. */
export function hasHistory(log: ExpenseLogDoc, itemId: string): boolean {
  return Object.values(log.months).some((m) => m[itemId] !== undefined);
}

/** Remove an item: archived (kept for past months) when it has history, else deleted outright. */
export function removeExpenseItem(doc: ExpensesDoc, log: ExpenseLogDoc, itemId: string, today: string): ExpensesDoc {
  if (!hasHistory(log, itemId)) return { ...doc, items: doc.items.filter((i) => i.id !== itemId) };
  return { ...doc, items: doc.items.map((i) => (i.id === itemId ? { ...i, archivedAt: today } : i)) };
}

/** Stop counting the old single estimate: from now on only items count. */
export function retireLegacyEstimate(doc: ExpensesDoc, amount: number, today: string): ExpensesDoc {
  return { ...doc, legacyEstimate: { retiredAt: today, amount: Math.max(0, amount) } };
}

/** Undo {@link retireLegacyEstimate}. */
export function unretireLegacyEstimate(doc: ExpensesDoc): ExpensesDoc {
  const next = { ...doc };
  delete next.legacyEstimate;
  return next;
}

function isEmptyEntry(e: ExpenseMonthEntry | undefined): boolean {
  return !e || (!e.payments?.length && !e.spent && !e.skipped);
}

/** Drop months older than `keepMonths` before `now`'s month and empty entries. */
export function pruneExpenseLog(log: ExpenseLogDoc, now: Date, keepMonths = EXPENSE_LOG_KEEP_MONTHS): ExpenseLogDoc {
  const oldest = addMonths(monthKeyOf(now), -(keepMonths - 1));
  const months: ExpenseLogDoc["months"] = {};
  for (const key of Object.keys(log.months).sort()) {
    if (key < oldest) continue;
    const entries = Object.fromEntries(Object.entries(log.months[key]).filter(([, e]) => !isEmptyEntry(e)));
    if (Object.keys(entries).length) months[key] = entries;
  }
  return { months };
}

/** Replace one month entry (`undefined` removes it); used directly for undo. */
export function setMonthEntry(
  log: ExpenseLogDoc,
  monthKey: MonthKey,
  itemId: string,
  entry: ExpenseMonthEntry | undefined,
  now: Date = new Date(),
): ExpenseLogDoc {
  const month = { ...(log.months[monthKey] ?? {}) };
  if (isEmptyEntry(entry)) delete month[itemId];
  else month[itemId] = entry!;
  return pruneExpenseLog({ months: { ...log.months, [monthKey]: month } }, now);
}

function entryOf(log: ExpenseLogDoc, monthKey: MonthKey, itemId: string): ExpenseMonthEntry {
  return log.months[monthKey]?.[itemId] ?? {};
}

type Target = { monthKey: MonthKey; itemId: string; planned: number };

/** Record one paid occurrence of a bill (clears "skipped"). */
export function recordBillPayment(
  log: ExpenseLogDoc,
  t: Target & { amount: number; date: string },
  now: Date = new Date(),
): ExpenseLogDoc {
  const e = entryOf(log, t.monthKey, t.itemId);
  const payments = [...(e.payments ?? []), { amount: Math.max(0, Math.round(t.amount)), date: t.date }];
  return setMonthEntry(log, t.monthKey, t.itemId, { ...e, payments, skipped: undefined, planned: e.planned ?? t.planned }, now);
}

/** Forget every payment of a bill in the month ("not paid after all"). */
export function clearBillPayments(log: ExpenseLogDoc, monthKey: MonthKey, itemId: string, now: Date = new Date()): ExpenseLogDoc {
  const e = entryOf(log, monthKey, itemId);
  return setMonthEntry(log, monthKey, itemId, { ...e, payments: undefined }, now);
}

/** Mark a bill as not due / not paid this month on purpose (or undo that). */
export function setBillSkipped(log: ExpenseLogDoc, t: Target & { skipped: boolean }, now: Date = new Date()): ExpenseLogDoc {
  const e = entryOf(log, t.monthKey, t.itemId);
  return setMonthEntry(
    log,
    t.monthKey,
    t.itemId,
    t.skipped ? { ...e, payments: undefined, skipped: true, planned: e.planned ?? t.planned } : { ...e, skipped: undefined },
    now,
  );
}

/** Add (or with a negative amount, take back) spending from a budget; never below 0. */
export function addBudgetSpend(log: ExpenseLogDoc, t: Target & { amount: number }, now: Date = new Date()): ExpenseLogDoc {
  const e = entryOf(log, t.monthKey, t.itemId);
  const spent = Math.max(0, Math.round((e.spent ?? 0) + t.amount));
  return setMonthEntry(log, t.monthKey, t.itemId, { ...e, spent, planned: e.planned ?? t.planned }, now);
}

/** Set a budget's spending for the month. */
export function setBudgetSpent(log: ExpenseLogDoc, t: Target & { spent: number }, now: Date = new Date()): ExpenseLogDoc {
  const e = entryOf(log, t.monthKey, t.itemId);
  return setMonthEntry(log, t.monthKey, t.itemId, { ...e, spent: Math.max(0, Math.round(t.spent)), planned: e.planned ?? t.planned }, now);
}
