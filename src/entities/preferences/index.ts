export {
  PREFERENCES_SEED,
  type AllocationsBandFilter,
  type AllocationsMatrixColumnSort,
  type NetWorthMonthSnapshot,
  type Preferences,
} from "@/entities/preferences/model";
export {
  applyAverageMonthlySpending,
  buildNetWorthTrend,
  estimatedMonthlyNetCashflow,
  netWorthTrackingUnchanged,
  fractionalMonthsUntilYearEnd,
  legacySpendingEstimate,
  monthCalendarKey,
  monthToDateNetWorthChangePercent,
  projectNetWorthEndOfYear,
  registerExtraAssetCategory,
  syncNetWorthTracking,
} from "@/entities/preferences/lib/finance";
export type { NetWorthTrendPoint } from "@/entities/preferences/lib/finance";
export {
  ALLOCATIONS_BAND_FILTERS,
  isAllocationsBandFilter,
  resolveAllocationsBandFilter,
} from "@/entities/preferences/lib/allocations-prefs";
