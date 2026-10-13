import { activeMessages } from "@/shared/i18n/active";
import type { Debt } from "@/entities/debt/model";

export function createDebtDraft(now: number = Date.now()): Debt {
  return {
    id: `debt-${now}`,
    name: "",
    balance: 0,
    ratePct: 0,
    rateKind: "Fixed",
    nextPayment: "",
  };
}

export function isValidDayOfMonth(day: number | null | undefined): day is number {
  return day != null && day >= 1 && day <= 31;
}

/** Persisted shape: name fallback, balance ≥ 0, rate 0–100, day 1–31 or omitted. */
export function sanitizeDebt(draft: Debt): Debt {
  const day = draft.paymentDayOfMonth;
  return {
    ...draft,
    name: draft.name.trim() || activeMessages().domain.fallbacks.debt,
    balance: Math.max(0, draft.balance),
    ratePct: Math.min(100, Math.max(0, draft.ratePct)),
    rateKind: draft.rateKind,
    paymentDayOfMonth: isValidDayOfMonth(day) ? Math.floor(day) : undefined,
    nextPayment: draft.nextPayment.trim(),
    monthlyPayment:
      typeof draft.monthlyPayment === "number" && Number.isFinite(draft.monthlyPayment) && draft.monthlyPayment > 0
        ? draft.monthlyPayment
        : undefined,
  };
}

/** Balance-weighted average interest rate (percent). */
export function weightedAverageRate(debts: Debt[]): number {
  const total = debts.reduce((s, d) => s + Math.max(0, d.balance), 0);
  if (total <= 0) return 0;
  return debts.reduce((s, d) => s + Math.max(0, d.balance) * d.ratePct, 0) / total;
}

/** Interest accruing this month on one debt (balance × yearly rate ÷ 12). */
export function monthlyInterest(debt: Pick<Debt, "balance" | "ratePct">): number {
  return (Math.max(0, debt.balance) * Math.max(0, debt.ratePct)) / 100 / 12;
}

/** Interest accruing per month across all debts. */
export function totalMonthlyInterest(debts: Debt[]): number {
  return debts.reduce((s, d) => s + monthlyInterest(d), 0);
}

export type DebtPayoff =
  /** No monthly payment entered. */
  | { kind: "unknown" }
  | { kind: "paid_off" }
  /** The payment doesn't even cover the interest. */
  | { kind: "never"; monthlyInterest: number }
  | { kind: "date"; months: number; date: Date; totalInterest: number };

/**
 * Amortization with a fixed monthly payment and monthly compounding:
 * n = −ln(1 − r·B / P) / ln(1 + r), total interest = P·n − B.
 */
export function debtPayoff(debt: Debt, now: Date = new Date()): DebtPayoff {
  const balance = Math.max(0, debt.balance);
  if (balance === 0) return { kind: "paid_off" };
  const payment = debt.monthlyPayment ?? 0;
  if (!(payment > 0)) return { kind: "unknown" };
  const r = Math.max(0, debt.ratePct) / 100 / 12;
  let months: number;
  if (r === 0) {
    months = balance / payment;
  } else {
    if (payment <= balance * r) return { kind: "never", monthlyInterest: balance * r };
    months = -Math.log(1 - (r * balance) / payment) / Math.log(1 + r);
  }
  const whole = Math.ceil(months - 1e-9);
  const date = new Date(now.getFullYear(), now.getMonth() + whole, 1);
  return { kind: "date", months, date, totalInterest: Math.max(0, payment * months - balance) };
}
