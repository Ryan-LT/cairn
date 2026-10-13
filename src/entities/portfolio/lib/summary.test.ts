import { afterEach, describe, expect, it, vi } from "vitest";

import { computeDashboardSummary, computeNetWorth, liquidityBandLabel, liquidityBandTone, summarizeCashflow } from "@/entities/portfolio";
import { fixtureAssets, fixtureCatalog, fixtureDebts, fixtureExpenses, fixtureIncome, fixturePrefs } from "@/test/fixtures/tables";

afterEach(() => vi.useRealTimers());

describe("portfolio summary", () => {
  it("computes net worth and cashflow", () => {
    expect(computeNetWorth({ assets: fixtureAssets, settingsAssets: fixtureCatalog, debts: fixtureDebts })).toBe(4_330_000_000);
    expect(summarizeCashflow({ prefs: fixturePrefs, sources: fixtureIncome })).toEqual({
      totalIncome: 61_500_000,
      activeIncome: 60_000_000,
      passiveIncome: 1_500_000,
      averageSpending: 25_000_000,
      monthlyNet: 36_500_000,
      spending: {
        total: 25_000_000,
        itemized: 0,
        living: 25_000_000,
        needs: 0,
        wants: 0,
        debtPayments: 0,
        debtPrincipal: 0,
        unitemized: 25_000_000,
        legacyEstimate: 25_000_000,
        source: "estimate",
      },
    });
  });

  it("keeps the rest of the old estimate until it is broken down, then adds debt repayments", () => {
    const s = summarizeCashflow({ prefs: fixturePrefs, sources: fixtureIncome, expenses: fixtureExpenses, debts: fixtureDebts });
    // Live items 23,2tr: 16,2tr living costs + 7tr car-loan payment; 25tr − 16,2tr of the estimate is still unitemized.
    expect(s.spending).toMatchObject({ itemized: 23_200_000, debtPayments: 7_000_000, unitemized: 8_800_000, source: "mixed" });
    expect(s.averageSpending).toBe(32_000_000);
    expect(s.spending.living).toBe(25_000_000);
    expect(s.monthlyNet).toBe(29_500_000);
    // Car loan 250tr at 9,5 %: interest ≈ 1,98tr of the 7tr payment.
    expect(s.spending.debtPrincipal).toBeCloseTo(7_000_000 - (250_000_000 * 0.095) / 12, 0);
  });

  it("uses only items once they exceed the estimate or it is retired", () => {
    const low = summarizeCashflow({
      prefs: { ...fixturePrefs, averageMonthlySpending: 10_000_000 },
      sources: fixtureIncome,
      expenses: fixtureExpenses,
      debts: fixtureDebts,
    });
    expect(low.spending).toMatchObject({ unitemized: 0, total: 23_200_000, source: "items" });
    const retired = summarizeCashflow({
      prefs: fixturePrefs,
      sources: fixtureIncome,
      expenses: { ...fixtureExpenses, legacyEstimate: { retiredAt: "2026-10-01", amount: 25_000_000 } },
      debts: fixtureDebts,
    });
    expect(retired.averageSpending).toBe(23_200_000);
    expect(retired.spending.legacyEstimate).toBe(0);
  });

  it("computes the dashboard summary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T12:00:00+07:00"));
    const s = computeDashboardSummary({
      assets: fixtureAssets,
      debts: fixtureDebts,
      settingsAssets: fixtureCatalog,
      incomeSources: fixtureIncome,
      prefs: fixturePrefs,
    });
    expect(s).toMatchObject({
      grossAssets: 4_600_000_000,
      liabilities: 270_000_000,
      netWorth: 4_330_000_000,
      portfolioDetailTotal: 3_650_000_000,
      assetConfigurationTotal: 950_000_000,
      monthlyNet: 36_500_000,
    });
    expect(s.eoyProjection).toBeGreaterThan(4_330_000_000);
    expect(s.eoyProjection).toBeLessThan(4_330_000_000 + 36_500_000);
  });

  it("adds debt principal back in the year-end projection", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00+07:00"));
    const base = { assets: fixtureAssets, debts: fixtureDebts, settingsAssets: fixtureCatalog, incomeSources: fixtureIncome, prefs: fixturePrefs };
    const withLoan = computeDashboardSummary({ ...base, expenses: fixtureExpenses });
    const months = (withLoan.eoyProjection - withLoan.netWorth) / (withLoan.monthlyNet + withLoan.spending.debtPrincipal);
    expect(months).toBeCloseTo(6.0452, 3);
  });

  it("labels liquidity bands", () => {
    expect(liquidityBandLabel("instant")).toBe("Instant access");
    expect(liquidityBandTone("not_instant")).toBe("warning");
    expect(liquidityBandTone("custom")).toBe("neutral");
  });
});
