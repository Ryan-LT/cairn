import type { HelpPage, HelpTopic } from "@/shared/config/help";

type HelpCopy = { title: string; body: string; tip?: string };

/** Contextual help: the "?" hints, "explain this screen" and the page tours. */
export const help = {
  ui: {
    open: "Help",
    menuTitle: "Help on this screen",
    explain: "Explain this screen",
    explainHint: "Marks every block; tap one to see what it means",
    tour: "Take the tour",
    tourHint: "A step-by-step walk through this page",
    shortcut: "Tip: press ? anytime to turn explanations on or off.",
    banner: "Tap any block, or its ?, to see what it means.",
    nothingHere: "Nothing to explain on this screen yet.",
    exit: "Done",
    whatIs: (p: { name: string }) => `What is “${p.name}”?`,
    markerLabel: (p: { name: string }) => `Explain “${p.name}”`,
    prevBlock: "Previous",
    nextBlock: "Next",
    step: (p: { n: number; total: number }) => `Step ${p.n} of ${p.total}`,
    back: "Back",
    next: "Next",
    finish: "Finish",
    skip: "Close the tour",
    keys: "Use ← and → to move, Esc to close.",
    finished: "That's the tour! Press ? or use the help button anytime to see the explanations again.",
  },
  pages: {
    home: { title: "Your overview", body: "Where your money stands today, what needs doing this week, and what's worth a look. Here's what each part tells you." },
    month: { title: "This month", body: "Follow the month as it happens: tick off bills, add budget spending, record income, and see what's left at the end." },
    spending: { title: "Spending", body: "Your recurring bills and flexible budgets: the plan every month is measured against." },
    income: { title: "Income", body: "Where your money comes from each month, and which account it lands in." },
    history: { title: "History", body: "Every expense and income actually recorded, month by month, with totals to compare." },
    assets: { title: "Assets", body: "What you own, what it's worth today, and how much of it you could use right away." },
    debts: { title: "Debts", body: "What you owe, what it costs you each month, and the quickest way to be debt-free." },
    loans: { title: "Loans", body: "Money you lent to or borrowed from people, so nothing gets forgotten." },
    plans: { title: "Goal plans", body: "Plan big goals with money set aside now, a monthly saving and a date, and see whether you'll get there." },
    funding: { title: "Funding", body: "How your assets and monthly savings are shared between your plans, and what's still free." },
    settings: { title: "Settings", body: "Display currency and rates, your milestone, how totals are worked out, and your data." },
    activity: { title: "Change log", body: "Every change saved to your account, so you can always see what changed and when." },
  } satisfies Record<HelpPage, { title: string; body: string }>,
  topics: {
    setupGuide: {
      title: "Getting set up",
      body: "A few steps for a complete picture: income, bills, assets, debts and a first goal. Each step ticks itself once the data is there.",
      tip: "Close it anytime; everything stays reachable from the menu.",
    },
    netWorth: {
      title: "Net worth",
      body: "Everything you own minus everything you owe. Assets are at today's value: accounts follow the income and spending recorded since you last updated them, and dollar or gold holdings use today's rates. The bar shows how much of it you could use right away.",
      tip: "Money lent to or borrowed from people only counts if you turn it on in Settings → Calculation.",
    },
    monthGlance: {
      title: "This month at a glance",
      body: "Money in is your monthly income. Paid so far adds up bills paid (autopay included), budget spending and unplanned spending. Planned out is the bills due this month plus your budgets. Left at month end is money in minus everything paid and still to pay.",
      tip: "The ring shows how much of this month's plan is already paid.",
    },
    dueBills: {
      title: "Bills to pay",
      body: "Overdue bills, bills that need confirming, and bills due in the next 7 days. Tick one to record the payment; it's taken from the bill's account. When nothing is due soon, bills later in the month show here instead.",
    },
    insights: {
      title: "Worth a look",
      body: "Things your data says deserve attention, most urgent first: overdue bills, costly debt, budgets running over, goals falling behind, a thin safety net, or good news like a strong savings rate.",
      tip: "Tap an insight to go where you can act on it.",
    },
    goalsGlance: {
      title: "Goals",
      body: "Each plan's progress is the money already set aside for it compared with its target. The badge compares where the plan is headed by its date with the target: on track, close, behind or past due.",
      tip: "Tap a goal to open its plan.",
    },
    healthScore: {
      title: "Financial health",
      body: "A score out of 100 from 17 measures in five areas: safety, cash flow, debt, growth and spread. The tiles show four of them: months your instant money covers, debt compared with assets, the share of income you keep, and progress toward financial independence.",
      tip: "Open “View all” for every measure, how it's worked out, and what to improve first.",
    },
    netWorthTrend: {
      title: "Net worth trend",
      body: "Your net worth at the end of each month, recorded automatically, with today as the last point. Switch to the table for exact amounts and month-on-month changes.",
    },
    milestone: {
      title: "Milestone",
      body: "A long-term target in US dollars, converted at today's rate, by the birthday you chose. The projection grows your current net worth with your monthly savings at a modest real return (after inflation), and the badge says whether that gets you there.",
      tip: "Change the target, age or birth date in Settings → Milestone.",
    },
    cashIn: {
      title: "Money in",
      body: "Your total monthly income from every income source, both what you work for and what your money earns.",
    },
    cashOut: {
      title: "Money out",
      body: "Your monthly spending: every bill and budget turned into a per-month amount (weekly × 52 ÷ 12, quarterly ÷ 3, yearly ÷ 12). A bill linked to a debt uses that debt's monthly payment.",
    },
    cashLeft: {
      title: "Left each month",
      body: "Money in minus money out: what you can save or put toward goals each month. The line below is your savings rate, the share of income left over.",
      tip: "Aim to keep at least 20% of what comes in.",
    },
    monthProgress: {
      title: "The month so far",
      body: "How much of this month's plan is settled: bills paid (autopay included), budget spending and unplanned spending. Still to pay is the unpaid bills plus what's left in your budgets. End of month is income minus all of it.",
    },
    monthCalendar: {
      title: "Month calendar",
      body: "Each day of the month. Dots are bills due that day, coloured by status, and the banknote marks a payday.",
    },
    monthNeedsConfirm: {
      title: "Needs confirming",
      body: "Bills whose due date this month came before you added them, so the app can't know whether they were paid. Mark each one paid or skipped.",
    },
    monthBudgets: {
      title: "Budgets",
      body: "Flexible amounts like food or fuel. Add spending as it happens; a budget is flagged when it runs ahead of the month, more than 115% of what you'd expect to have spent by today.",
    },
    monthIncome: {
      title: "Income this month",
      body: "Each income source shows as received, due or waiting. When it arrives, tap “Received” to record it into its account. Sources set to arrive automatically are recorded on their payday.",
    },
    monthUnplanned: {
      title: "Unplanned spending",
      body: "Spending outside your bills and budgets, recorded with “Spend now” and taken from the account you picked. It counts toward the month's spending.",
    },
    spendingTotal: {
      title: "Monthly spending",
      body: "All your bills and budgets as one monthly amount, split into bills, budgets and a per-day figure. The bar compares needs and wants with your income, and what's left is your savings.",
      tip: "A common guide is 50% needs, 30% wants and 20% savings.",
    },
    spendingByCategory: {
      title: "By category",
      body: "Where your monthly spending goes, biggest categories first, as a share of everything you've itemized.",
    },
    planVsActual: {
      title: "Plan vs actual",
      body: "The last six months: what you planned against what you actually paid and spent. Averages only use finished months where most items were recorded. Within 3% counts as on plan, and bills that ran 10% or more off are listed.",
      tip: "A bill that's always higher than planned? Update its amount so next month's plan is right.",
    },
    incomeActive: {
      title: "Active income",
      body: "Income you work for, such as salary or freelance work: how much arrives each month, on which day, and into which account.",
    },
    incomePassive: {
      title: "Passive income",
      body: "Income your money earns, such as interest, rent or dividends. The yield is the yearly income divided by the capital set aside to earn it.",
    },
    historyThisMonth: {
      title: "This month",
      body: "The total recorded so far this month, from actual entries rather than the plan.",
    },
    historyAverage: {
      title: "Monthly average",
      body: "The average of up to six recent finished months that have entries, a realistic baseline for what a month costs (or brings in).",
    },
    historyTop: {
      title: "Biggest category",
      body: "The category (or income source) with the largest total over those months and this one.",
    },
    wealthAssets: {
      title: "Assets",
      body: "Everything you own at today's value: accounts, savings, investments, property, gold and more.",
    },
    wealthDebts: {
      title: "Debts",
      body: "What you still owe on loans and credit cards.",
    },
    wealthNetWorth: {
      title: "Net worth",
      body: "Assets minus debts. The line below shows debts as a share of assets; under 30% is comfortable.",
    },
    assetInstant: {
      title: "Instant access",
      body: "Money you could use right away: cash accounts and assets marked “Instant”. This is what your safety net is measured from.",
    },
    assetNotInstant: {
      title: "Not instant",
      body: "Everything that takes time to turn into cash: property, investments and assets marked “Not instant”.",
    },
    assetsByCategory: {
      title: "By category",
      body: "Your assets grouped by category, biggest first, so you can see how spread out they are.",
    },
    debtAvgRate: {
      title: "Average rate",
      body: "Your interest rates averaged by balance, so bigger debts count for more.",
    },
    debtInterest: {
      title: "Monthly interest",
      body: "Interest building up each month: each balance × its yearly rate ÷ 12, added together.",
    },
    debtMonthly: {
      title: "Monthly payments",
      body: "What all your debts with a balance cost you each month.",
    },
    debtPriority: {
      title: "Pay this first",
      body: "Paying extra on the highest-rate debt first saves the most interest. This shows that debt, and how much interest and time a small extra payment each month would save.",
    },
    debtList: {
      title: "All debts",
      body: "Each debt's balance, rate and monthly payment. Link a debt to a bill and its payment shows up in your monthly spending.",
    },
    loansOwedToYou: {
      title: "Owed to you",
      body: "Money you lent people that hasn't been repaid yet.",
    },
    loansYouOwe: {
      title: "You owe",
      body: "Money you borrowed from people that you haven't repaid yet.",
    },
    loansNet: {
      title: "Net",
      body: "What people owe you minus what you owe them.",
      tip: "Turn on Settings → Calculation to count loans in your net worth.",
    },
    loanLog: {
      title: "Loan log",
      body: "Every personal loan with who, how much and when. Mark one settled once it's repaid.",
    },
    planList: {
      title: "Your plans",
      body: "Every goal plan with its progress and status. Pick one to see and edit it.",
    },
    planHero: {
      title: "Set aside",
      body: "Money already set aside for this goal compared with its target, and a sentence on where the plan is headed.",
    },
    planProjected: {
      title: "Projected at the date",
      body: "What this plan should have by its date: the money set aside now plus its monthly saving, grown at the plan's expected return.",
    },
    planMonthly: {
      title: "Monthly saving",
      body: "This plan's share of what you have left each month (income minus spending). Shares you set are used as set; the rest is split evenly between plans that use monthly income.",
    },
    planTimeLeft: {
      title: "Time left",
      body: "How long until the plan's target date.",
    },
    projection: {
      title: "Projection",
      body: "The plan month by month: the balance it's heading for, the target line, and any payments due (checkpoints) added up over time. Where the balance line is above the target, the plan works.",
    },
    startingBalances: {
      title: "Starting balance",
      body: "Money already set aside, taken from your tracked assets or entered by hand. A source can be shared between plans, never beyond its value. An “All in” source always counts everything still free in it and follows its value.",
      tip: "If a source loses value, every plan's share of it shrinks in proportion.",
    },
    checkpoints: {
      title: "Payments on dates",
      body: "Amounts due on set dates, such as instalments or a deposit. The chart adds them up, so you can see the plan stays ahead of what's due.",
    },
    fundingInstant: {
      title: "Instant money still free",
      body: "Instant-access money not yet set aside for any plan.",
    },
    fundingNotInstant: {
      title: "Other assets still free",
      body: "Property, investments and other not-instant assets not yet set aside for any plan.",
    },
    fundingCustom: {
      title: "Custom amounts",
      body: "Starting money entered by hand on plans, not taken from a tracked asset.",
    },
    fundingPlans: {
      title: "Monthly shares",
      body: "Each plan's share of what you have left each month, and what that is in money.",
    },
    fundingMatrix: {
      title: "Sources and plans",
      body: "For each source: how much every plan has set aside from it, the total, its value today, and what's still free.",
    },
    settingsCurrency: {
      title: "Currency and rates",
      body: "Show amounts in đồng or dollars. The dollar rate comes from Vietcombank and gold prices from PNJ (or your own), and they value any dollar or gold holdings.",
    },
    settingsMilestone: {
      title: "Milestone",
      body: "Your birth date, the target in dollars and the age to reach it, used by the milestone on your overview.",
    },
    settingsCalculation: {
      title: "Calculation",
      body: "Choose whether money lent to or borrowed from people counts in your net worth.",
    },
    settingsData: {
      title: "Your data",
      body: "Back up everything to a file, restore from one, or export your spending as CSV.",
    },
    activityLog: {
      title: "Change log",
      body: "Every change saved to your account, newest first: what changed, when, and the value before and after. Expenses and income themselves are in History.",
    },
  } satisfies Record<HelpTopic, HelpCopy> as Record<HelpTopic, HelpCopy>,
};
