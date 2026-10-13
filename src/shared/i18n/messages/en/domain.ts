/** Text produced by domain logic (goal verdicts, milestone hints, liquidity, starting sources). */
export const domain = {

  milestone: {
    verdict: { on_track: "On track", tight: "Tight but possible", below: "Below projection" },
    targetMet: "Target met",
    pastMilestone: "Past milestone",
    hintBirthDate: (p: { age: number }) => `Add your date of birth in Settings to set your age-${p.age} deadline.`,
    hintFxRate: "Couldn't get the USD exchange rate right now. It will try again later.",
    hintAchieved: (p: { detail: string; target: string }) => `Already ${p.detail} above the ${p.target} target.`,
    hintPastDeadline: (p: { age: number }) => `Age ${p.age} deadline passed.`,
    hintOnTrack: (p: { projected: string; age: number; pct: string; money: string; target: string; targetVnd: string }) =>
      `Projected ${p.projected} at age ${p.age} — ${p.pct} (${p.money}) above the ${p.target} goal (≈ ${p.targetVnd}).`,
    hintTight: (p: { projected: string; pct: string; money: string }) =>
      `Projected ${p.projected} — ${p.pct} (${p.money}) above target with very little runway left.`,
    hintBelow: (p: { projected: string; gap: string; pct: string }) =>
      `Trajectory lands near ${p.projected} — about ${p.gap} (${p.pct}) below target.`,
  },
  projectionNote: {
    incomplete: "Add target, date, and starting sources.",
    pastDue: (p: { gap: string }) => `The target date has passed — still short ~${p.gap}. Move the date or the target.`,
    noShare: "This plan gets 0 % of your monthly savings — give it a share or lower the other plans' shares.",
    noIncome: "No monthly income recorded — only starting allocations count.",
    nonPositiveNet: "Monthly net is zero or negative after spending — increase income or lower average spending.",
    incomeOffShort: (p: { flatAt: string; gap: string }) => `Income off for this plan — reaches ${p.flatAt}; short ~${p.gap}.`,
    ahead: (p: { surplus: string }) => `Ahead by ~${p.surplus}.`,
    onTarget: "On target.",
    short: (p: { gap: string }) => `Short ~${p.gap} vs target.`,
  },
  liquidity: {
    instant: "Instant",
    notInstant: "Not instant",
    bandInstant: "Instant access",
    bandNotInstant: "Not instant",
    bandCustom: "Custom model",
  },
  startingOptions: {
    customLine: "Custom amount",
    none: "No starting balance (0 ₫)",
    realEstate: (p: { name: string }) => `Real estate — ${p.name}`,
    cash: (p: { name: string }) => `Cash — ${p.name}`,
    cashFallback: "Cash account",
    investment: (p: { name: string }) => `Investment — ${p.name}`,
    custom: "Custom starting balance…",
  },
  fallbacks: {
    untitledPlan: "Untitled plan",
    thisPlan: "This plan",
    primaryGoal: "Primary Goal",
    incomeSource: "Income source",
    debt: "Debt",
    someone: "Someone",
    uncategorized: "Uncategorized",
  },
  /** Built-in asset categories (stored in English; shown translated). */
  categories: {
    Cash: "Cash",
    "Real Estate": "Real Estate",
    "Open-Ended Funds": "Open-Ended Funds",
    Car: "Car",
    Other: "Other",
    Loan: "Loan",
    "Stocks & ETFs": "Stocks & ETFs",
    Bonds: "Bonds",
    Crypto: "Crypto",
    "Precious Metals": "Precious Metals",
    Business: "Business",
    // Legacy holdings groups on the dashboard breakdown.
    Investments: "Investments",
  } as Record<string, string>,
};
