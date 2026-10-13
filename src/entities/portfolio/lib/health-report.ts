import type { AssetsState } from "@/entities/asset";
import { debtPayoff, type Debt } from "@/entities/debt";
import { liveItems, monthlyEquivalent, linkedDebt, type ExpensesDoc, type PlanVsActual } from "@/entities/expense";
import type { GoalPlanWithStatus } from "@/entities/goal";
import type { NetWorthMonthSnapshot } from "@/entities/preferences";
import type { SettingsAsset } from "@/entities/settings-asset";
import type { StatusTone } from "@/shared/lib/tone";

import { assetTotalsByCategory } from "./by-category";
import type { FinancialHealth } from "./health";
import type { DashboardSummary } from "./summary";

/**
 * The full health check: plain numbers in five areas, each with a status, a
 * 0–100 sub-score, and an overall score. Pure; every threshold is here.
 */

export type HealthArea = "safety" | "cashflow" | "debt" | "growth" | "spread";

export type HealthMetricId =
  | "emergency"
  | "runway"
  | "liquid"
  | "savingsRate"
  | "fixedCosts"
  | "needs"
  | "planDrift"
  | "debtToAssets"
  | "debtService"
  | "interestCost"
  | "debtFree"
  | "fi"
  | "passive"
  | "trend"
  | "goals"
  | "concentration"
  | "hedge";

/** How to show a value; the page formats it in the active language. */
export type HealthValue =
  | { kind: "months"; value: number }
  | { kind: "unlimited" }
  | { kind: "percent"; value: number }
  | { kind: "money"; value: number }
  | { kind: "signedPercent"; value: number }
  | { kind: "ratio"; done: number; total: number }
  | { kind: "none" };

export type HealthMetric = {
  id: HealthMetricId;
  area: HealthArea;
  value: HealthValue;
  tone: StatusTone;
  /** 0–100 when it counts toward the overall score, else null (informational or no data). */
  score: number | null;
  /** Extra numbers the explanation uses (e.g. the instant money behind the emergency months). */
  detail?: Record<string, number | string | null>;
};

export type HealthGrade = "A" | "B" | "C" | "D" | "E";

export type HealthReport = {
  /** Weighted 0–100, null without enough data. */
  score: number | null;
  grade: HealthGrade | null;
  metrics: HealthMetric[];
  areaScores: Record<HealthArea, number | null>;
  /** Weakest scored metrics (score < 70), worst first, at most 3. */
  focus: HealthMetricId[];
};

/** Weights of the overall score (only metrics with data count, re-normalized). */
export const HEALTH_WEIGHTS: Partial<Record<HealthMetricId, number>> = {
  emergency: 20,
  savingsRate: 20,
  debtService: 15,
  debtToAssets: 10,
  liquid: 5,
  trend: 10,
  goals: 5,
  concentration: 5,
  fi: 10,
};

/** Linear 0–100 between `zero` and `full` (either order), clamped. */
export function linearScore(value: number, zero: number, full: number): number {
  if (!Number.isFinite(value)) return 0;
  const t = (value - zero) / (full - zero);
  return Math.round(Math.max(0, Math.min(1, t)) * 100);
}

export function gradeOf(score: number): HealthGrade {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
}

/** Monthly payments still owed across debts with a balance. */
export function monthlyDebtPayments(debts: readonly Debt[]): number {
  return debts.reduce((s, d) => s + (d.balance > 0 ? Math.max(0, d.monthlyPayment ?? 0) : 0), 0);
}

export function computeHealthReport(input: {
  summary: DashboardSummary;
  health: FinancialHealth;
  debts: readonly Debt[];
  expenses: ExpensesDoc;
  history: PlanVsActual | null;
  netWorthHistory: readonly NetWorthMonthSnapshot[];
  settingsAssets: readonly SettingsAsset[];
  legacyAssets: AssetsState;
  plans: readonly GoalPlanWithStatus[];
  now: Date;
}): HealthReport {
  const { summary: s, health: h } = input;
  const income = s.totalIncome;
  const metrics: HealthMetric[] = [];
  const push = (m: HealthMetric) => metrics.push(m);

  // Safety net.
  const e = h.emergencyMonths;
  push({ id: "emergency", area: "safety", value: e === null ? { kind: "none" } : { kind: "months", value: e }, tone: e === null ? "neutral" : e >= 6 ? "success" : e >= 3 ? "warning" : "danger", score: e === null ? null : linearScore(e, 0, 6), detail: { instant: h.instantAssets } });
  const gap = s.averageSpending - s.passiveIncome;
  const runway = s.averageSpending <= 0 ? null : gap <= 0 ? Infinity : h.instantAssets / gap;
  push({
    id: "runway",
    area: "safety",
    value: runway === null ? { kind: "none" } : runway === Infinity ? { kind: "unlimited" } : { kind: "months", value: runway },
    tone: runway === null ? "neutral" : runway >= 12 ? "success" : runway >= 6 ? "warning" : "danger",
    score: null,
    detail: { passive: s.passiveIncome },
  });
  const liq = h.liquidShare;
  push({ id: "liquid", area: "safety", value: liq === null ? { kind: "none" } : { kind: "percent", value: liq }, tone: liq === null ? "neutral" : liq >= 0.1 ? "success" : "warning", score: liq === null ? null : linearScore(liq, 0, 0.2) });

  // Cash flow.
  const rate = income > 0 ? s.monthlyNet / income : null;
  push({ id: "savingsRate", area: "cashflow", value: rate === null ? { kind: "none" } : { kind: "percent", value: rate }, tone: rate === null ? "neutral" : rate >= 0.2 ? "success" : rate >= 0.1 ? "warning" : "danger", score: rate === null ? null : linearScore(rate, 0, 0.3), detail: { net: s.monthlyNet } });
  let bills = 0;
  for (const item of liveItems(input.expenses.items)) if (item.kind === "bill") bills += monthlyEquivalent(item, linkedDebt(item, input.debts));
  const fixed = income > 0 ? bills / income : null;
  push({ id: "fixedCosts", area: "cashflow", value: fixed === null ? { kind: "none" } : { kind: "percent", value: fixed }, tone: fixed === null ? "neutral" : fixed <= 0.5 ? "success" : fixed <= 0.7 ? "warning" : "danger", score: null, detail: { bills } });
  const needs = income > 0 ? s.spending.needs / income : null;
  push({ id: "needs", area: "cashflow", value: needs === null ? { kind: "none" } : { kind: "percent", value: needs }, tone: needs === null ? "neutral" : needs <= 0.5 ? "success" : needs <= 0.65 ? "warning" : "danger", score: null });
  const drift = input.history && input.history.averagePlanned && input.history.averageActual !== null ? (input.history.averageActual - input.history.averagePlanned) / input.history.averagePlanned : null;
  push({ id: "planDrift", area: "cashflow", value: drift === null ? { kind: "none" } : { kind: "signedPercent", value: drift }, tone: drift === null ? "neutral" : drift <= 0.05 ? "success" : drift <= 0.15 ? "warning" : "danger", score: null });

  // Debt.
  const dta = h.debtToAssets;
  push({ id: "debtToAssets", area: "debt", value: dta === null ? { kind: "none" } : { kind: "percent", value: dta }, tone: dta === null ? "neutral" : dta <= 0.3 ? "success" : dta <= 0.5 ? "warning" : "danger", score: dta === null ? null : linearScore(dta, 1, 0) });
  const payments = monthlyDebtPayments(input.debts);
  const dti = income > 0 ? payments / income : payments > 0 ? Infinity : null;
  push({ id: "debtService", area: "debt", value: dti === null ? { kind: "none" } : { kind: "percent", value: Number.isFinite(dti) ? dti : 1 }, tone: dti === null ? "neutral" : dti <= 0.2 ? "success" : dti <= 0.36 ? "warning" : "danger", score: dti === null ? null : linearScore(Number.isFinite(dti) ? dti : 1, 0.5, 0), detail: { payments } });
  const interestShare = income > 0 ? h.monthlyInterest / income : null;
  push({ id: "interestCost", area: "debt", value: { kind: "money", value: h.monthlyInterest }, tone: h.monthlyInterest <= 0 ? "success" : interestShare !== null && interestShare <= 0.05 ? "warning" : "danger", score: null, detail: { share: interestShare } });
  let debtFree: number | null = 0;
  let never = false;
  for (const d of input.debts) {
    const p = debtPayoff(d, input.now);
    if (p.kind === "date") debtFree = Math.max(debtFree ?? 0, p.months);
    else if (p.kind === "never" || p.kind === "unknown") never = true;
  }
  const open = input.debts.some((d) => d.balance > 0);
  push({
    id: "debtFree",
    area: "debt",
    value: !open ? { kind: "months", value: 0 } : never ? { kind: "none" } : { kind: "months", value: debtFree ?? 0 },
    tone: !open ? "success" : never ? "danger" : (debtFree ?? 0) <= 24 ? "success" : (debtFree ?? 0) <= 60 ? "warning" : "danger",
    score: null,
    detail: { open: open ? 1 : 0, never: never ? 1 : 0 },
  });

  // Growth and independence.
  const fi = h.fiProgress;
  push({ id: "fi", area: "growth", value: fi === null ? { kind: "none" } : { kind: "percent", value: fi }, tone: fi === null ? "neutral" : fi >= 1 ? "success" : fi >= 0.25 ? "warning" : "neutral", score: fi === null ? null : linearScore(fi, 0, 1), detail: { fiNumber: h.fiNumber, years: h.yearsToFi } });
  const pc = h.passiveCoverage;
  push({ id: "passive", area: "growth", value: pc === null ? { kind: "none" } : { kind: "percent", value: pc }, tone: pc === null ? "neutral" : pc >= 1 ? "success" : pc >= 0.25 ? "warning" : "neutral", score: null });
  const hist = [...input.netWorthHistory].sort((a, b) => (a.monthKey < b.monthKey ? -1 : 1));
  const last = hist[hist.length - 1];
  const sixAgo = hist.length >= 2 ? hist[Math.max(0, hist.length - 7)] : null;
  const trend = last && sixAgo && sixAgo !== last && Math.abs(sixAgo.value) > 0 ? (last.value - sixAgo.value) / Math.abs(sixAgo.value) : null;
  push({
    id: "trend",
    area: "growth",
    value: trend === null ? { kind: "none" } : { kind: "signedPercent", value: trend },
    tone: trend === null ? "neutral" : trend > 0.01 ? "success" : trend >= -0.01 ? "warning" : "danger",
    score: trend === null ? null : linearScore(trend, -0.1, 0.1),
    detail: { months: last && sixAgo ? hist.indexOf(last) - hist.indexOf(sixAgo) : 0 },
  });
  const targeted = input.plans.filter((p) => p.targetAmount > 0);
  const onTrack = targeted.filter((p) => p.status.tone === "success").length;
  push({
    id: "goals",
    area: "growth",
    value: targeted.length ? { kind: "ratio", done: onTrack, total: targeted.length } : { kind: "none" },
    tone: !targeted.length ? "neutral" : onTrack === targeted.length ? "success" : onTrack / targeted.length >= 0.5 ? "warning" : "danger",
    score: targeted.length ? Math.round((onTrack / targeted.length) * 100) : null,
  });

  // Diversification.
  const cats = assetTotalsByCategory([...input.settingsAssets], input.legacyAssets);
  const top = cats[0];
  push({
    id: "concentration",
    area: "spread",
    value: top ? { kind: "percent", value: top.share } : { kind: "none" },
    tone: !top ? "neutral" : top.share <= 0.5 ? "success" : top.share <= 0.75 ? "warning" : "danger",
    score: top && cats.length ? linearScore(top.share, 1, 0.4) : null,
    detail: { category: top?.category ?? null, categories: cats.length },
  });
  const gross = s.grossAssets;
  const hedged = input.settingsAssets.reduce((sum, a) => sum + (a.holding ? Math.max(0, a.currentValue) : 0), 0);
  push({ id: "hedge", area: "spread", value: gross > 0 ? { kind: "percent", value: hedged / gross } : { kind: "none" }, tone: "neutral", score: null, detail: { hedged } });

  // Overall.
  let weighted = 0;
  let weights = 0;
  for (const m of metrics) {
    const w = HEALTH_WEIGHTS[m.id];
    if (!w || m.score === null) continue;
    weighted += m.score * w;
    weights += w;
  }
  // Need at least half the weight before calling it a score.
  const score = weights >= 50 ? Math.round(weighted / weights) : null;
  const areaScores = Object.fromEntries(
    (["safety", "cashflow", "debt", "growth", "spread"] as HealthArea[]).map((area) => {
      const scored = metrics.filter((m) => m.area === area && m.score !== null && HEALTH_WEIGHTS[m.id]);
      const w = scored.reduce((sum, m) => sum + HEALTH_WEIGHTS[m.id]!, 0);
      return [area, w ? Math.round(scored.reduce((sum, m) => sum + m.score! * HEALTH_WEIGHTS[m.id]!, 0) / w) : null];
    }),
  ) as Record<HealthArea, number | null>;
  const focus = metrics
    .filter((m) => m.score !== null && m.score < 70 && HEALTH_WEIGHTS[m.id])
    .sort((a, b) => a.score! - b.score! || HEALTH_WEIGHTS[b.id]! - HEALTH_WEIGHTS[a.id]!)
    .slice(0, 3)
    .map((m) => m.id);
  return { score, grade: score === null ? null : gradeOf(score), metrics, areaScores, focus };
}
