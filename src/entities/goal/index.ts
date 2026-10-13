export {
  EMPTY_GOAL_PROFILE,
  GOALS_SEED,
  GOAL_PLAN_NEW_SENTINEL,
  goalProfileForDashboard,
  type GoalCheckpoint,
  type GoalProfile,
  type GoalSeedLine,
  type GoalsState,
} from "@/entities/goal/model";
export {
  buildGoalStartingOptions,
  type GoalStartingOption,
} from "@/entities/goal/lib/starting-options";
export {
  appendGoalSeedLine,
  clampSeedLinesToAllocationPool,
  dedupeNonCustomSeedLines,
  effectiveGoalSeedLineAmount,
  ensureKeyedSeedDefaults,
  goalUsageForSourceKey,
  allInPlanElsewhere,
  isAllInHolder,
  labelForSeedLine,
  liveBalanceForSourceKey,
  maxAllocationForSourceKey,
  migrateLegacySeedsToLines,
  reservedAmountForSeedLine,
  sanitizeSeedLinesAgainstOptions,
  totalGoalStartingBalance,
  addableSeedOptions,
  seedLineAllocationView,
  setSeedLineAllIn,
  sourceAvailability,
  type SeedLineAllocationView,
  type SourceAvailability,
  type SourceGoalUsage,
} from "@/entities/goal/lib/seed-lines";
export {
  checkpointsWithRunningTotal,
  createCheckpointId,
  cumulativeDueScheduleFromCheckpoints,
  normalizeStoredCheckpoints,
  setCheckpointPaid,
} from "@/entities/goal/lib/checkpoints";
export {
  normalizeGoalProfile,
  removeGoalPlan,
  resolvePlanEditorProfile,
  revertPlanSection,
  upsertGoalPlan,
  type PlanSection,
  type UpsertGoalPlanContext,
} from "@/entities/goal/lib/plan-editor";
export {
  computeGoalProjection,
  describeGoalProjectionNote,
  evaluateStartingOnlyStatus,
  goalProjectionNoteTone,
  isTargetDatePast,
  monthsUntilTarget,
  type GoalProjectionInput,
  type GoalProjectionNote,
  type GoalProjectionStatus,
  type GoalProjectionSummary,
  type StartingOnlyStatus,
} from "@/entities/goal/lib/projection";
export {
  monthlyShareForDraft,
  profilesWithDraft,
  resolveMonthlyShares,
  type MonthlyShares,
} from "@/entities/goal/lib/monthly-share";
export {
  buildAxisColumnDates,
  buildProjectionChartModel,
  computeProjectedMeetTarget,
  cumulativeDueAtOrBefore,
  paidCheckpointDots,
  type PaidCheckpointDot,
  type ProjectedMeetTarget,
  type ProjectionChartInput,
  type ProjectionChartModel,
  type ProjectionChartRow,
} from "@/entities/goal/lib/projection-chart";
export {
  buildGoalPlanStatuses,
  buildGoalPlanSummaries,
  goalProgressPercent,
  type GoalPlanSummary,
  type GoalPlanWithStatus,
} from "@/entities/goal/lib/plan-summaries";
export { CLOSE_RATIO, GOAL_STATUS_CODES, resolveGoalStatus, type GoalStatus, type GoalStatusCode } from "@/entities/goal/lib/status";
