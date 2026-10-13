import { describe, expect, it } from "vitest";

import { ASSETS_SEED } from "@/entities/asset";
import type { Debt } from "@/entities/debt";
import type { ExpensesDoc } from "@/entities/expense";
import type { SettingsAsset } from "@/entities/settings-asset";

import type { FinancialHealth } from "./health";
import { computeHealthReport, gradeOf, linearScore, monthlyDebtPayments } from "./health-report";
import type { DashboardSummary } from "./summary";

const spending = { total: 20_000_000, itemized: 20_000_000, living: 17_000_000, needs: 12_000_000, wants: 8_000_000, debtPayments: 3_000_000, debtPrincipal: 2_000_000, unitemized: 0, legacyEstimate: 0, source: "items" as const };
const summary = (p: Partial<DashboardSummary> = {}): DashboardSummary => ({
  totalIncome: 40_000_000,
  activeIncome: 38_000_000,
  passiveIncome: 2_000_000,
  averageSpending: 20_000_000,
  monthlyNet: 20_000_000,
  spending,
  grossAssets: 1_000_000_000,
  liabilities: 200_000_000,
  netWorth: 800_000_000,
  eoyProjection: 0,
  portfolioDetailTotal: 0,
  assetConfigurationTotal: 1_000_000_000,
  loansLent: 0,
  loansBorrowed: 0,
  ...p,
});
const health = (p: Partial<FinancialHealth> = {}): FinancialHealth => ({
  instantAssets: 150_000_000,
  emergencyMonths: 7.5,
  liquidShare: 0.15,
  debtToAssets: 0.2,
  monthlyInterest: 1_500_000,
  passiveCoverage: 2 / 17,
  fiNumber: 17_000_000 * 12 * 25,
  fiProgress: 800 / 5100,
  yearsToFi: 12,
  ...p,
});
const debts: Debt[] = [{ id: "car", name: "Xe", balance: 200_000_000, ratePct: 9, rateKind: "Fixed", monthlyPayment: 6_000_000, nextPayment: "" }];
const expenses: ExpensesDoc = { items: [{ id: "rent", name: "Thuê", category: "housing", kind: "bill", amount: 10_000_000, frequency: "monthly", createdAt: "2026-01-01" }, { id: "food", name: "Chợ", category: "food", kind: "budget", amount: 5_000_000, frequency: "monthly", createdAt: "2026-01-01" }] };
const assets: SettingsAsset[] = [
  { id: "a", name: "Nhà", category: "Real Estate", currentValue: 600_000_000 },
  { id: "b", name: "Tiền", category: "Cash", currentValue: 150_000_000 },
  { id: "c", name: "Vàng", category: "Precious Metals", currentValue: 100_000_000, holding: { kind: "gold", product: "sjc_bar", weight: 7, unit: "chi" } },
  { id: "d", name: "Cổ phiếu", category: "Stocks & ETFs", currentValue: 150_000_000 },
];
const base = { summary: summary(), health: health(), debts, expenses, history: null, netWorthHistory: [], settingsAssets: assets, legacyAssets: ASSETS_SEED, plans: [], now: new Date(2026, 9, 13) };

describe("health report", () => {
  it("scores linearly and grades", () => {
    expect(linearScore(3, 0, 6)).toBe(50);
    expect(linearScore(9, 0, 6)).toBe(100);
    expect(linearScore(0.25, 0.5, 0)).toBe(50);
    expect(linearScore(Number.NaN, 0, 1)).toBe(0);
    expect([90, 75, 60, 45, 10].map(gradeOf)).toEqual(["A", "B", "C", "D", "E"]);
  });

  it("works out each metric", () => {
    const r = computeHealthReport(base);
    const m = Object.fromEntries(r.metrics.map((x) => [x.id, x]));
    expect(m.emergency).toMatchObject({ tone: "success", score: 100, value: { kind: "months", value: 7.5 } });
    expect(m.runway.value).toEqual({ kind: "months", value: 150_000_000 / 18_000_000 });
    expect(m.savingsRate).toMatchObject({ value: { kind: "percent", value: 0.5 }, tone: "success", score: 100 });
    expect(m.fixedCosts.value).toEqual({ kind: "percent", value: 0.25 });
    expect(m.needs.value).toEqual({ kind: "percent", value: 0.3 });
    expect(m.debtService).toMatchObject({ value: { kind: "percent", value: 0.15 }, tone: "success", score: 70 });
    expect(m.debtToAssets.score).toBe(80);
    expect(m.debtFree.tone).toBe("warning");
    expect(m.concentration).toMatchObject({ value: { kind: "percent", value: 0.6 }, tone: "warning", detail: { category: "Real Estate", categories: 4 } });
    expect(m.hedge.value).toEqual({ kind: "percent", value: 0.1 });
    expect(monthlyDebtPayments([...debts, { ...debts[0], id: "paid", balance: 0 }])).toBe(6_000_000);
  });

  it("weights the overall score over what is known and names the weakest areas", () => {
    const r = computeHealthReport(base);
    expect(r.score).not.toBeNull();
    expect(r.grade).toBe(gradeOf(r.score!));
    expect(r.focus[0]).toBe("fi");
    const weak = computeHealthReport({ ...base, summary: summary({ monthlyNet: -1_000_000 }), health: health({ emergencyMonths: 0.5, instantAssets: 10_000_000 }) });
    expect(weak.score!).toBeLessThan(r.score!);
    expect(weak.focus.slice(0, 2).sort()).toEqual(["emergency", "savingsRate"]);
  });

  it("handles no income, no debts, passive income above spending and a net worth trend", () => {
    const r = computeHealthReport({
      ...base,
      summary: summary({ totalIncome: 0, passiveIncome: 25_000_000, monthlyNet: -20_000_000 }),
      debts: [],
      netWorthHistory: [
        { monthKey: "2026-04", value: 700_000_000 },
        { monthKey: "2026-10", value: 770_000_000 },
        { monthKey: "2026-05", value: 710_000_000 },
      ],
    });
    const m = Object.fromEntries(r.metrics.map((x) => [x.id, x]));
    expect(m.savingsRate.value).toEqual({ kind: "none" });
    expect(m.runway.value).toEqual({ kind: "unlimited" });
    expect(m.debtFree).toMatchObject({ tone: "success", value: { kind: "months", value: 0 } });
    expect(m.trend).toMatchObject({ value: { kind: "signedPercent", value: 0.1 }, tone: "success", score: 100 });
  });

  it("needs half the weight before giving a score", () => {
    const r = computeHealthReport({ ...base, summary: summary({ totalIncome: 0, averageSpending: 0 }), health: health({ emergencyMonths: null, liquidShare: null, debtToAssets: null, fiProgress: null }), debts: [], settingsAssets: [] });
    expect(r.score).toBeNull();
    expect(r.grade).toBeNull();
  });
});
