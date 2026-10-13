import type { Debt } from "@/entities/debt";
import { addMonths, dayInMonthIso, daysInMonth, monthKeyOf, parseMonthKey, type MonthKey } from "@/shared/lib/month";

import type { ExpenseFrequency, ExpenseItem } from "../model";

/** Months between occurrences (weekly items occur every month). */
export function intervalMonths(frequency: ExpenseFrequency): number {
  switch (frequency) {
    case "quarterly":
      return 3;
    case "semiannual":
      return 6;
    case "yearly":
      return 12;
    default:
      return 1;
  }
}

function anchorMonth(item: ExpenseItem): number {
  if (item.dueMonth && item.dueMonth >= 1 && item.dueMonth <= 12) return item.dueMonth;
  const created = Number(item.createdAt?.slice(5, 7));
  return created >= 1 && created <= 12 ? created : 1;
}

/** Whether the item has an occurrence in the month (ignores created / paused / archived). */
export function isDueInMonth(item: ExpenseItem, monthKey: MonthKey): boolean {
  const interval = intervalMonths(item.frequency);
  if (interval === 1) return true;
  const { month } = parseMonthKey(monthKey);
  return (((month - anchorMonth(item)) % interval) + interval) % interval === 0;
}

/** The due day: the item's own, else the linked debt's payment day. */
export function effectiveDueDay(item: ExpenseItem, debt?: Debt): number | undefined {
  const day = item.dueDay ?? (item.debtId ? debt?.paymentDayOfMonth : undefined);
  return day && day >= 1 && day <= 31 ? Math.floor(day) : undefined;
}

function isoWeekday(d: Date): number {
  return d.getDay() === 0 ? 7 : d.getDay();
}

function weeklyDay(item: ExpenseItem): number {
  if (item.dueWeekday && item.dueWeekday >= 1 && item.dueWeekday <= 7) return item.dueWeekday;
  const created = item.createdAt ? new Date(`${item.createdAt}T12:00:00`) : null;
  return created && !Number.isNaN(created.getTime()) ? isoWeekday(created) : 1;
}

/**
 * `YYYY-MM-DD` due dates in the month: one per occurrence (several for weekly
 * items). Empty when the item isn't due that month or has no due day.
 */
export function dueDatesInMonth(item: ExpenseItem, monthKey: MonthKey, debt?: Debt): string[] {
  if (!isDueInMonth(item, monthKey)) return [];
  if (item.frequency === "weekly") {
    const weekday = weeklyDay(item);
    const out: string[] = [];
    const { year, month } = parseMonthKey(monthKey);
    for (let day = 1; day <= daysInMonth(monthKey); day++) {
      if (isoWeekday(new Date(year, month - 1, day, 12)) === weekday) out.push(dayInMonthIso(monthKey, day));
    }
    return out;
  }
  const day = effectiveDueDay(item, debt);
  return day ? [dayInMonthIso(monthKey, day)] : [];
}

/** Occurrences in the month: weekly counts weeks; others 1 when due (even without a due day), else 0. */
export function occurrencesInMonth(item: ExpenseItem, monthKey: MonthKey): number {
  if (!isDueInMonth(item, monthKey)) return 0;
  return item.frequency === "weekly" ? dueDatesInMonth(item, monthKey).length : 1;
}

/**
 * Counted in the month. Items start in the month they were added and stop in
 * the month they were removed. Paused items aren't planned in any month (a
 * month that has a record for them still shows it).
 */
export function isActiveInMonth(item: ExpenseItem, monthKey: MonthKey): boolean {
  if (item.paused) return false;
  if (item.createdAt && item.createdAt.slice(0, 7) > monthKey) return false;
  if (item.archivedAt && item.archivedAt.slice(0, 7) <= monthKey) return false;
  return true;
}

/** Next due date on or after `from` (within about a year), or `null` without a due day. */
export function nextDueDate(item: ExpenseItem, from: Date, debt?: Debt): string | null {
  const fromIso = `${monthKeyOf(from)}-${String(from.getDate()).padStart(2, "0")}`;
  let key = monthKeyOf(from);
  for (let i = 0; i <= 12; i++, key = addMonths(key, 1)) {
    const next = dueDatesInMonth(item, key, debt).find((d) => d >= fromIso);
    if (next) return next;
  }
  return null;
}
