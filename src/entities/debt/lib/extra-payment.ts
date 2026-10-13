import type { Debt } from "@/entities/debt/model";

import { debtPayoff } from "./debt";

export type ExtraPaymentImpact = {
  /** Months sooner the debt is paid off. */
  monthsSaved: number;
  /** Interest avoided over the life of the debt. */
  interestSaved: number;
};

/**
 * What paying `extra` more each month would do. `null` when the current
 * payment never clears the debt (any extra that does is "infinitely" better)
 * or there's no payment to compare with.
 */
export function extraPaymentImpact(debt: Debt, extra: number, now: Date = new Date()): ExtraPaymentImpact | null {
  const base = debtPayoff(debt, now);
  if (base.kind !== "date" || !(extra > 0)) return null;
  const faster = debtPayoff({ ...debt, monthlyPayment: (debt.monthlyPayment ?? 0) + extra }, now);
  if (faster.kind !== "date") return null;
  return {
    monthsSaved: Math.max(0, Math.round(base.months - faster.months)),
    interestSaved: Math.max(0, base.totalInterest - faster.totalInterest),
  };
}

/** The debt to pay down first: highest interest rate among those with a balance ("avalanche"). */
export function avalancheTarget(debts: readonly Debt[]): Debt | undefined {
  return [...debts].filter((d) => d.balance > 0 && d.ratePct > 0).sort((a, b) => b.ratePct - a.ratePct || b.balance - a.balance)[0];
}

/** A round extra amount worth suggesting: ~10 % of the payment, at least 500k, in 500k steps. */
export function suggestedExtraPayment(debt: Debt): number {
  const base = Math.max(500_000, (debt.monthlyPayment ?? 0) * 0.1);
  return Math.ceil(base / 500_000) * 500_000;
}
