export {
  buildAllocationReport,
  buildAllocationReportForTables,
  filterAllocationRowsByBand,
  liquidityBandForSourceKey,
  normalizeProfilesForAllocationReport,
  PHANTOM_ALLOCATION_DRAFT,
  type AllocationPlanColumn,
  type AllocationReport,
  type AllocationSourceRow,
  type LiquidityBand,
} from "@/entities/portfolio/lib/allocation-report";
export { liquidityBandLabel, liquidityBandTone } from "@/entities/portfolio/lib/liquidity-band";
export { computeNetWorth, personalLoanBalances, totalCombinedAssetValue } from "@/entities/portfolio/lib/net-worth";
export {
  computeDashboardSummary,
  summarizeCashflow,
  type CashflowInput,
  type CashflowSummary,
  type DashboardSummary,
} from "@/entities/portfolio/lib/summary";
export { assetTotalsByCategory, type CategoryTotal } from "@/entities/portfolio/lib/by-category";
export {
  computeFinancialHealth,
  FI_MULTIPLE,
  instantAccessAssets,
  type FinancialHealth,
} from "@/entities/portfolio/lib/health";
export { legacyHoldingsCount, migrateLegacyHoldings, type LegacyMigration } from "@/entities/portfolio/lib/legacy-migration";
export { buildInsights, INSIGHT_RULES, type Insight, type InsightCode, type InsightSeverity } from "@/entities/portfolio/lib/insights";
export { computeSetupProgress, SETUP_STEPS, type SetupProgress, type SetupStepId } from "@/entities/portfolio/lib/setup-progress";
export {
  computeHealthReport,
  gradeOf,
  HEALTH_WEIGHTS,
  linearScore,
  monthlyDebtPayments,
  type HealthArea,
  type HealthGrade,
  type HealthMetric,
  type HealthMetricId,
  type HealthReport,
  type HealthValue,
} from "@/entities/portfolio/lib/health-report";
