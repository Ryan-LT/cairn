/**
 * Contextual help: every block that can explain itself has a topic here, with
 * its words in `t.help.topics[topic]` (both languages). Mark the block with
 * `data-help={topic}` (Section, StatCard and SummaryStrip take a `help` prop
 * that does it and adds the "?" beside the title).
 */
export const HELP_TOPICS = [
  // Overview
  "netWorth",
  "monthGlance",
  "dueBills",
  "insights",
  "goalsGlance",
  "healthScore",
  "netWorthTrend",
  "milestone",
  "setupGuide",
  // Cash flow · this month
  "monthIn",
  "monthOut",
  "monthLeft",
  "monthBills",
  "monthBudgets",
  "monthIncome",
  "monthUnplanned",
  // Cash flow · spending
  "spendingMix",
  "spendingList",
  "spendingByCategory",
  "planVsActual",
  "legacyEstimate",
  // Cash flow · income
  "incomeTotals",
  "incomeList",
  // Cash flow · history
  "historyTotals",
  "historyList",
  // Wealth
  "wealthNetWorth",
  "wealthAssets",
  "wealthDebts",
  "assetInstant",
  "assetNotInstant",
  "assetsByCategory",
  "assetList",
  "debtAvgRate",
  "debtInterest",
  "debtFreeDate",
  "debtList",
  "loansLent",
  "loansOwed",
  "loansNet",
  "loanList",
  // Goals
  "planList",
  "planSaved",
  "planMonthly",
  "planStatus",
  "planDetails",
  "startingBalances",
  "checkpoints",
  "projection",
  "fundingPools",
  "fundingMatrix",
  // Settings
  "settingsCurrency",
  "settingsMilestone",
  "settingsCalculation",
  "settingsData",
  "activityLog",
] as const;

export type HelpTopic = (typeof HELP_TOPICS)[number];

const TOPIC_SET = new Set<string>(HELP_TOPICS);

export function isHelpTopic(value: string): value is HelpTopic {
  return TOPIC_SET.has(value);
}

/** Pages with an introduction at the start of their tour (`t.help.pages`). */
export const HELP_PAGES = {
  "/": "home",
  "/cashflow": "month",
  "/cashflow/spending": "spending",
  "/cashflow/income": "income",
  "/cashflow/history": "history",
  "/wealth": "assets",
  "/wealth/debts": "debts",
  "/wealth/loans": "loans",
  "/goals": "plans",
  "/goals/funding": "funding",
  "/settings": "settings",
  "/settings/activity": "activity",
} as const;

export type HelpPage = (typeof HELP_PAGES)[keyof typeof HELP_PAGES];

export function helpPageOf(pathname: string): HelpPage | null {
  return (HELP_PAGES as Record<string, HelpPage>)[pathname] ?? null;
}
