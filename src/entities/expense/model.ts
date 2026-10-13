/**
 * Money out ("Tiền ra"): the household's recurring bills and flexible budgets,
 * plus a month-by-month log of what was actually paid or spent.
 *
 * Items live in the `expenses` table and change rarely; check-offs live in
 * `expenseLog` and change often. Keeping them apart means ticking a bill on
 * one device can't overwrite a bill just added on another (each table is
 * saved as a whole document).
 */

export const EXPENSE_CATEGORY_IDS = [
  "housing",
  "utilities",
  "food",
  "transport",
  "debt",
  "insurance",
  "health",
  "education",
  "family",
  "giving",
  "subscriptions",
  "shopping",
  "leisure",
  "other",
] as const;
export type ExpenseCategoryId = (typeof EXPENSE_CATEGORY_IDS)[number];

export const EXPENSE_FREQUENCIES = ["weekly", "monthly", "quarterly", "semiannual", "yearly"] as const;
export type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number];

/** `bill`: a fixed amount on a due day, ticked off when paid. `budget`: a flexible envelope (food, fuel) you spend from. */
export const EXPENSE_KINDS = ["bill", "budget"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export type ExpenseItem = {
  id: string;
  name: string;
  category: ExpenseCategoryId;
  kind: ExpenseKind;
  /** ₫ per occurrence (per week / month / quarter / half-year / year). Ignored while linked to a debt with a monthly payment. */
  amount: number;
  /**
   * Charged in US dollars: USD per occurrence. `amount` then follows today's
   * rate (see `useExpenses`) and keeps the VND at the last save.
   */
  amountUsd?: number;
  frequency: ExpenseFrequency;
  /** Day of month 1–31 (clamped to the month's length). Unset: any time in the month. */
  dueDay?: number;
  /** Month 1–12 the cycle is anchored to (quarterly, half-yearly, yearly). */
  dueMonth?: number;
  /** ISO weekday 1 (Mon) – 7 (Sun), weekly items only. */
  dueWeekday?: number;
  /** Linked debt: its `monthlyPayment` is the amount and its payment day the default due day. */
  debtId?: string;
  /** Paid automatically (direct debit): recorded at the planned amount on each due date. */
  autopay?: boolean;
  /**
   * Account (asset) its payments or spending come out of by default.
   * Autopay bills are taken from it on the due date; others when ticked off.
   */
  accountId?: string;
  /** `YYYY-MM-DD` from which autopay payments are recorded in the ledger (earlier months stay as they were). */
  autoSince?: string;
  /** Need (true) or want (false); unset follows the category. */
  essential?: boolean;
  note?: string;
  /** Not counted: left out of every month's plan (recorded months still show it). */
  paused?: boolean;
  /** `YYYY-MM-DD` the item was added; earlier occurrences are never "overdue". */
  createdAt: string;
  /** `YYYY-MM-DD` it was removed; kept so past months still show it. */
  archivedAt?: string;
};

export type ExpensesDoc = {
  items: ExpenseItem[];
  /**
   * Set when the old single "average spending" estimate is retired: from then
   * on only itemized amounts count. Kept here (not in preferences) so a stale
   * preferences save from another device can't bring the estimate back.
   */
  legacyEstimate?: { retiredAt: string; amount: number };
};

export type BillPayment = {
  amount: number;
  date: string;
  /** The ledger entry behind it (payments recorded since the ledger). */
  txnId?: string;
  /** Recorded by autopay. */
  auto?: boolean;
};

export type ExpenseMonthEntry = {
  /** Bills: each recorded payment (one per occurrence). */
  payments?: BillPayment[];
  /** Budgets: running total spent this month. */
  spent?: number;
  /** Bill not due / not paid this month on purpose. */
  skipped?: boolean;
  /** Planned amount when first recorded, so past months keep their plan if the item changes later. */
  planned?: number;
};

export type ExpenseLogDoc = {
  /** `YYYY-MM` → item id → entry. Postgres jsonb reorders keys: always sort before iterating. */
  months: Record<string, Record<string, ExpenseMonthEntry>>;
  /**
   * Derived, never stored: spending outside the plan per `YYYY-MM` (from the
   * ledger), so month totals include it.
   */
  unplanned?: Record<string, number>;
};

export const EXPENSES_SEED: ExpensesDoc = { items: [] };
export const EXPENSE_LOG_SEED: ExpenseLogDoc = { months: {} };
