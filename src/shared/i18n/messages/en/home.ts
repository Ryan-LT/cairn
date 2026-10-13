/** Overview (home) screen. */
export const home = {
  greeting: {
    morning: (p: { name: string }) => `Good morning, ${p.name}`,
    afternoon: (p: { name: string }) => `Good afternoon, ${p.name}`,
    evening: (p: { name: string }) => `Good evening, ${p.name}`,
  },
  netWorth: "Net worth",
  thisMonthChange: "this month",
  trendLabel: (p: { change: string; months: number }) => `Net worth changed ${p.change} over ${p.months} months`,
  assets: "Assets",
  debts: "Debts",
  month: {
    title: "This month",
    income: "Money in",
    spent: "Paid so far",
    planned: "Planned out",
    left: "Left at month end",
    open: "Open cash flow",
  },
  due: {
    title: "Bills to pay",
    empty: "No bills due in the next week.",
    viewAll: "All bills",
  },
  goals: {
    title: "Goals",
    empty: "No goal plans yet.",
    create: "Create a plan",
    viewAll: "All goals",
  },
  health: {
    title: "Financial health",
    emergency: "Safety net",
    debtRatio: "Debt / assets",
    savingsRate: "Savings rate",
    fi: "Financial independence",
    months: (p: { value: string }) => `${p.value} mo`,
  },
};
