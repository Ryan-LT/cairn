/** Navigation: the four sections (+ settings), their tabs, and quick-add actions. */
export const nav = {
  hubs: {
    home: { label: "Overview", short: "Home", description: "Where your money stands today" },
    cashflow: { label: "Cash flow", short: "Cash flow", description: "Money in, money out and this month's bills" },
    wealth: { label: "Net worth", short: "Net worth", description: "Assets, debts and money lent or borrowed" },
    goals: { label: "Goals", short: "Goals", description: "Savings plans and the money set aside for each" },
    settings: { label: "Settings", short: "Settings", description: "Account, appearance and your data" },
  },
  tabs: {
    cashflowMonth: { label: "This month", description: "Bills to pay, budgets and what's left this month" },
    cashflowSpending: { label: "Spending", description: "Every bill and budget, by category" },
    cashflowIncome: { label: "Income", description: "Salary, side income and passive income" },
    wealthAssets: { label: "Assets", description: "Everything you own and how fast you can use it" },
    wealthDebts: { label: "Debts", description: "Loans and cards, payoff dates and interest" },
    wealthLoans: { label: "Personal loans", description: "Money lent to or borrowed from people you know" },
    goalsPlans: { label: "Plans", description: "Each goal, its progress and whether it's on track" },
    goalsFunding: { label: "Funding", description: "Which money is set aside for which plan" },
  },
  quickAdd: {
    record: { label: "Record a payment", short: "Pay", keywords: "pay bill paid spent spending log record" },
    bill: { label: "Add a bill or budget", short: "Bill", keywords: "create new bill budget expense spending money out" },
    income: { label: "Add income", short: "Income", keywords: "create new income salary money in" },
    asset: { label: "Add asset", short: "Asset", keywords: "create new asset" },
    debt: { label: "Add debt", short: "Debt", keywords: "create new debt loan liability card" },
    loan: { label: "Log a personal loan", short: "Loan", keywords: "create new lend borrow" },
    plan: { label: "New goal plan", short: "Goal", keywords: "create new goal plan saving" },
  },
};
