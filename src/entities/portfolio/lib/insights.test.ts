import { describe, expect, it } from "vitest";

import { buildMonthView, planVsActual, type ExpensesDoc } from "@/entities/expense";
import { ASSETS_SEED } from "@/entities/asset";
import { GOALS_SEED } from "@/entities/goal";
import { PREFERENCES_SEED } from "@/entities/preferences";
import { fixtureCatalog, fixtureDebts, fixtureExpenseLog, fixtureExpenses, fixtureIncome, fixturePrefs } from "@/test/fixtures/tables";

import { computeFinancialHealth } from "./health";
import { buildInsights, type Insight } from "./insights";
import { computeSetupProgress } from "./setup-progress";
import { computeDashboardSummary } from "./summary";

const NOW = new Date(2026, 9, 13, 10);

function run(over: { expenses?: ExpensesDoc; prefs?: typeof fixturePrefs; debts?: typeof fixtureDebts; monthlyNetOverride?: number } = {}) {
  const expenses = over.expenses ?? fixtureExpenses;
  const debts = over.debts ?? fixtureDebts;
  const summary = computeDashboardSummary({ assets: ASSETS_SEED, debts, settingsAssets: fixtureCatalog, incomeSources: fixtureIncome, prefs: over.prefs ?? fixturePrefs, expenses });
  const health = computeFinancialHealth({ summary, assets: ASSETS_SEED, settingsAssets: fixtureCatalog, debts });
  const month = buildMonthView({ expenses, log: fixtureExpenseLog, debts, monthKey: "2026-10", today: NOW });
  const history = planVsActual({ expenses, log: fixtureExpenseLog, debts, monthKeys: ["2026-09", "2026-10"], today: NOW });
  return buildInsights({ now: NOW, cashflow: summary, health, month, history, debts, expenses, goals: [], sharesOverAllocated: false, settingsAssets: fixtureCatalog });
}

const codes = (list: Insight[]) => list.map((i) => i.code);

describe("buildInsights", () => {
  it("leads with what's due and flags costly debt", () => {
    const list = run();
    // Car loan (d1, due 15th) is 2 days away; credit card at 24 % is the costly one.
    expect(list[0]).toMatchObject({ code: "bills_due_week", severity: "warning", count: 1, nextName: "Car loan", days: 2 });
    expect(codes(list)).toContain("costly_debt_first");
    expect(list.find((i) => i.code === "costly_debt_first")).toMatchObject({ debtName: "Credit card", ratePct: 24 });
    // Income 61,5tr − 32tr spending: 48 % saved.
    expect(codes(list)).toContain("savings_rate_good");
    expect(codes(list).indexOf("savings_rate_good")).toBe(list.length - (codes(list).includes("emergency_ok") ? 2 : 1));
  });

  it("warns about negative cash flow and the leftover estimate", () => {
    const list = run({ prefs: { ...fixturePrefs, averageMonthlySpending: 90_000_000 } });
    expect(list.find((i) => i.code === "negative_net")).toMatchObject({ severity: "critical" });
    expect(codes(list)).toContain("unitemized_estimate");
    expect(codes(list)).not.toContain("savings_rate_good");
  });

  it("mentions a big yearly bill coming up", () => {
    const expenses: ExpensesDoc = {
      items: [...fixtureExpenses.items, { id: "tet", name: "Quỹ Tết", category: "giving", kind: "budget", amount: 40_000_000, frequency: "yearly", dueMonth: 11, createdAt: "2026-01-01" }],
    };
    expect(run({ expenses }).find((i) => i.code === "yearly_bill_ahead")).toMatchObject({ name: "Quỹ Tết", amount: 40_000_000, date: "2026-11-01" });
  });
});

describe("computeSetupProgress", () => {
  it("counts what's been entered and hides once dismissed", () => {
    const empty = computeSetupProgress({ incomeSources: [], expenses: { items: [] }, settingsAssets: [], legacyAssets: ASSETS_SEED, debts: [], goals: GOALS_SEED, setup: undefined });
    expect(empty).toMatchObject({ done: 0, total: 5, visible: true, next: "income" });
    const some = computeSetupProgress({
      incomeSources: fixtureIncome,
      expenses: fixtureExpenses,
      settingsAssets: [],
      legacyAssets: ASSETS_SEED,
      debts: [],
      goals: GOALS_SEED,
      setup: { noDebts: true },
    });
    expect(some).toMatchObject({ done: 3, next: "assets", visible: true });
    expect(computeSetupProgress({ incomeSources: [], expenses: { items: [] }, settingsAssets: [], legacyAssets: ASSETS_SEED, debts: [], goals: GOALS_SEED, setup: { dismissedAt: "2026-10-01" } }).visible).toBe(false);
    expect(PREFERENCES_SEED.setup).toBeUndefined();
  });
});
