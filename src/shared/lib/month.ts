/**
 * Calendar-month helpers on `YYYY-MM` keys (local time). Keys sort as strings,
 * so `a < b` compares months.
 */

export type MonthKey = string;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === "string" && MONTH_KEY.test(value);
}

/** `YYYY-MM` of a local date. */
export function monthKeyOf(d: Date): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Year and 1-based month of a key. */
export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

/** Local first day of the month (noon, so it never shifts a day across zones). */
export function monthStart(key: MonthKey): Date {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month - 1, 1, 12);
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const { year, month } = parseMonthKey(key);
  return monthKeyOf(new Date(year, month - 1 + n, 1));
}

export function daysInMonth(key: MonthKey): number {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month, 0).getDate();
}

/** Whole months from `a` to `b` (negative when `b` is earlier). */
export function monthsBetween(a: MonthKey, b: MonthKey): number {
  const x = parseMonthKey(a);
  const y = parseMonthKey(b);
  return (y.year - x.year) * 12 + (y.month - x.month);
}

/** The `count` months ending with `last` (oldest first). */
export function monthsEndingAt(last: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => addMonths(last, i - count + 1));
}

/** `YYYY-MM-DD` for a day of the month, clamped to the month's length (31 → 28/29/30). */
export function dayInMonthIso(key: MonthKey, day: number): string {
  const d = Math.min(Math.max(1, Math.floor(day)), daysInMonth(key));
  return `${key}-${String(d).padStart(2, "0")}`;
}

/** Whole days from local day `from` to ISO day `iso` (negative when it has passed). */
export function daysUntilIso(iso: string, from: Date): number {
  const [y, m, d] = iso.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - start) / 86_400_000);
}
