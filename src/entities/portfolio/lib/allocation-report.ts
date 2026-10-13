import { activeMessages } from "@/shared/i18n/active";
import type { AssetsState } from "@/entities/asset";
import {
  buildGoalStartingOptions,
  EMPTY_GOAL_PROFILE,
  liveBalanceForSourceKey,
  maxAllocationForSourceKey,
  isAllInHolder,
  migrateLegacySeedsToLines,
  reservedAmountForSeedLine,
  sanitizeSeedLinesAgainstOptions,
  totalGoalStartingBalance,
  type GoalProfile,
  type GoalsState,
  type GoalStartingOption,
} from "@/entities/goal";
import type { IncomeSource } from "@/entities/income";
import type { AllocationsBandFilter } from "@/entities/preferences";
import {
  resolveSettingsAssetLiquidity,
  type SettingsAsset,
} from "@/entities/settings-asset";

/** Draft used only to compute shared pools (id must not match any saved plan). */
export const PHANTOM_ALLOCATION_DRAFT: GoalProfile = {
  ...EMPTY_GOAL_PROFILE,
  id: "__phantom_allocations__",
  name: "",
};

export type LiquidityBand = "instant" | "not_instant" | "custom";

export function liquidityBandForSourceKey(
  sourceKey: string,
  catalog: SettingsAsset[],
): LiquidityBand {
  if (sourceKey === "custom") return "custom";
  if (sourceKey === "none") return "instant";
  if (sourceKey.startsWith("cash:")) return "instant";
  if (sourceKey.startsWith("re:") || sourceKey.startsWith("inv:")) return "not_instant";
  if (sourceKey.startsWith("catalog:")) {
    const id = sourceKey.slice("catalog:".length);
    const row = catalog.find((a) => a.id === id);
    return resolveSettingsAssetLiquidity(row?.liquidity) === "instant"
      ? "instant"
      : "not_instant";
  }
  return "not_instant";
}

export type AllocationPlanColumn = {
  id: string;
  name: string;
  usesMonthlyIncome: boolean;
  /** Sum of effective (capped) starting lines for this plan. */
  effectiveStartingTotal: number;
};

export type AllocationSourceRow = {
  sourceKey: string;
  label: string;
  band: LiquidityBand;
  liveBalance: number;
  /** Raw amounts saved on plans (may exceed live until Goal Plan clamps). */
  totalReservedStored: number;
  /** How much more keyed capacity exists before hitting live minus others’ claims. */
  remainingPool: number;
  perPlanStored: Record<string, number>;
  /** The plan taking everything left in this source, if any. */
  allInPlanId?: string;
  /**
   * Sum of capital reserved against this source across all income sources
   * (collapsed column — capital reservations live in their own pool and do
   * not reduce the goal `remainingPool`).
   */
  totalIncomeCapital: number;
};

export type AllocationReport = {
  plans: AllocationPlanColumn[];
  sources: AllocationSourceRow[];
  /** Sum of all income-source capital reservations across keyed sources. */
  totalIncomeCapital: number;
  totals: {
    instantRemainingPool: number;
    notInstantRemainingPool: number;
    customReservedStored: number;
  };
};

/** What `plan` holds from `sourceKey` (an all-in plan: what it takes now). */
function storedForPlan(plan: GoalProfile, sourceKey: string, seedOptions: GoalStartingOption[], saved: GoalProfile[]): number {
  return (plan.seedLines ?? [])
    .filter((l) => l.sourceKey === sourceKey)
    .reduce((s, l) => s + reservedAmountForSeedLine(l, seedOptions, saved, plan), 0);
}

function labelForKey(sourceKey: string, seedOptions: GoalStartingOption[]): string {
  return seedOptions.find((o) => o.key === sourceKey)?.label ?? sourceKey;
}

function storedForIncome(source: IncomeSource, sourceKey: string): number {
  return (source.capitalLines ?? [])
    .filter((l) => l.sourceKey === sourceKey)
    .reduce((s, l) => s + Math.max(0, l.amount), 0);
}

export function normalizeProfilesForAllocationReport(
  profiles: GoalProfile[],
  seedKeys: Set<string>,
): GoalProfile[] {
  return profiles
    .filter((p) => p.id)
    .map((p) => ({
      ...p,
      seedLines: sanitizeSeedLinesAgainstOptions(
        migrateLegacySeedsToLines(p),
        seedKeys,
      ),
    }));
}

export function buildAllocationReport(
  profiles: GoalProfile[],
  seedOptions: GoalStartingOption[],
  catalog: SettingsAsset[],
  incomeSources: IncomeSource[] = [],
): AllocationReport {
  const saved = profiles.filter((p) => p.id);
  const phantom = PHANTOM_ALLOCATION_DRAFT;

  const plans: AllocationPlanColumn[] = saved.map((p) => ({
    id: p.id,
    name: p.name.trim() || activeMessages().domain.fallbacks.untitledPlan,
    usesMonthlyIncome: p.includeMonthlyIncome !== false,
    effectiveStartingTotal: totalGoalStartingBalance(
      p.seedLines,
      seedOptions,
      saved,
      p,
    ),
  }));

  const keySet = new Set<string>();
  for (const o of seedOptions) {
    if (o.key !== "none") keySet.add(o.key);
  }
  for (const p of saved) {
    for (const l of p.seedLines ?? []) {
      keySet.add(l.sourceKey);
    }
  }
  for (const s of incomeSources) {
    for (const l of s.capitalLines ?? []) {
      keySet.add(l.sourceKey);
    }
  }
  keySet.delete("none");

  const keysSorted = [...keySet].sort((a, b) =>
    labelForKey(a, seedOptions).localeCompare(labelForKey(b, seedOptions)),
  );

  const sources: AllocationSourceRow[] = [];
  for (const sourceKey of keysSorted) {
    const label = labelForKey(sourceKey, seedOptions);
    const band = liquidityBandForSourceKey(sourceKey, catalog);
    const liveBalance = liveBalanceForSourceKey(sourceKey, seedOptions);
    const remainingPool = maxAllocationForSourceKey(
      sourceKey,
      seedOptions,
      saved,
      phantom,
      undefined,
    );

    const perPlanStored: Record<string, number> = {};
    let totalReservedStored = 0;
    const allInPlan = saved.find((p) => (p.seedLines ?? []).some((l) => l.sourceKey === sourceKey && isAllInHolder(l, saved, p)));
    for (const p of saved) {
      const v = storedForPlan(p, sourceKey, seedOptions, saved);
      if (v > 0) perPlanStored[p.id] = v;
      totalReservedStored += v;
    }

    let totalIncomeCapital = 0;
    for (const s of incomeSources) {
      totalIncomeCapital += storedForIncome(s, sourceKey);
    }

    if (
      liveBalance <= 0 &&
      totalReservedStored <= 0 &&
      totalIncomeCapital <= 0
    ) {
      continue;
    }

    sources.push({
      sourceKey,
      label,
      band,
      liveBalance,
      totalReservedStored,
      remainingPool,
      perPlanStored,
      ...(allInPlan ? { allInPlanId: allInPlan.id } : {}),
      totalIncomeCapital,
    });
  }

  let instantRemainingPool = 0;
  let notInstantRemainingPool = 0;
  for (const r of sources) {
    if (r.band === "instant") instantRemainingPool += r.remainingPool;
    else if (r.band === "not_instant") notInstantRemainingPool += r.remainingPool;
  }

  const customReservedStored = saved.reduce(
    (s, p) =>
      s +
      (p.seedLines ?? [])
        .filter((l) => l.sourceKey === "custom")
        .reduce((acc, l) => acc + Math.max(0, l.amount), 0),
    0,
  );

  const totalIncomeCapital = sources.reduce(
    (s, row) => s + row.totalIncomeCapital,
    0,
  );

  return {
    plans,
    sources,
    totalIncomeCapital,
    totals: {
      instantRemainingPool,
      notInstantRemainingPool,
      customReservedStored,
    },
  };
}

/** Report straight from the stored tables (normalizes legacy seeds first). */
export function buildAllocationReportForTables(t: {
  goals: GoalsState;
  assets: AssetsState;
  settingsAssets: SettingsAsset[];
  incomeSources: IncomeSource[];
}): AllocationReport {
  const seedOptions = buildGoalStartingOptions(t.assets, t.settingsAssets);
  const seedKeys = new Set(seedOptions.map((o) => o.key));
  return buildAllocationReport(
    normalizeProfilesForAllocationReport(t.goals.profiles, seedKeys),
    seedOptions,
    t.settingsAssets,
    t.incomeSources,
  );
}

export function filterAllocationRowsByBand(
  rows: AllocationSourceRow[],
  filter: AllocationsBandFilter,
): AllocationSourceRow[] {
  if (filter === "both") return rows;
  return rows.filter((row) => row.band === filter);
}
