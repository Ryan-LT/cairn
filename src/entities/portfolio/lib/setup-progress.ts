import type { AssetsState } from "@/entities/asset";
import type { Debt } from "@/entities/debt";
import { liveItems, type ExpensesDoc } from "@/entities/expense";
import type { GoalsState } from "@/entities/goal";
import type { IncomeSource } from "@/entities/income";
import type { Preferences } from "@/entities/preferences";
import type { SettingsAsset } from "@/entities/settings-asset";

import { legacyHoldingsCount } from "./legacy-migration";

export const SETUP_STEPS = ["income", "bills", "assets", "debts", "goal"] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number];

export type SetupProgress = {
  steps: { id: SetupStepId; done: boolean; href: string }[];
  done: number;
  total: number;
  /** Show the guide: not dismissed and something left to do. */
  visible: boolean;
  next: SetupStepId | null;
};

const HREF: Record<SetupStepId, string> = {
  income: "/cashflow/income?new=1",
  bills: "/cashflow/spending",
  assets: "/wealth?new=1",
  debts: "/wealth/debts?new=1",
  goal: "/goals?new=1",
};

/** First-run checklist, derived from what's been entered (nothing to keep in sync). */
export function computeSetupProgress(input: {
  incomeSources: IncomeSource[];
  expenses: ExpensesDoc;
  settingsAssets: SettingsAsset[];
  legacyAssets: AssetsState;
  debts: Debt[];
  goals: GoalsState;
  setup: Preferences["setup"];
}): SetupProgress {
  const done: Record<SetupStepId, boolean> = {
    income: input.incomeSources.length > 0,
    bills: liveItems(input.expenses.items).length > 0,
    assets: input.settingsAssets.length > 0 || legacyHoldingsCount(input.legacyAssets) > 0,
    debts: input.debts.length > 0 || input.setup?.noDebts === true,
    goal: input.goals.profiles.length > 0,
  };
  const steps = SETUP_STEPS.map((id) => ({ id, done: done[id], href: HREF[id] }));
  const count = steps.filter((s) => s.done).length;
  return {
    steps,
    done: count,
    total: steps.length,
    visible: !input.setup?.dismissedAt && count < steps.length,
    next: steps.find((s) => !s.done)?.id ?? null,
  };
}
