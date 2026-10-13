import type { Debt } from "@/entities/debt";
import { monthlyInterest } from "@/entities/debt";
import {
  dueDatesInMonth,
  liveItems,
  monthlyEquivalent,
  linkedDebt,
  plannedForMonth,
  suggestDebtBills,
  type ExpensesDoc,
  type MonthView,
  type PlanVsActual,
} from "@/entities/expense";
import type { GoalPlanWithStatus } from "@/entities/goal";
import type { SettingsAsset } from "@/entities/settings-asset";
import { addMonths, daysUntilIso, monthKeyOf } from "@/shared/lib/month";

import type { FinancialHealth } from "./health";
import type { CashflowSummary } from "./summary";

export type InsightSeverity = "critical" | "warning" | "info" | "positive";

export type Insight = { id: string; severity: InsightSeverity; href: string } & (
  | { code: "bills_overdue"; count: number; total: number }
  | { code: "bills_due_week"; count: number; total: number; nextName: string; days: number }
  | { code: "negative_net"; monthlyNet: number }
  | { code: "emergency_low"; months: number }
  | { code: "emergency_ok"; months: number }
  | { code: "costly_debt_first"; debtName: string; ratePct: number; monthlyInterest: number }
  | { code: "budget_over"; name: string; over: number }
  | { code: "plan_drift"; averageActual: number; averagePlanned: number }
  | { code: "goal_off_track"; planId: string; name: string; extraNeeded: number }
  | { code: "shares_over_allocated" }
  | { code: "unlinked_debt_payment"; count: number; total: number }
  | { code: "unitemized_estimate"; amount: number }
  | { code: "yearly_bill_ahead"; name: string; amount: number; date: string; perMonth: number }
  | { code: "assets_stale"; count: number }
  | { code: "savings_rate_good"; pct: number }
);

export type InsightCode = Insight["code"];

const ORDER: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };

/** Rule thresholds (tested; keep the copy in `t.insights` in step). */
export const INSIGHT_RULES = {
  emergencyCriticalMonths: 1,
  emergencyWarningMonths: 3,
  emergencyGoodMonths: 6,
  costlyDebtRatePct: 12,
  /** A drift smaller than this share of the plan isn't worth mentioning. */
  planDriftShare: 0.05,
  yearlyBillDays: 45,
  /** …and only when it's a big bite: more than this share of the monthly net. */
  yearlyBillNetShare: 0.2,
  staleAssetDays: 90,
  goodSavingsRate: 0.2,
} as const;

/**
 * Plain-language nudges for the overview, most urgent first: what's overdue
 * or due, what's risky, what could be better, and what's going well. Pure:
 * the UI turns each code into text.
 */
export function buildInsights(input: {
  now: Date;
  cashflow: CashflowSummary;
  health: FinancialHealth;
  /** The current month. */
  month: MonthView;
  history: PlanVsActual;
  debts: readonly Debt[];
  expenses: ExpensesDoc;
  goals: readonly GoalPlanWithStatus[];
  sharesOverAllocated: boolean;
  settingsAssets: readonly SettingsAsset[];
}): Insight[] {
  const R = INSIGHT_RULES;
  const out: Insight[] = [];
  const { month, cashflow, health } = input;

  // Bills
  const overdue = month.groups.overdue;
  if (overdue.length) {
    out.push({ id: "bills_overdue", code: "bills_overdue", severity: "critical", href: "/cashflow", count: overdue.length, total: overdue.reduce((s, b) => s + b.remaining, 0) });
  }
  const soon = month.groups.dueSoon.filter((b) => (b.daysUntilDue ?? 99) <= 7);
  if (soon.length) {
    const days = Math.min(...soon.map((b) => b.daysUntilDue ?? 7));
    out.push({
      id: "bills_due_week",
      code: "bills_due_week",
      severity: days <= 2 ? "warning" : "info",
      href: "/cashflow",
      count: soon.length,
      total: soon.reduce((s, b) => s + b.remaining, 0),
      nextName: soon[0].item.name,
      days,
    });
  }

  // Cash flow
  if (cashflow.totalIncome > 0 && cashflow.monthlyNet < 0) {
    out.push({ id: "negative_net", code: "negative_net", severity: "critical", href: "/cashflow/spending", monthlyNet: cashflow.monthlyNet });
  } else if (cashflow.totalIncome > 0 && cashflow.monthlyNet / cashflow.totalIncome >= R.goodSavingsRate) {
    out.push({ id: "savings_rate_good", code: "savings_rate_good", severity: "positive", href: "/cashflow", pct: (cashflow.monthlyNet / cashflow.totalIncome) * 100 });
  }

  // Safety net
  if (health.emergencyMonths !== null) {
    const m = health.emergencyMonths;
    if (m < R.emergencyWarningMonths) {
      out.push({ id: "emergency_low", code: "emergency_low", severity: m < R.emergencyCriticalMonths ? "critical" : "warning", href: "/wealth", months: m });
    } else if (m >= R.emergencyGoodMonths) {
      out.push({ id: "emergency_ok", code: "emergency_ok", severity: "positive", href: "/wealth", months: m });
    }
  }

  // Debts
  const costly = [...input.debts].filter((d) => d.balance > 0 && d.ratePct >= R.costlyDebtRatePct).sort((a, b) => b.ratePct - a.ratePct)[0];
  if (costly) {
    out.push({ id: "costly_debt_first", code: "costly_debt_first", severity: "warning", href: "/wealth/debts", debtName: costly.name, ratePct: costly.ratePct, monthlyInterest: monthlyInterest(costly) });
  }
  const unlinked = suggestDebtBills(input.expenses.items, input.debts);
  if (unlinked.length && liveItems(input.expenses.items).length) {
    out.push({ id: "unlinked_debt_payment", code: "unlinked_debt_payment", severity: "info", href: "/cashflow/spending", count: unlinked.length, total: unlinked.reduce((s, d) => s + (d.monthlyPayment ?? 0), 0) });
  }

  // Spending vs plan
  const over = [...month.groups.budgets].filter((b) => b.status === "over").sort((a, b) => b.spent - b.planned - (a.spent - a.planned))[0];
  if (over) out.push({ id: `budget_over:${over.item.id}`, code: "budget_over", severity: "warning", href: "/cashflow", name: over.item.name, over: over.spent - over.planned });
  const { averageActual, averagePlanned } = input.history;
  if (averageActual !== null && averagePlanned !== null && averagePlanned > 0 && averageActual - averagePlanned > averagePlanned * R.planDriftShare) {
    out.push({ id: "plan_drift", code: "plan_drift", severity: "info", href: "/cashflow/spending", averageActual, averagePlanned });
  }
  if (cashflow.spending.unitemized > 0 && cashflow.spending.itemized > 0) {
    out.push({ id: "unitemized_estimate", code: "unitemized_estimate", severity: "info", href: "/cashflow/spending", amount: cashflow.spending.unitemized });
  }

  // Big yearly costs coming up
  const today = input.now;
  for (const item of liveItems(input.expenses.items)) {
    if (item.frequency === "monthly" || item.frequency === "weekly") continue;
    const debt = linkedDebt(item, input.debts);
    for (let i = 0; i <= 2; i++) {
      const key = addMonths(monthKeyOf(today), i);
      const amount = plannedForMonth(item, key, debt);
      if (!amount) continue;
      const date = dueDatesInMonth(item, key, debt)[0] ?? `${key}-01`;
      const days = daysUntilIso(date, today);
      if (days < 0 || days > R.yearlyBillDays) continue;
      if (cashflow.monthlyNet > 0 && amount <= cashflow.monthlyNet * R.yearlyBillNetShare) continue;
      out.push({ id: `yearly:${item.id}`, code: "yearly_bill_ahead", severity: "info", href: "/cashflow", name: item.name, amount, date, perMonth: monthlyEquivalent(item, debt) });
      break;
    }
  }

  // Goals
  for (const g of input.goals) {
    if ((g.status.code === "behind" || g.status.code === "no_savings") && g.planId) {
      out.push({ id: `goal:${g.planId}`, code: "goal_off_track", severity: "warning", href: "/goals", planId: g.planId, name: g.name, extraNeeded: g.status.code === "behind" ? g.status.extraNeeded : (g.status.requiredMonthly ?? 0) });
    }
  }
  if (input.sharesOverAllocated) out.push({ id: "shares_over_allocated", code: "shares_over_allocated", severity: "warning", href: "/goals" });

  // Stale asset values
  const staleCutoff = today.getTime() - R.staleAssetDays * 86_400_000;
  // Values never updated in the app (older saves) aren't counted: we don't know their age.
  const stale = input.settingsAssets.filter((a) => a.currentValue > 0 && a.updatedAt && new Date(`${a.updatedAt}T12:00:00`).getTime() < staleCutoff);
  if (stale.length) out.push({ id: "assets_stale", code: "assets_stale", severity: "info", href: "/wealth", count: stale.length });

  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
