import { activeMessages } from "@/shared/i18n/active";
import { goalProfileForDashboard, type GoalsState } from "@/entities/goal/model";
import { resolveMonthlyShares } from "@/entities/goal/lib/monthly-share";
import { totalGoalStartingBalance } from "@/entities/goal/lib/seed-lines";
import type { GoalStartingOption } from "@/entities/goal/lib/starting-options";
import { resolveGoalStatus, type GoalStatus } from "@/entities/goal/lib/status";

export type GoalPlanSummary = {
  key: string;
  /** Saved plan id; undefined for the legacy primary goal fallback. */
  planId?: string;
  name: string;
  targetAmount: number;
  saved: number;
  savedCaption: "Allocated starting" | "Saved";
  targetDate: string;
  includeMonthlyIncome: boolean;
  /** Fraction (0–1) of the household monthly net this plan receives. */
  monthlyShare: number;
  /** Expected yearly return in percent. */
  expectedReturnPct: number;
};

/**
 * One summary per saved plan for the dashboard. With no saved plans, falls back to
 * the legacy `goals.primary` document.
 */
export function buildGoalPlanSummaries(
  goals: GoalsState,
  seedOptions: GoalStartingOption[],
  netWorth: number,
): GoalPlanSummary[] {
  if (goals.profiles.length > 0) {
    const shares = resolveMonthlyShares(goals.profiles);
    return goals.profiles.map((plan) => ({
      key: plan.id,
      planId: plan.id,
      name: plan.name.trim() || activeMessages().domain.fallbacks.untitledPlan,
      targetAmount: plan.targetAmount,
      saved: totalGoalStartingBalance(plan.seedLines, seedOptions, goals.profiles, plan),
      savedCaption: "Allocated starting",
      targetDate: plan.targetDate,
      includeMonthlyIncome: plan.includeMonthlyIncome !== false,
      monthlyShare: shares.byPlan.get(plan.id) ?? 0,
      expectedReturnPct: plan.expectedReturnPct ?? 0,
    }));
  }

  const primaryProfile = goalProfileForDashboard(goals);
  const target = primaryProfile?.targetAmount ?? goals.primary.targetAmount;
  const name =
    primaryProfile?.name?.trim() || goals.primary.name?.trim() || activeMessages().domain.fallbacks.primaryGoal;
  const saved =
    goals.primary.saved > 0
      ? Math.min(goals.primary.saved, target)
      : Math.min(Math.max(0, netWorth), target);

  return [
    {
      key: "legacy-primary",
      name,
      targetAmount: target,
      saved,
      savedCaption: "Saved",
      targetDate: primaryProfile?.targetDate ?? "",
      includeMonthlyIncome: primaryProfile?.includeMonthlyIncome !== false,
      monthlyShare: 1,
      expectedReturnPct: 0,
    },
  ];
}

/** Rounded progress percent (unclamped; callers clamp progress bars). */
export function goalProgressPercent(saved: number, targetAmount: number): number {
  return targetAmount === 0 ? 0 : Math.round((saved / targetAmount) * 100);
}

export type GoalPlanWithStatus = GoalPlanSummary & { status: GoalStatus };

/** Saved plans with their status (each plan only counts its own share of the monthly net). */
export function buildGoalPlanStatuses(
  goals: GoalsState,
  seedOptions: GoalStartingOption[],
  householdMonthlyNet: number,
  now: Date = new Date(),
): GoalPlanWithStatus[] {
  if (goals.profiles.length === 0) return [];
  return buildGoalPlanSummaries(goals, seedOptions, 0).map((s) => ({
    ...s,
    status: resolveGoalStatus({
      startingBalance: s.saved,
      targetAmount: s.targetAmount,
      targetDateIso: s.targetDate,
      includeMonthlyIncome: s.includeMonthlyIncome,
      householdMonthlyNet,
      monthlyShare: s.monthlyShare,
      expectedReturnPct: s.expectedReturnPct,
      now,
    }),
  }));
}
