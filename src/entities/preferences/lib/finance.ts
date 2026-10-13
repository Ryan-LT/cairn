import type { NetWorthMonthSnapshot, Preferences } from "@/entities/preferences/model";

export type SpendingPrefs = Pick<
  Preferences,
  "averageMonthlySpending" | "monthOutflow"
>;

/**
 * The old single "average monthly spending" estimate (new field or legacy
 * `monthOutflow`). Spending itself now comes from the bill list; see
 * `resolveMonthlySpending` in `@/entities/expense`.
 */
export function legacySpendingEstimate(prefs: SpendingPrefs): number {
  const raw = prefs.averageMonthlySpending ?? prefs.monthOutflow ?? 0;
  return Math.max(0, Number.isFinite(raw) ? raw : 0);
}

/** @deprecated Use {@link legacySpendingEstimate}. */
export const resolveAverageMonthlySpending = legacySpendingEstimate;

export function monthCalendarKey(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Fractional average months from `now` through end of calendar year. */
export function fractionalMonthsUntilYearEnd(now: Date = new Date()): number {
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  const ms = Math.max(0, yearEnd.getTime() - now.getTime());
  const avgMonthMs = (1000 * 60 * 60 * 24 * 365.25) / 12;
  return ms / avgMonthMs;
}

/**
 * Monthly net cash flow used by every projection: income − spending. (Older
 * saves may still hold `netMonthIncome` / `monthInflow` from an early version;
 * nothing reads them.)
 */
export function estimatedMonthlyNetCashflow(totalMonthlyIncome: number, monthlySpending: number): number {
  return totalMonthlyIncome - monthlySpending;
}

/**
 * Net worth at 31 Dec: today's plus the monthly net for the months left.
 * `principalMonthly` (debt repayment that lowers what you owe) is added back:
 * it leaves your cash but not your net worth.
 */
export function projectNetWorthEndOfYear(
  netWorth: number,
  monthlyNet: number,
  opts: { principalMonthly?: number; now?: Date } = {},
): number {
  const months = fractionalMonthsUntilYearEnd(opts.now);
  return netWorth + (monthlyNet + Math.max(0, opts.principalMonthly ?? 0)) * months;
}

/** MTD % vs baseline stored in preferences (updated via `syncNetWorthTracking`). */
export function monthToDateNetWorthChangePercent(
  prefs: Pick<Preferences, "netWorthMonthBaseline">,
  netWorth: number,
): number {
  const b = prefs.netWorthMonthBaseline;
  if (b === undefined || !Number.isFinite(b) || Math.abs(b) < 1) return 0;
  return ((netWorth - b) / Math.abs(b)) * 100;
}

/** Monthly net-worth snapshots kept (5 years). */
export const NET_WORTH_HISTORY_MONTHS = 60;
/** Months the trend chart shows by default. */
export const NET_WORTH_TREND_MONTHS = 12;

function upsertMonthHistory(
  prev: NetWorthMonthSnapshot[],
  monthKey: string,
  value: number,
): NetWorthMonthSnapshot[] {
  const rest = prev.filter((h) => h.monthKey !== monthKey);
  const next = [...rest, { monthKey, value }];
  next.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  return next.slice(-NET_WORTH_HISTORY_MONTHS);
}

/**
 * Persist MTD baseline, last known NW, and rolling monthly snapshots for the chart.
 * Call when net worth changes (e.g. dashboard load).
 */
export function syncNetWorthTracking(prefs: Preferences, netWorth: number): Preferences {
  const key = monthCalendarKey(new Date());
  const prevKey = prefs.netWorthMonthKey;

  let baseline: number;
  if (prevKey !== undefined && prevKey !== key) {
    baseline = prefs.lastKnownNetWorth ?? netWorth;
  } else {
    baseline = prefs.netWorthMonthBaseline ?? netWorth;
  }

  const netWorthMonthlyHistory = upsertMonthHistory(
    prefs.netWorthMonthlyHistory ?? [],
    key,
    netWorth,
  );

  return {
    ...prefs,
    netWorthMonthKey: key,
    netWorthMonthBaseline: baseline,
    lastKnownNetWorth: netWorth,
    netWorthMonthlyHistory,
  };
}

/** Set average monthly spending and clear the legacy outflow so income − spending math wins. */
export function applyAverageMonthlySpending(prefs: Preferences, amount: number): Preferences {
  const value = Math.max(0, Number.isFinite(amount) ? amount : 0);
  return { ...prefs, averageMonthlySpending: value, monthOutflow: 0 };
}

/** Remember a user-defined asset category (deduplicated). */
export function registerExtraAssetCategory(prefs: Preferences, category: string): Preferences {
  return {
    ...prefs,
    extraAssetCategories: [
      ...new Set([...(prefs.extraAssetCategories ?? []), category.trim()]),
    ],
  };
}

export type NetWorthTrendPoint = {
  /** `YYYY-MM`. */
  monthKey: string;
  /** First day of the month (local). */
  date: Date;
  value: number;
  /** True for the current month (live net worth, not a stored snapshot). */
  live: boolean;
  /** Change from the previous point (₫); `null` for the first point. */
  change: number | null;
  /** Change from the previous point in % of its absolute value; `null` if not meaningful. */
  changePct: number | null;
};

/**
 * Up to the last `months` calendar months (default 12) for the net-worth chart, starting at the
 * first month that was actually tracked (no made-up history before it). A
 * month without a snapshot (no visit) repeats the previous month's value; the
 * current month uses the live net worth.
 */
export function buildNetWorthTrend(
  history: NetWorthMonthSnapshot[],
  netWorth: number,
  now: Date = new Date(),
  months: number = NET_WORTH_TREND_MONTHS,
): NetWorthTrendPoint[] {
  const map = new Map(history.map((h) => [h.monthKey, h.value]));
  const firstTracked = [...history].map((h) => h.monthKey).sort()[0];
  const out: NetWorthTrendPoint[] = [];
  let carry: number | null = null;
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = monthCalendarKey(date);
    const live = i === 0;
    if (!live && (firstTracked === undefined || monthKey < firstTracked)) continue;
    if (map.has(monthKey)) carry = map.get(monthKey)!;
    const value = live ? netWorth : (carry ?? netWorth);
    const prev = out.at(-1);
    const change = prev ? value - prev.value : null;
    const changePct = prev && Math.abs(prev.value) >= 1 ? ((value - prev.value) / Math.abs(prev.value)) * 100 : null;
    out.push({ monthKey, date, value, live, change, changePct });
  }
  return out;
}

/** True when tracking fields would not change (skip a needless write). */
export function netWorthTrackingUnchanged(prev: Preferences, next: Preferences): boolean {
  return (
    prev.netWorthMonthKey === next.netWorthMonthKey &&
    prev.netWorthMonthBaseline === next.netWorthMonthBaseline &&
    prev.lastKnownNetWorth === next.lastKnownNetWorth &&
    sameHistory(prev.netWorthMonthlyHistory ?? [], next.netWorthMonthlyHistory ?? [])
  );
}

// Field-wise: Postgres jsonb reorders object keys, so string comparison is unreliable.
function sameHistory(a: NetWorthMonthSnapshot[], b: NetWorthMonthSnapshot[]): boolean {
  return a.length === b.length && a.every((h, i) => h.monthKey === b[i].monthKey && h.value === b[i].value);
}
