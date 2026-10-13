import type { Debt } from "@/entities/debt";
import { dayInMonthIso, daysInMonth, daysUntilIso, monthKeyOf, type MonthKey } from "@/shared/lib/month";

import type { BillPayment, ExpenseItem, ExpenseLogDoc, ExpenseMonthEntry, ExpensesDoc } from "../model";
import { linkedDebt, plannedForMonth } from "./amounts";
import { dueDatesInMonth, isActiveInMonth } from "./schedule";

export type BillStatus =
  | "paid"
  /** Direct debit: counted as paid at the planned amount once due. */
  | "autopaid"
  | "skipped"
  | "overdue"
  | "due_today"
  | "due_soon"
  | "upcoming"
  /** Due before the bill was added to the app: we don't know, so ask instead of calling it overdue. */
  | "unconfirmed";

export type BudgetStatus = "on_track" | "watch" | "over" | "unused";

export type BillLine = {
  kind: "bill";
  item: ExpenseItem;
  debt?: Debt;
  entry?: ExpenseMonthEntry;
  /** Planned for this month (all occurrences). */
  planned: number;
  /** Planned per occurrence. */
  perOccurrence: number;
  payments: BillPayment[];
  /** Recorded payments. */
  paid: number;
  /** Paid + autopaid (skipped: 0). */
  settled: number;
  remaining: number;
  status: BillStatus;
  dueDates: string[];
  /** The next unpaid due date this month, if any. */
  nextDue: string | null;
  daysUntilDue: number | null;
  occurrences: number;
  paidCount: number;
};

export type BudgetLine = {
  kind: "budget";
  item: ExpenseItem;
  entry?: ExpenseMonthEntry;
  planned: number;
  spent: number;
  /** Planned − spent (negative when over). */
  remaining: number;
  /** Where spending "should" be by today if spread evenly over the month. */
  expectedByNow: number;
  status: BudgetStatus;
};

export type MonthLine = BillLine | BudgetLine;

export type Payday = { id: string; name: string; day: number };

export type MonthCalendarDay = { day: number; iso: string; billIds: string[]; paydayIds: string[] };

export type MonthView = {
  monthKey: MonthKey;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  lines: MonthLine[];
  groups: {
    overdue: BillLine[];
    needsConfirm: BillLine[];
    dueSoon: BillLine[];
    upcoming: BillLine[];
    settled: BillLine[];
    budgets: BudgetLine[];
  };
  totals: {
    /** Everything planned for the month (skipped bills excluded). */
    planned: number;
    /** Paid, autopaid and spent so far. */
    settled: number;
    /** Still to pay / spend under plan. */
    remaining: number;
    /** Settled + remaining: the expected month total. */
    projected: number;
    billsPlanned: number;
    billsSettled: number;
    billsCount: number;
    billsDone: number;
    budgetsPlanned: number;
    budgetsSpent: number;
    /** Spending above budgets. */
    overBudget: number;
  };
  calendar: MonthCalendarDay[];
};

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

function byDueThenName(a: BillLine, b: BillLine): number {
  const da = a.nextDue ?? a.dueDates[0] ?? "9999";
  const db = b.nextDue ?? b.dueDates[0] ?? "9999";
  return da === db ? a.item.name.localeCompare(b.item.name) : da < db ? -1 : 1;
}

function billLine(
  item: ExpenseItem,
  debt: Debt | undefined,
  entry: ExpenseMonthEntry | undefined,
  planned: number,
  monthKey: MonthKey,
  ctx: { todayIso: string; today: Date; isPast: boolean; isFuture: boolean; soonDays: number },
): BillLine {
  const dueDates = dueDatesInMonth(item, monthKey, debt);
  const occurrences = item.frequency === "weekly" ? Math.max(1, dueDates.length) : 1;
  const perOccurrence = planned / occurrences;
  const payments = entry?.payments ?? [];
  const paid = sum(payments.map((p) => p.amount));
  const paidCount = payments.length;
  const skipped = entry?.skipped === true;

  // Autopay settles each occurrence on its due day (an undated one only once the month is over).
  const passed = ctx.isPast ? occurrences : dueDates.filter((d) => d <= ctx.todayIso).length;
  const autoCount = item.autopay && !skipped ? Math.max(0, Math.min(occurrences, passed) - paidCount) : 0;
  const covered = paidCount + autoCount;

  const settled = skipped ? 0 : paid + autoCount * perOccurrence;
  const remaining = skipped ? 0 : Math.max(0, occurrences - covered) * perOccurrence;
  const nextDue = !skipped && covered < occurrences ? (dueDates[covered] ?? null) : null;

  let status: BillStatus;
  if (skipped) status = "skipped";
  else if (covered >= occurrences) status = autoCount > 0 ? "autopaid" : "paid";
  else if (ctx.isFuture) status = "upcoming";
  else if (nextDue && item.createdAt && nextDue < item.createdAt) status = "unconfirmed";
  else if (nextDue) {
    const d = daysUntilIso(nextDue, ctx.today);
    status = d < 0 ? "overdue" : d === 0 ? "due_today" : d <= ctx.soonDays ? "due_soon" : "upcoming";
  } else {
    // No due day: open all month, overdue once the month is over.
    status = ctx.isPast ? "overdue" : "upcoming";
  }

  return {
    kind: "bill",
    item,
    debt,
    entry,
    planned,
    perOccurrence,
    payments,
    paid,
    settled,
    remaining,
    status,
    dueDates,
    nextDue,
    daysUntilDue: nextDue ? daysUntilIso(nextDue, ctx.today) : null,
    occurrences,
    paidCount,
  };
}

function budgetLine(
  item: ExpenseItem,
  entry: ExpenseMonthEntry | undefined,
  planned: number,
  monthKey: MonthKey,
  ctx: { today: Date; isCurrent: boolean; isPast: boolean; isFuture: boolean },
): BudgetLine {
  const spent = Math.max(0, entry?.spent ?? 0);
  const share = ctx.isPast ? 1 : ctx.isCurrent ? ctx.today.getDate() / daysInMonth(monthKey) : 0;
  const expectedByNow = planned * share;
  let status: BudgetStatus;
  if (spent > planned) status = "over";
  else if (ctx.isFuture || spent === 0) status = "unused";
  else if (ctx.isCurrent && spent > expectedByNow * 1.15) status = "watch";
  else status = "on_track";
  return { kind: "budget", item, entry, planned, spent, remaining: planned - spent, expectedByNow, status };
}

/**
 * Everything due or budgeted in one month, with what's been paid, what's
 * overdue and what's left. Pure: `today` decides what counts as past.
 */
export function buildMonthView(input: {
  expenses: ExpensesDoc;
  log: ExpenseLogDoc;
  debts: readonly Debt[];
  monthKey: MonthKey;
  today: Date;
  paydays?: readonly Payday[];
  /** "Due soon" window in days (default 7). */
  soonDays?: number;
}): MonthView {
  const { expenses, log, debts, monthKey, today } = input;
  const currentMonth = monthKeyOf(today);
  const isCurrent = monthKey === currentMonth;
  const isPast = monthKey < currentMonth;
  const isFuture = monthKey > currentMonth;
  const todayIso = dayInMonthIso(currentMonth, today.getDate());
  const entries = log.months[monthKey] ?? {};
  const ctx = { today, todayIso, isCurrent, isPast, isFuture, soonDays: input.soonDays ?? 7 };

  const lines: MonthLine[] = [];
  for (const item of expenses.items) {
    const entry = entries[item.id];
    if (!isActiveInMonth(item, monthKey) && !entry) continue;
    const debt = linkedDebt(item, debts);
    const computed = plannedForMonth(item, monthKey, debt);
    const planned = isPast && typeof entry?.planned === "number" ? entry.planned : computed;
    if (planned <= 0 && !entry) continue;
    lines.push(
      item.kind === "budget" ? budgetLine(item, entry, planned, monthKey, ctx) : billLine(item, debt, entry, planned, monthKey, ctx),
    );
  }

  const bills = lines.filter((l): l is BillLine => l.kind === "bill");
  const budgets = lines.filter((l): l is BudgetLine => l.kind === "budget");
  const inGroup = (...s: BillStatus[]) => bills.filter((b) => s.includes(b.status)).sort(byDueThenName);
  const active = bills.filter((b) => b.status !== "skipped");

  const billsPlanned = sum(active.map((b) => b.planned));
  const billsSettled = sum(bills.map((b) => b.settled));
  const budgetsPlanned = sum(budgets.map((b) => b.planned));
  const budgetsSpent = sum(budgets.map((b) => b.spent));
  const remaining = sum(bills.map((b) => b.remaining)) + sum(budgets.map((b) => Math.max(0, b.remaining)));
  const settled = billsSettled + budgetsSpent;

  const paydays = input.paydays ?? [];
  const calendar: MonthCalendarDay[] = Array.from({ length: daysInMonth(monthKey) }, (_, i) => {
    const iso = dayInMonthIso(monthKey, i + 1);
    return {
      day: i + 1,
      iso,
      billIds: bills.filter((b) => b.dueDates.includes(iso)).map((b) => b.item.id),
      paydayIds: paydays.filter((p) => dayInMonthIso(monthKey, p.day) === iso).map((p) => p.id),
    };
  });

  return {
    monthKey,
    isCurrent,
    isPast,
    isFuture,
    lines,
    groups: {
      overdue: inGroup("overdue"),
      needsConfirm: inGroup("unconfirmed"),
      dueSoon: inGroup("due_today", "due_soon"),
      upcoming: inGroup("upcoming"),
      settled: inGroup("paid", "autopaid", "skipped"),
      budgets: [...budgets].sort((a, b) => b.planned - a.planned || a.item.name.localeCompare(b.item.name)),
    },
    totals: {
      planned: billsPlanned + budgetsPlanned,
      settled,
      remaining,
      projected: settled + remaining,
      billsPlanned,
      billsSettled,
      billsCount: bills.length,
      billsDone: bills.filter((b) => b.status === "paid" || b.status === "autopaid" || b.status === "skipped").length,
      budgetsPlanned,
      budgetsSpent,
      overBudget: sum(budgets.map((b) => Math.max(0, b.spent - b.planned))),
    },
    calendar,
  };
}

/** Amount a one-tap "paid" records: what's left of this occurrence's plan. */
export function suggestedPayment(line: BillLine): number {
  return Math.round(line.perOccurrence);
}

