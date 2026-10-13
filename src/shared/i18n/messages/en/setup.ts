/** First-run setup guide on the overview. */
export const setup = {
  title: "Set up Cairn",
  description: (p: { done: number; total: number }) => `${p.done} of ${p.total} done: a few minutes to a full picture of your money.`,
  dismiss: "Hide guide",
  steps: {
    income: { label: "Add your income", hint: "Salary, side income, interest" },
    bills: { label: "List your bills and spending", hint: "Rent, power and water, food…" },
    assets: { label: "Add what you own", hint: "Savings, gold, shares, property" },
    debts: { label: "Add your debts", hint: "Mortgage, car loan, credit card" },
    goal: { label: "Set your first goal", hint: "A home, a trip, the kids' education" },
  },
  noDebts: "I have no debts",
  start: "Start",
};
