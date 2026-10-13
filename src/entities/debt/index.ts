export { DEBTS_SEED, type Debt } from "@/entities/debt/model";
export { totalDebtBalance } from "@/entities/debt/lib/totals";
export {
  createDebtDraft,
  debtPayoff,
  isValidDayOfMonth,
  monthlyInterest,
  sanitizeDebt,
  totalMonthlyInterest,
  weightedAverageRate,
  type DebtPayoff,
} from "@/entities/debt/lib/debt";
export { avalancheTarget, extraPaymentImpact, suggestedExtraPayment, type ExtraPaymentImpact } from "@/entities/debt/lib/extra-payment";
