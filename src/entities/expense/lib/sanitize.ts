import { activeMessages } from "@/shared/i18n/active";
import { isMonthKey } from "@/shared/lib/month";

import {
  EXPENSE_CATEGORY_IDS,
  EXPENSE_FREQUENCIES,
  EXPENSE_KINDS,
  EXPENSE_LOG_SEED,
  EXPENSES_SEED,
  type BillPayment,
  type ExpenseItem,
  type ExpenseLogDoc,
  type ExpenseMonthEntry,
  type ExpensesDoc,
} from "../model";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function oneOf<T extends string>(options: readonly T[], v: unknown, fallback: T): T {
  return options.includes(v as T) ? (v as T) : fallback;
}

function nonNegative(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

function intIn(v: unknown, min: number, max: number): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
}

function isoDay(v: unknown): string | undefined {
  return typeof v === "string" && ISO_DAY.test(v) ? v : undefined;
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** A stored or drafted item in canonical shape, or `null` if it isn't one. */
export function sanitizeExpenseItem(raw: unknown, today: string): ExpenseItem | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const category = oneOf(EXPENSE_CATEGORY_IDS, raw.category, "other");
  const frequency = oneOf(EXPENSE_FREQUENCIES, raw.frequency, "monthly");
  const item: ExpenseItem = {
    id: raw.id,
    name: text(raw.name, 80) || activeMessages().expenses.categories[category] || activeMessages().expenses.fallbackName,
    category,
    kind: oneOf(EXPENSE_KINDS, raw.kind, "bill"),
    amount: nonNegative(raw.amount),
    frequency,
    createdAt: isoDay(raw.createdAt) ?? today,
  };
  if (typeof raw.amountUsd === "number" && Number.isFinite(raw.amountUsd) && raw.amountUsd > 0) item.amountUsd = Math.round(raw.amountUsd * 100) / 100;
  const dueDay = intIn(raw.dueDay, 1, 31);
  if (dueDay !== undefined && frequency !== "weekly") item.dueDay = dueDay;
  const dueMonth = intIn(raw.dueMonth, 1, 12);
  if (dueMonth !== undefined && frequency !== "weekly" && frequency !== "monthly") item.dueMonth = dueMonth;
  const dueWeekday = intIn(raw.dueWeekday, 1, 7);
  if (dueWeekday !== undefined && frequency === "weekly") item.dueWeekday = dueWeekday;
  if (typeof raw.debtId === "string" && raw.debtId) item.debtId = raw.debtId;
  if (raw.autopay === true) item.autopay = true;
  if (typeof raw.essential === "boolean") item.essential = raw.essential;
  const note = text(raw.note, 200);
  if (note) item.note = note;
  if (raw.paused === true) item.paused = true;
  const archivedAt = isoDay(raw.archivedAt);
  if (archivedAt) item.archivedAt = archivedAt;
  return item;
}

/** Tolerant read of the `expenses` table (bad rows dropped, duplicates keep the first). */
export function sanitizeExpensesDoc(raw: unknown, today: string): ExpensesDoc {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return EXPENSES_SEED;
  const seen = new Set<string>();
  const items: ExpenseItem[] = [];
  for (const r of raw.items) {
    const item = sanitizeExpenseItem(r, today);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      items.push(item);
    }
  }
  const doc: ExpensesDoc = { items };
  const le = raw.legacyEstimate;
  if (isRecord(le) && isoDay(le.retiredAt)) doc.legacyEstimate = { retiredAt: le.retiredAt as string, amount: nonNegative(le.amount) };
  return doc;
}

function sanitizeEntry(raw: unknown): ExpenseMonthEntry | null {
  if (!isRecord(raw)) return null;
  const entry: ExpenseMonthEntry = {};
  if (Array.isArray(raw.payments)) {
    const payments: BillPayment[] = raw.payments
      .filter(isRecord)
      .map((p) => ({ amount: nonNegative(p.amount), date: isoDay(p.date) ?? "" }))
      .filter((p) => p.date);
    if (payments.length) entry.payments = payments;
  }
  if (typeof raw.spent === "number" && raw.spent > 0) entry.spent = nonNegative(raw.spent);
  if (raw.skipped === true) entry.skipped = true;
  if (typeof raw.planned === "number" && Number.isFinite(raw.planned)) entry.planned = nonNegative(raw.planned);
  return entry.payments || entry.spent || entry.skipped ? entry : null;
}

/** Tolerant read of the `expenseLog` table. */
export function sanitizeExpenseLog(raw: unknown): ExpenseLogDoc {
  if (!isRecord(raw) || !isRecord(raw.months)) return EXPENSE_LOG_SEED;
  const months: ExpenseLogDoc["months"] = {};
  for (const key of Object.keys(raw.months).sort()) {
    const month = raw.months[key];
    if (!isMonthKey(key) || !isRecord(month)) continue;
    const entries: Record<string, ExpenseMonthEntry> = {};
    for (const [itemId, e] of Object.entries(month)) {
      const entry = sanitizeEntry(e);
      if (entry) entries[itemId] = entry;
    }
    if (Object.keys(entries).length) months[key] = entries;
  }
  return { months };
}
