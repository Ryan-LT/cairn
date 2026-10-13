import type { ExpenseCategoryId, ExpenseFrequency, ExpenseKind } from "../model";

export type ExpenseTemplate = {
  id: string;
  category: ExpenseCategoryId;
  kind: ExpenseKind;
  frequency: ExpenseFrequency;
  dueDay?: number;
  dueMonth?: number;
  /** Typical amount, shown as a placeholder only (never saved unless typed). */
  typical: number;
  /** Paid through a debt (credit card, instalment loan): the form offers the debt link. */
  linksDebt?: boolean;
};

/** One-tap starters for common Vietnamese household costs. Names: `t.expenses.templates[id]`. */
export const EXPENSE_TEMPLATES = [
  { id: "rent", category: "housing", kind: "bill", frequency: "monthly", dueDay: 5, typical: 8_000_000 },
  { id: "buildingFee", category: "housing", kind: "bill", frequency: "monthly", dueDay: 10, typical: 1_000_000 },
  { id: "mortgage", category: "debt", kind: "bill", frequency: "monthly", dueDay: 15, typical: 15_000_000, linksDebt: true },
  { id: "creditCard", category: "debt", kind: "bill", frequency: "monthly", dueDay: 20, typical: 10_000_000, linksDebt: true },
  { id: "electricity", category: "utilities", kind: "bill", frequency: "monthly", dueDay: 15, typical: 1_200_000 },
  { id: "water", category: "utilities", kind: "bill", frequency: "monthly", dueDay: 15, typical: 200_000 },
  { id: "internet", category: "utilities", kind: "bill", frequency: "monthly", dueDay: 10, typical: 250_000 },
  { id: "phone", category: "utilities", kind: "bill", frequency: "monthly", dueDay: 10, typical: 200_000 },
  { id: "parking", category: "transport", kind: "bill", frequency: "monthly", dueDay: 5, typical: 300_000 },
  { id: "parents", category: "family", kind: "bill", frequency: "monthly", dueDay: 5, typical: 5_000_000 },
  { id: "tuition", category: "education", kind: "bill", frequency: "semiannual", dueMonth: 9, dueDay: 5, typical: 30_000_000 },
  { id: "healthInsurance", category: "insurance", kind: "bill", frequency: "yearly", typical: 10_000_000 },
  { id: "carInsurance", category: "insurance", kind: "bill", frequency: "yearly", typical: 6_000_000 },
  { id: "streaming", category: "subscriptions", kind: "bill", frequency: "monthly", typical: 260_000 },
  { id: "groceries", category: "food", kind: "budget", frequency: "monthly", typical: 6_000_000 },
  { id: "eatingOut", category: "food", kind: "budget", frequency: "monthly", typical: 3_000_000 },
  { id: "fuel", category: "transport", kind: "budget", frequency: "monthly", typical: 1_500_000 },
  { id: "shopping", category: "shopping", kind: "budget", frequency: "monthly", typical: 2_000_000 },
  { id: "gifts", category: "giving", kind: "budget", frequency: "monthly", typical: 1_000_000 },
  { id: "tet", category: "giving", kind: "budget", frequency: "yearly", dueMonth: 1, typical: 20_000_000 },
  { id: "travel", category: "leisure", kind: "budget", frequency: "yearly", dueMonth: 6, typical: 30_000_000 },
  { id: "gym", category: "health", kind: "bill", frequency: "monthly", dueDay: 1, typical: 700_000 },
] as const satisfies readonly ExpenseTemplate[];

export type ExpenseTemplateId = (typeof EXPENSE_TEMPLATES)[number]["id"];
