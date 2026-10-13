import { describe, expect, it } from "vitest";

import { ASSETS_SEED } from "@/entities/asset";
import { debtPayoff, monthlyInterest, totalMonthlyInterest, type Debt } from "@/entities/debt";
import { resolveGoalStatus } from "@/entities/goal";
import { capitalYieldPct, effectiveIncomeCapital, type IncomeSource } from "@/entities/income";
import { analyzeMilestone, resolveMilestoneSettings } from "@/entities/milestone";
import {
  computeDashboardSummary,
  computeFinancialHealth,
  computeNetWorth,
  instantAccessAssets,
} from "@/entities/portfolio";
import { PREFERENCES_SEED } from "@/entities/preferences";
import type { PersonalLoan } from "@/entities/personal-loan";
import type { SettingsAsset } from "@/entities/settings-asset";
import { birthdayAtAge, parseIsoDateOnly } from "@/shared/lib/milestone-projection";

const debt = (over: Partial<Debt>): Debt => ({
  id: "d",
  name: "Loan",
  balance: 120_000_000,
  ratePct: 12,
  rateKind: "Fixed",
  nextPayment: "",
  ...over,
});

describe("debts", () => {
  it("monthly interest = balance × rate ÷ 12", () => {
    expect(monthlyInterest(debt({}))).toBeCloseTo(1_200_000, 6);
    expect(totalMonthlyInterest([debt({}), debt({ balance: 60_000_000, ratePct: 6 })])).toBeCloseTo(1_500_000, 6);
  });

  it("payoff with a fixed payment (standard amortization)", () => {
    const now = new Date(2026, 9, 2);
    // 120M at 12%/yr, 10M/month: n = −ln(1 − 0.01·120/10)/ln(1.01) ≈ 12.85 months.
    const p = debtPayoff(debt({ monthlyPayment: 10_000_000 }), now);
    if (p.kind !== "date") throw new Error(p.kind);
    expect(p.months).toBeCloseTo(-Math.log(1 - 0.12) / Math.log(1.01), 6);
    expect(p.totalInterest).toBeCloseTo(10_000_000 * p.months - 120_000_000, 2);
    expect(p.date.getMonth()).toBe((9 + 13) % 12);
  });

  it("zero rate, no payment, payment below interest, paid off", () => {
    const zero = debtPayoff(debt({ ratePct: 0, monthlyPayment: 10_000_000 }));
    expect(zero).toMatchObject({ kind: "date", months: 12, totalInterest: 0 });
    expect(debtPayoff(debt({})).kind).toBe("unknown");
    expect(debtPayoff(debt({ monthlyPayment: 1_000_000 }))).toEqual({ kind: "never", monthlyInterest: 1_200_000 });
    expect(debtPayoff(debt({ balance: 0, monthlyPayment: 1 })).kind).toBe("paid_off");
  });
});

describe("goal status uses the plan's share and growth", () => {
  const now = new Date("2026-01-01T12:00:00+07:00");
  it("two plans each needing 10/month with 12/month net are not both on track", () => {
    const each = resolveGoalStatus({ startingBalance: 0, targetAmount: 120, targetDateIso: "2027-01-01", householdMonthlyNet: 12, monthlyShare: 0.5, now });
    expect(each.code).toBe("behind");
    expect(each.tone).toBe("danger");
  });

  it("growth alone can carry a plan", () => {
    const s = resolveGoalStatus({ startingBalance: 1_000, targetAmount: 1_040, targetDateIso: "2027-01-01", householdMonthlyNet: 0, monthlyShare: 0, expectedReturnPct: 5, now });
    expect(s.code).toBe("on_track");
  });
});

describe("income capital", () => {
  const options = [{ key: "cash:x", label: "Deposit", amount: 100 }];
  const a: IncomeSource = { id: "a", kind: "passive", name: "A", details: "", icon: "", monthly: 1, capitalLines: [{ id: "1", sourceKey: "cash:x", amount: 80 }] };
  const b: IncomeSource = { ...a, id: "b", capitalLines: [{ id: "2", sourceKey: "cash:x", amount: 80 }] };
  it("is scaled down when sources over-reserve an asset", () => {
    expect(effectiveIncomeCapital(a, [a, b], options)).toBe(50);
    expect(effectiveIncomeCapital(a, [a], options)).toBe(80);
  });
  it("yield = monthly × 12 ÷ capital", () => {
    expect(capitalYieldPct(500_000, 100_000_000)).toBeCloseTo(6, 10);
    expect(capitalYieldPct(500_000, 0)).toBeNull();
  });
});

describe("net worth with personal loans (opt-in)", () => {
  const loans: PersonalLoan[] = [
    { id: "1", person: "A", amount: 5_000_000, direction: "lent_out", status: "open" },
    { id: "2", person: "B", amount: 2_000_000, direction: "borrowed", status: "open" },
    { id: "3", person: "C", amount: 9_000_000, direction: "lent_out", status: "settled" },
  ];
  const catalog: SettingsAsset[] = [{ id: "c", name: "Bank", category: "Cash", currentValue: 100_000_000 }];
  it("excluded by default, open entries only when on", () => {
    const base = { assets: ASSETS_SEED, settingsAssets: catalog, debts: [] };
    expect(computeNetWorth({ ...base, personalLoans: loans })).toBe(100_000_000);
    expect(computeNetWorth({ ...base, personalLoans: loans, includeLoans: true })).toBe(103_000_000);
    const s = computeDashboardSummary({
      ...base,
      incomeSources: [],
      prefs: { ...PREFERENCES_SEED, includeLoansInNetWorth: true },
      personalLoans: loans,
    });
    expect(s).toMatchObject({ grossAssets: 105_000_000, liabilities: 2_000_000, netWorth: 103_000_000, loansLent: 5_000_000 });
  });
});

describe("financial health", () => {
  const catalog: SettingsAsset[] = [
    { id: "c", name: "Bank", category: "Cash", currentValue: 60_000_000, liquidity: "instant" },
    { id: "h", name: "Flat", category: "Real Estate", currentValue: 240_000_000, liquidity: "not_instant" },
  ];
  const income: IncomeSource[] = [
    { id: "s", kind: "active", name: "Salary", details: "", icon: "", monthly: 30_000_000 },
    { id: "p", kind: "passive", name: "Rent", details: "", icon: "", monthly: 5_000_000 },
  ];
  const prefs = { ...PREFERENCES_SEED, averageMonthlySpending: 20_000_000 };
  const debts = [debt({ balance: 30_000_000, ratePct: 12 })];
  const summary = computeDashboardSummary({ assets: ASSETS_SEED, debts, settingsAssets: catalog, incomeSources: income, prefs });
  const h = computeFinancialHealth({ summary, assets: ASSETS_SEED, settingsAssets: catalog, debts, annualRealRate: 0 });

  it("emergency runway, liquidity, debt ratio, interest", () => {
    expect(instantAccessAssets(ASSETS_SEED, catalog)).toBe(60_000_000);
    expect(h.emergencyMonths).toBe(3);
    expect(h.liquidShare).toBeCloseTo(0.2, 10);
    expect(h.debtToAssets).toBeCloseTo(0.1, 10);
    expect(h.monthlyInterest).toBeCloseTo(300_000, 6);
  });

  it("FI number, progress, passive coverage, years to FI", () => {
    expect(h.fiNumber).toBe(20_000_000 * 12 * 25);
    expect(h.fiProgress).toBeCloseTo(270_000_000 / 6_000_000_000, 10);
    expect(h.passiveCoverage).toBeCloseTo(0.25, 10);
    // Linear at 0 % return: (6B − 270M) / 15M per month.
    expect(h.yearsToFi).toBeCloseTo((6_000_000_000 - 270_000_000) / 15_000_000 / 12, 6);
  });

  it("leaves debt repayments out of the FI number but not the emergency runway", () => {
    const expenses = {
      items: [
        { id: "l", name: "Loan", category: "debt" as const, kind: "bill" as const, amount: 4_000_000, frequency: "monthly" as const, debtId: debts[0].id, createdAt: "2026-01-01" },
      ],
    };
    const s2 = computeDashboardSummary({ assets: ASSETS_SEED, debts, settingsAssets: catalog, incomeSources: income, prefs, expenses });
    const h2 = computeFinancialHealth({ summary: s2, assets: ASSETS_SEED, settingsAssets: catalog, debts, annualRealRate: 0 });
    expect(s2.averageSpending).toBe(24_000_000);
    expect(h2.emergencyMonths).toBe(2.5);
    expect(h2.fiNumber).toBe(20_000_000 * 12 * 25);
    expect(h2.passiveCoverage).toBeCloseTo(0.25, 10);
  });

  it("nulls without spending", () => {
    const s0 = computeDashboardSummary({ assets: ASSETS_SEED, debts: [], settingsAssets: [], incomeSources: [], prefs: PREFERENCES_SEED });
    const h0 = computeFinancialHealth({ summary: s0, assets: ASSETS_SEED, settingsAssets: [], debts: [] });
    expect(h0).toMatchObject({ emergencyMonths: null, liquidShare: null, debtToAssets: null, fiNumber: null, yearsToFi: null });
  });
});

describe("milestone", () => {
  it("29 Feb birthdays fall on 28 Feb in non-leap years", () => {
    const d = birthdayAtAge(parseIsoDateOnly("1996-02-29")!, 35);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2031, 1, 28]);
    const leap = birthdayAtAge(parseIsoDateOnly("1996-02-29")!, 36);
    expect(leap.getDate()).toBe(29);
  });

  const config = { vndPerUsd: 10, annualRealRate: 0.05, realRateSource: "default" as const, vndPerUsdSource: "env" as const, fxFetchedAtIso: null, fxApiLastUpdateIso: null };
  const settings = resolveMilestoneSettings({ birthDate: "1995-01-01", targetUsd: 1_000_000, targetAge: 40 });
  const now = new Date("2026-01-01T12:00:00+07:00");

  it("compounds positive net worth at the real return; debt is carried flat", () => {
    const grown = analyzeMilestone({ config, settings, currentNetWorth: 1_000_000, monthlyNetContribution: 0, now });
    const flat = analyzeMilestone({ config: { ...config, annualRealRate: 0 }, settings, currentNetWorth: 1_000_000, monthlyNetContribution: 0, now });
    if (grown.kind !== "projection" || flat.kind !== "projection") throw new Error("expected projections");
    expect(flat.projectedEndingNetWorth).toBe(1_000_000);
    expect(grown.projectedEndingNetWorth).toBeCloseTo(1_000_000 * Math.pow(1.05, grown.monthsRemaining / 12), 4);
    const indebted = analyzeMilestone({ config, settings, currentNetWorth: -500, monthlyNetContribution: 0, now });
    if (indebted.kind !== "projection") throw new Error("expected projection");
    expect(indebted.projectedEndingNetWorth).toBe(-500);
    expect(indebted.pct).toBe(0);
  });
});
