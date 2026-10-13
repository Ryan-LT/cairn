/** Messages for the dashboard area. */
export const dashboard = {
  title: "Dashboard",
  description: "Your financial position at a glance.",
  milestone: {
    title: (p: { target: string; age: number }) => `${p.target} by ${p.age}`,
    /** `ordinal` is the English ordinal of `age` (e.g. `35th`). */
    description: (p: { age: number; ordinal: string }) => `Net worth target by your ${p.ordinal} birthday.`,
    deadline: (p: { date: string }) => `Deadline ${p.date}`,
    deadlineWithGrowth: (p: { date: string; rate: string }) =>
      `Deadline ${p.date} · assumes ${p.rate} yearly growth after inflation`,
    loadError: "Couldn't load milestone settings",
    finishSetup: "Finish setup to track this milestone",
    openSettings: "Open settings",
    editGoal: "Edit goal",
    vsTarget: (p: { detail: string }) => `${p.detail} vs target`,
    target: "Target",
    projectedAt: (p: { age: number }) => `Projected at ${p.age}`,
    timeLeft: "Time left",
  },
  health: {
    title: "Financial health",
    description: "Quick checks from your assets, debts, income and spending.",
    needSpending: "Set your average spending to see this.",
    months: (p: { value: string; count: number }) => `${p.value} ${p.count === 1 ? "month" : "months"}`,
    emergency: {
      label: "Emergency fund",
      healthy: "Healthy",
      okay: "Okay",
      low: "Low",
      /** Follows the instant-access amount. */
      explain: "of instant-access money covers this long without income. 3–6 months is the usual advice.",
    },
    fi: {
      label: "Financial independence",
      reached: "Reached",
      /** Wraps the FI number: `Of <amount> (25× yearly spending).` */
      ofPrefix: "Of",
      ofSuffix: "(25× yearly spending).",
      reachedExplain: "Your net worth could cover spending at a 4 % yearly withdrawal.",
      unreachable: "Not reachable at the current monthly savings.",
      years: (p: { years: string; growth?: string }) =>
        `About ${p.years} years at the current savings${p.growth ? ` and ${p.growth} real growth` : ""}.`,
    },
    passive: {
      label: "Passive income covers",
      explain: "Share of your monthly spending paid by passive income (interest, rent).",
    },
    debt: {
      label: "Debt to assets",
      low: "Low",
      moderate: "Moderate",
      high: "High",
      explain: "What you owe as a share of what you own. Under 30 % is comfortable.",
    },
    liquid: {
      label: "Liquid assets",
      explain: "Share of your assets you can use right away (cash and instant-access).",
    },
    interest: {
      label: "Interest cost",
      explain: "Interest your debts add each month (balance × rate ÷ 12).",
      none: "No interest-bearing debt.",
    },
  },
  trend: {
    title: "Net worth trend",
    lastMonths: (p: { count: number }) => `Last ${p.count} months`,
    since: "since",
    thisMonth: "this month",
    empty: "Tracking started this month — the trend fills in as months pass.",
    chartLabel: (p: { count: number; value: string }) => `Net worth over the last ${p.count} months, now ${p.value}`,
    today: "(today)",
    netWorth: "Net worth",
    month: "Month",
    change: "Change",
  },
};
