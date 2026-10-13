import type { AssetsState } from "@/entities/asset";
import type { Debt } from "@/entities/debt";
import type { ExpenseLogDoc, ExpensesDoc } from "@/entities/expense";
import type { GoalProfile, GoalsState } from "@/entities/goal";
import type { IncomeSource } from "@/entities/income";
import type { PersonalLoan } from "@/entities/personal-loan";
import type { Preferences } from "@/entities/preferences";
import type { SettingsAsset } from "@/entities/settings-asset";

/** Legacy "portfolio detail" document (no editor UI; still read for net worth). */
export const fixtureAssets: AssetsState = {
  realEstate: [
    {
      id: "re1",
      name: "Apartment",
      address: "D2",
      icon: "home",
      estValue: 3_000_000_000,
      badge: { kind: "growth", label: "Growth" },
    },
  ],
  cashAccounts: [
    {
      id: "c1",
      category: "Savings",
      details: "VCB savings",
      icon: "savings",
      yieldPct: 4.5,
      balance: 200_000_000,
    },
    {
      id: "c2",
      category: "Checking",
      details: "  ",
      icon: "wallet",
      yieldPct: 0,
      balance: 50_000_000,
    },
  ],
  investments: [
    {
      id: "i1",
      name: "VN30 ETF",
      icon: "trending_up",
      details: "",
      badge: { kind: "growth", label: "Growth" },
      rateLabel: "",
      rateValue: "",
      rateIncomeNote: "",
      valueLabel: "",
      value: 400_000_000,
    },
  ],
};

export const fixtureCatalog: SettingsAsset[] = [
  { id: "a1", name: "Emergency fund", category: "Cash", currentValue: 300_000_000, liquidity: "instant" },
  { id: "a2", name: "Gold bars", category: "Precious Metals", currentValue: 150_000_000, liquidity: "not_instant" },
  // Older save: no liquidity → treated as instant.
  { id: "a3", name: "Brokerage", category: "Stocks & ETFs", currentValue: 500_000_000 },
  // Negative values are clamped to 0 in totals.
  { id: "a4", name: "Broken row", category: "Other", currentValue: -10 },
];

export const fixtureDebts: Debt[] = [
  { id: "d1", name: "Car loan", balance: 250_000_000, ratePct: 9.5, rateKind: "Fixed", paymentDayOfMonth: 15, nextPayment: "" },
  { id: "d2", name: "Credit card", balance: 20_000_000, ratePct: 24, rateKind: "Variable", nextPayment: "Pay in full" },
];

export const fixtureIncome: IncomeSource[] = [
  { id: "inc1", kind: "active", name: "Salary", details: "Acme", icon: "work", monthly: 60_000_000, paymentDay: 5, paymentEntity: "Acme Co" },
  {
    id: "inc2",
    kind: "passive",
    name: "Deposit interest",
    details: "",
    icon: "savings",
    monthly: 1_500_000,
    capitalLines: [{ id: "cl1", sourceKey: "catalog:a1", amount: 100_000_000 }],
  },
];

export const fixturePrefs: Preferences = {
  netMonthIncome: 0,
  monthInflow: 0,
  monthOutflow: 0,
  averageMonthlySpending: 25_000_000,
};

export const planHouse: GoalProfile = {
  id: "goal-1",
  name: "House",
  targetAmount: 2_000_000_000,
  targetDate: "2028-06-30",
  monthlyContribution: 61_500_000,
  includeMonthlyIncome: true,
  seedLines: [
    { id: "s1", sourceKey: "catalog:a1", amount: 250_000_000 },
    { id: "s2", sourceKey: "catalog:a3", amount: 500_000_000 },
    { id: "s3", sourceKey: "custom", amount: 10_000_000 },
  ],
  checkpoints: [
    { id: "cp1", date: "2026-12-01", amount: 100_000_000, paid: true },
    { id: "cp2", date: "2027-06-01", amount: 200_000_000 },
  ],
};

export const planCar: GoalProfile = {
  id: "goal-2",
  name: "  ",
  targetAmount: 800_000_000,
  targetDate: "2027-01-15",
  monthlyContribution: 0,
  includeMonthlyIncome: false,
  seedLines: [{ id: "s4", sourceKey: "catalog:a1", amount: 200_000_000 }],
};

/** Legacy single-seed plan (pre-seedLines save). */
export const planLegacy: GoalProfile = {
  id: "goal-3",
  name: "Legacy",
  targetAmount: 100_000_000,
  targetDate: "",
  monthlyContribution: 0,
  seedSourceKey: "cash:c1",
  seedAmount: 0,
};

export const fixtureGoals: GoalsState = {
  primary: { name: "Old primary", targetAmount: 1_000_000_000, saved: 0 },
  profiles: [planHouse, planCar],
  activeProfileId: "goal-1",
};

export const fixtureLoans: PersonalLoan[] = [
  { id: "loan-1-a", person: "Minh", amount: 5_000_000, direction: "lent_out", date: "2026-03-01", status: "open" },
  { id: "loan-2-b", person: "An", amount: 2_000_000, direction: "borrowed", date: "2026-04-10", status: "open", note: "Lunch" },
  { id: "loan-3-c", person: "Binh", amount: 1_000_000, direction: "lent_out", status: "settled" },
];

/** Bills and budgets: 23,2tr/month live (7tr of it the car-loan payment linked to d1). */
export const fixtureExpenses: ExpensesDoc = {
  items: [
    { id: "e1", name: "Electricity", category: "utilities", kind: "bill", amount: 1_200_000, frequency: "monthly", dueDay: 15, createdAt: "2026-01-01" },
    { id: "e2", name: "Rent", category: "housing", kind: "bill", amount: 8_000_000, frequency: "monthly", dueDay: 5, autopay: true, createdAt: "2026-01-01" },
    { id: "e3", name: "Groceries", category: "food", kind: "budget", amount: 6_000_000, frequency: "monthly", createdAt: "2026-01-01" },
    { id: "e4", name: "Insurance", category: "insurance", kind: "bill", amount: 12_000_000, frequency: "yearly", dueMonth: 3, dueDay: 10, createdAt: "2026-01-01" },
    { id: "e5", name: "Car loan", category: "debt", kind: "bill", amount: 7_000_000, frequency: "monthly", debtId: "d1", createdAt: "2026-01-01" },
    { id: "e6", name: "Streaming", category: "subscriptions", kind: "bill", amount: 260_000, frequency: "monthly", paused: true, createdAt: "2026-01-01" },
    { id: "e7", name: "Gym", category: "health", kind: "bill", amount: 700_000, frequency: "monthly", dueDay: 1, archivedAt: "2026-05-01", createdAt: "2026-01-01" },
  ],
};

export const fixtureExpenseLog: ExpenseLogDoc = {
  months: {
    "2026-09": {
      e1: { payments: [{ amount: 1_450_000, date: "2026-09-14" }], planned: 1_200_000 },
      e3: { spent: 6_500_000, planned: 6_000_000 },
      e5: { payments: [{ amount: 7_000_000, date: "2026-09-15" }] },
    },
    "2026-10": {
      e1: { payments: [{ amount: 1_300_000, date: "2026-10-12" }] },
      e3: { spent: 2_000_000 },
    },
  },
};
