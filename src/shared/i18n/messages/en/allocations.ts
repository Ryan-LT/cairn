/** Messages for the allocations area. */
export const allocations = {
  kpi: {
    instantPool: { label: "Ready cash not set aside", hint: "Instant-access money no plan is using yet" },
    notInstantPool: { label: "Other assets not set aside", hint: "Property, investments, locked money" },
    custom: { label: "Typed-in amounts", hint: "Set aside for plans without pointing at an asset" },
  },
  plans: {
    title: "Money set aside for each plan",
    description: "Tap a plan to change where its money comes from.",
    emptyTitle: "No saved goal plans yet",
    emptyDescription: "Save a plan to see how it reserves your assets.",
    goToGoals: "Go to goals",
    sharePerMonth: (p: { pct: string; amount: string }) => `${p.pct} of monthly savings · ${p.amount} / month`,
    noMonthly: "Not adding from monthly savings",
  },
  matrix: {
    title: "Where each asset is set aside",
    description: "What each plan reserves from each source, and what is still uncommitted.",
    filterLabel: "Liquidity filter",
    filter: { both: "All", instant: "Instant", not_instant: "Not instant" },
    emptyTitle: "Nothing to show yet",
    emptyDescription: "No sources with balances or reservations.",
    noMatch: "No sources match this liquidity filter",
    colSource: "Source",
    colIncomeCapital: "Income capital",
    incomeCapitalHint: "Sum of capital allocated to this asset across all income sources (a separate pool).",
    colReserved: "Reserved",
    colLive: "Live",
    colPool: "Pool left",
  },
};
