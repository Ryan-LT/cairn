import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildNetWorthTrend,
  netWorthTrackingUnchanged,
  estimatedMonthlyNetCashflow,
  fractionalMonthsUntilYearEnd,
  monthCalendarKey,
  monthToDateNetWorthChangePercent,
  legacySpendingEstimate,
  projectNetWorthEndOfYear,
  syncNetWorthTracking,
} from "@/entities/preferences/lib/finance";
import { PREFERENCES_SEED } from "@/entities/preferences/model";

afterEach(() => {
  vi.useRealTimers();
});

describe("spending + cashflow", () => {
  it("reads the old spending estimate with legacy fallback", () => {
    expect(legacySpendingEstimate({ averageMonthlySpending: 10, monthOutflow: 99 })).toBe(10);
    expect(legacySpendingEstimate({ monthOutflow: 99 })).toBe(99);
    expect(legacySpendingEstimate({ averageMonthlySpending: -5, monthOutflow: 0 })).toBe(0);
    expect(legacySpendingEstimate({ averageMonthlySpending: Number.NaN, monthOutflow: 0 })).toBe(0);
  });

  it("monthly net is income − spending", () => {
    expect(estimatedMonthlyNetCashflow(1_000, 30)).toBe(970);
    expect(estimatedMonthlyNetCashflow(60_000_000, 20_000_000)).toBe(40_000_000);
    expect(estimatedMonthlyNetCashflow(0, 0)).toBe(0);
  });

  it("projects net worth linearly to year end, adding back debt principal", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00+07:00"));
    const months = fractionalMonthsUntilYearEnd();
    expect(months).toBeCloseTo(6.0452, 3);
    expect(projectNetWorthEndOfYear(1_000, 10)).toBeCloseTo(1_000 + 10 * months, 6);
    expect(projectNetWorthEndOfYear(1_000, 10, { principalMonthly: 5 })).toBeCloseTo(1_000 + 15 * months, 6);
  });
});

describe("net worth tracking", () => {
  it("month keys and MTD percent", () => {
    expect(monthCalendarKey(new Date(2026, 0, 31))).toBe("2026-01");
    expect(monthToDateNetWorthChangePercent({ netWorthMonthBaseline: 200 }, 250)).toBe(25);
    expect(monthToDateNetWorthChangePercent({ netWorthMonthBaseline: -200 }, -100)).toBe(50);
    expect(monthToDateNetWorthChangePercent({ netWorthMonthBaseline: 0.5 }, 250)).toBe(0);
    expect(monthToDateNetWorthChangePercent({}, 250)).toBe(0);
  });

  it("first visit sets baseline to current net worth", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00+07:00"));
    expect(syncNetWorthTracking(PREFERENCES_SEED, 500)).toEqual({
      ...PREFERENCES_SEED,
      netWorthMonthKey: "2026-03",
      netWorthMonthBaseline: 500,
      lastKnownNetWorth: 500,
      netWorthMonthlyHistory: [{ monthKey: "2026-03", value: 500 }],
    });
  });

  it("same month keeps baseline; month rollover uses last known", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T10:00:00+07:00"));
    const prev = {
      ...PREFERENCES_SEED,
      netWorthMonthKey: "2026-03",
      netWorthMonthBaseline: 400,
      lastKnownNetWorth: 450,
      netWorthMonthlyHistory: [{ monthKey: "2026-03", value: 450 }],
    };
    expect(syncNetWorthTracking(prev, 600)).toMatchObject({
      netWorthMonthBaseline: 400,
      lastKnownNetWorth: 600,
      netWorthMonthlyHistory: [{ monthKey: "2026-03", value: 600 }],
    });

    vi.setSystemTime(new Date("2026-04-02T10:00:00+07:00"));
    expect(syncNetWorthTracking(prev, 700)).toMatchObject({
      netWorthMonthKey: "2026-04",
      netWorthMonthBaseline: 450,
      lastKnownNetWorth: 700,
      netWorthMonthlyHistory: [
        { monthKey: "2026-03", value: 450 },
        { monthKey: "2026-04", value: 700 },
      ],
    });
  });

  it("keeps the last five years of history", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:00:00+07:00"));
    const history = Array.from({ length: 62 }, (_, i) => {
      const d = new Date(2021, 6 + i, 1);
      return { monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, value: i };
    });
    const next = syncNetWorthTracking({ ...PREFERENCES_SEED, netWorthMonthlyHistory: history }, 99);
    const keys = next.netWorthMonthlyHistory!.map((h) => h.monthKey);
    expect(keys).toHaveLength(60);
    expect(keys[0]).toBe("2021-09");
    expect(keys.at(-1)).toBe("2026-08");
  });
});

describe("buildNetWorthTrend", () => {
  it("starts at the first tracked month, carries gaps, uses live current month", () => {
    const now = new Date("2026-06-15T10:00:00+07:00");
    const history = [
      { monthKey: "2026-02", value: 100 },
      { monthKey: "2026-04", value: 300 },
    ];
    const trend = buildNetWorthTrend(history, 500, now);
    expect(trend.map((p) => p.monthKey)).toEqual(["2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
    expect(trend.map((p) => p.value)).toEqual([100, 100, 300, 300, 500]);
    expect(trend.map((p) => p.change)).toEqual([null, 0, 200, 0, 200]);
    expect(trend[2].changePct).toBe(200);
    expect(trend.at(-1)!.live).toBe(true);
    expect(trend.filter((p) => p.live)).toHaveLength(1);
  });

  it("shows only the current month before any history, and at most 12 months", () => {
    const now = new Date("2026-06-15T10:00:00+07:00");
    expect(buildNetWorthTrend([], 42, now)).toEqual([
      expect.objectContaining({ monthKey: "2026-06", value: 42, live: true, change: null }),
    ]);
    const long = Array.from({ length: 20 }, (_, i) => {
      const d = new Date(2024, 10 + i, 1);
      return { monthKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, value: i };
    });
    const trend = buildNetWorthTrend(long, 1, now);
    expect(trend).toHaveLength(12);
    expect(trend[0].monthKey).toBe("2025-07");
    expect(buildNetWorthTrend(long, 1, now, 36)).toHaveLength(20);
  });

  it("detects unchanged tracking", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T10:00:00+07:00"));
    const once = syncNetWorthTracking(PREFERENCES_SEED, 500);
    expect(netWorthTrackingUnchanged(once, syncNetWorthTracking(once, 500))).toBe(true);
    expect(netWorthTrackingUnchanged(once, syncNetWorthTracking(once, 501))).toBe(false);
    // Same data with jsonb-style key order (as returned by Postgres) is still unchanged.
    const fromDb = {
      ...once,
      netWorthMonthlyHistory: once.netWorthMonthlyHistory!.map((h) => ({ value: h.value, monthKey: h.monthKey })),
    };
    expect(netWorthTrackingUnchanged(fromDb, syncNetWorthTracking(fromDb, 500))).toBe(true);
  });
});
