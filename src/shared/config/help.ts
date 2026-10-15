/**
 * Contextual help: every block that can explain itself has a topic here, with
 * its words in `t.help.topics[topic]` (both languages). Mark the block with
 * `data-help={topic}` (Section, StatCard and SummaryStrip take a `help` prop
 * that does it and adds the "?" beside the title).
 */
export const HELP_TOPICS = [
  // Overview
  "setupGuide",
  "netWorth",
  "monthGlance",
  "dueBills",
  "insights",
  "goalsGlance",
  "healthScore",
  "netWorthTrend",
  "milestone",
  // Cash flow (above every tab)
  "cashIn",
  "cashOut",
  "cashLeft",
  // Cash flow · this month
  "monthProgress",
  "monthCalendar",
  "monthNeedsConfirm",
  "monthBudgets",
  "monthIncome",
  "monthUnplanned",
  // Cash flow · spending
  "spendingTotal",
  "spendingByCategory",
  "planVsActual",
  // Cash flow · income
  "incomeActive",
  "incomePassive",
  // Cash flow · history
  "historyThisMonth",
  "historyAverage",
  "historyTop",
  // Wealth (above every tab)
  "wealthAssets",
  "wealthDebts",
  "wealthNetWorth",
  // Wealth · assets
  "assetInstant",
  "assetNotInstant",
  "assetsByCategory",
  // Wealth · debts
  "debtAvgRate",
  "debtInterest",
  "debtMonthly",
  "debtPriority",
  "debtList",
  // Wealth · loans
  "loansOwedToYou",
  "loansYouOwe",
  "loansNet",
  "loanLog",
  // Goals
  "planList",
  "planHero",
  "planProjected",
  "planMonthly",
  "planTimeLeft",
  "projection",
  "startingBalances",
  "checkpoints",
  // Goals · funding
  "fundingInstant",
  "fundingNotInstant",
  "fundingCustom",
  "fundingPlans",
  "fundingMatrix",
  // Settings
  "settingsCurrency",
  "settingsMilestone",
  "settingsCalculation",
  "settingsData",
  "activityLog",
  "connectWebhook",
  "connectShares",
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
  "/settings/connect": "connect",
} as const;

export type HelpPage = (typeof HELP_PAGES)[keyof typeof HELP_PAGES];

export function helpPageOf(pathname: string): HelpPage | null {
  return (HELP_PAGES as Record<string, HelpPage>)[pathname] ?? null;
}
