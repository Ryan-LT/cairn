import { requiredMonthly } from "@/shared/lib/growth";
import type { StatusTone } from "@/shared/lib/tone";

import { computeGoalProjection } from "./projection";

export const GOAL_STATUS_CODES = ["no_target", "achieved", "on_track", "close", "behind", "no_savings", "past_due", "no_date"] as const;
export type GoalStatusCode = (typeof GOAL_STATUS_CODES)[number];

export type GoalStatus = {
  code: GoalStatusCode;
  tone: StatusTone;
  /** Money set aside ÷ target (0–1+). */
  progress: number;
  /** Projected balance at the target date (starting money only when monthly savings are off). */
  projectedAtTarget: number;
  /** Target − projected, when short; else 0. */
  gap: number;
  /** Monthly saving that reaches the target on time (with the plan's growth); `null` without a date. */
  requiredMonthly: number | null;
  /** What the plan gets each month now (its share of the monthly net). */
  monthlyContribution: number;
  /** Extra per month needed on top of the current contribution; 0 when on track. */
  extraNeeded: number;
  monthsLeft: number;
};

const TONE: Record<GoalStatusCode, StatusTone> = {
  no_target: "neutral",
  achieved: "success",
  on_track: "success",
  close: "warning",
  behind: "danger",
  no_savings: "warning",
  past_due: "danger",
  no_date: "info",
};

/** Within this share of the required monthly saving, a plan is "close" rather than "behind". */
export const CLOSE_RATIO = 0.9;

/**
 * One status for a goal plan, used everywhere it appears (plan list, plan
 * page, overview). Built on the same projection as the chart, so the badge
 * and the numbers never disagree.
 */
export function resolveGoalStatus(input: {
  startingBalance: number;
  targetAmount: number;
  targetDateIso: string;
  includeMonthlyIncome?: boolean;
  householdMonthlyNet: number;
  /** This plan's fraction of the monthly net. */
  monthlyShare: number;
  expectedReturnPct?: number;
  now?: Date;
}): GoalStatus {
  const target = Math.max(0, input.targetAmount);
  const start = Math.max(0, input.startingBalance);
  const projection = computeGoalProjection({
    startingBalance: start,
    targetAmount: target,
    targetDateIso: input.targetDateIso,
    includeMonthlyIncome: input.includeMonthlyIncome,
    incomeMonthly: Math.max(0, input.householdMonthlyNet),
    householdMonthlyNet: input.householdMonthlyNet,
    monthlyShare: input.monthlyShare,
    expectedReturnPct: input.expectedReturnPct,
    now: input.now,
  });
  const contribution = Math.max(0, projection.effectiveMonthlyContribution);
  const progress = target > 0 ? start / target : 0;
  const required = input.targetDateIso && !projection.pastDue ? requiredMonthly(start, target, projection.monthsToTarget, projection.annualReturn) : null;
  const gap = Math.max(0, target - projection.projectedAtTarget);

  let code: GoalStatusCode;
  if (target <= 0) code = "no_target";
  else if (start >= target) code = "achieved";
  else if (!input.targetDateIso) code = "no_date";
  else if (projection.pastDue) code = "past_due";
  else if (projection.projectedAtTarget >= target) code = "on_track";
  else if (contribution <= 0) code = "no_savings";
  else if (required !== null && contribution >= required * CLOSE_RATIO) code = "close";
  else code = "behind";

  return {
    code,
    tone: TONE[code],
    progress,
    projectedAtTarget: projection.projectedAtTarget,
    gap: code === "achieved" || code === "on_track" ? 0 : gap,
    requiredMonthly: required,
    monthlyContribution: contribution,
    extraNeeded: required !== null && code !== "achieved" && code !== "on_track" ? Math.max(0, required - contribution) : 0,
    monthsLeft: projection.monthsToTarget,
  };
}
