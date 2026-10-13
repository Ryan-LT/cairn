"use client";

import { useCallback, useMemo } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import {
  buildGoalStartingOptions,
  GOAL_PLAN_NEW_SENTINEL,
  GOALS_SEED,
  normalizeGoalProfile,
  removeGoalPlan,
  resolvePlanEditorProfile,
  upsertGoalPlan,
  type GoalProfile,
} from "@/entities/goal";
import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import { useSettingsAssets } from "@/entities/settings-asset";
import { flushTablesNow, useTable } from "@/shared/storage";

/**
 * All Goal Plan state and mutations. `goals.activeProfileId` stays the single
 * source of truth for which plan is open (the dashboard relies on it too).
 */
export function useGoalPlanEditor() {
  const [goals, setGoals] = useTable("goals", GOALS_SEED);
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [settingsAssets] = useSettingsAssets();
  const cashflow = useHouseholdCashflow();

  const seedOptions = useMemo(() => buildGoalStartingOptions(assets, settingsAssets), [assets, settingsAssets]);
  const seedKeys = useMemo(() => new Set(seedOptions.map((o) => o.key)), [seedOptions]);
  const incomeMonthly = cashflow.totalIncome;
  const householdMonthlyNet = cashflow.monthlyNet;

  const savedProfile = useMemo(
    () => normalizeGoalProfile(resolvePlanEditorProfile(goals), seedKeys, seedOptions, goals.profiles),
    [goals, seedKeys, seedOptions],
  );
  const isComposingNew = savedProfile.id === "";

  const selectPlan = useCallback(
    (id: string) => setGoals((prev) => (prev.activeProfileId === id ? prev : { ...prev, activeProfileId: id })),
    [setGoals],
  );
  const startNewPlan = useCallback(
    () => setGoals((prev) => ({ ...prev, activeProfileId: GOAL_PLAN_NEW_SENTINEL })),
    [setGoals],
  );
  const deletePlan = useCallback((id: string) => setGoals((prev) => removeGoalPlan(prev, id)), [setGoals]);

  /** Save a draft (insert or replace), make it active, and wait for the server write. */
  const persistPlan = useCallback(
    async (draft: GoalProfile): Promise<boolean> => {
      setGoals((prev) => upsertGoalPlan(prev, draft, { seedKeys, seedOptions, incomeMonthly }));
      return flushTablesNow();
    },
    [setGoals, seedKeys, seedOptions, incomeMonthly],
  );

  return {
    goals,
    seedOptions,
    incomeMonthly,
    householdMonthlyNet,
    savedProfile,
    isComposingNew,
    selectPlan,
    startNewPlan,
    deletePlan,
    persistPlan,
  };
}

export type GoalPlanEditor = ReturnType<typeof useGoalPlanEditor>;
