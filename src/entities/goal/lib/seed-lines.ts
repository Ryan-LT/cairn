import { activeMessages } from "@/shared/i18n/active";
import type { GoalProfile, GoalSeedLine } from "@/entities/goal/model";
import type { GoalStartingOption } from "@/entities/goal/lib/starting-options";

/** Convert legacy single-seed fields or normalize stored `seedLines`. */
export function migrateLegacySeedsToLines(profile: GoalProfile): GoalSeedLine[] {
  if (profile.seedLines?.length) {
    return profile.seedLines.map((l) => ({
      id: l.id || `seed-${Math.random().toString(36).slice(2, 11)}`,
      sourceKey: l.sourceKey,
      amount: typeof l.amount === "number" ? l.amount : 0,
    }));
  }
  const key = profile.seedSourceKey ?? "none";
  const amt = typeof profile.seedAmount === "number" ? profile.seedAmount : 0;
  if (key === "none" && amt <= 0) return [];
  return [{ id: "migrated-seed", sourceKey: key, amount: amt }];
}

/** Drop duplicate non-custom keys (keep first). */
export function dedupeNonCustomSeedLines(lines: GoalSeedLine[]): GoalSeedLine[] {
  const seen = new Set<string>();
  const out: GoalSeedLine[] = [];
  for (const line of lines) {
    if (line.sourceKey === "custom") {
      out.push(line);
      continue;
    }
    if (seen.has(line.sourceKey)) continue;
    seen.add(line.sourceKey);
    out.push(line);
  }
  return out;
}

/** Remove lines whose keys no longer exist (except `custom`). */
export function sanitizeSeedLinesAgainstOptions(
  lines: GoalSeedLine[],
  seedKeys: Set<string>,
): GoalSeedLine[] {
  return dedupeNonCustomSeedLines(
    lines.filter(
      (l) => l.sourceKey === "custom" || (l.sourceKey !== "none" && seedKeys.has(l.sourceKey)),
    ),
  );
}

export function liveBalanceForSourceKey(
  sourceKey: string,
  options: GoalStartingOption[],
): number {
  if (sourceKey === "none" || sourceKey === "custom") return 0;
  const opt = options.find((o) => o.key === sourceKey);
  if (!opt || opt.isCustom) return 0;
  return Math.max(0, opt.amount);
}

/**
 * Sum of stored `amount` for `sourceKey` across all saved plans, except the
 * active plan uses `draft.seedLines`. The line `excludeLineId` (if any) is
 * omitted so capacity for that row can be computed.
 */
export function allocatedFromSourceKeyAcrossPlans(
  sourceKey: string,
  savedPlans: GoalProfile[],
  draft: GoalProfile,
  excludeLineId: string | undefined,
): number {
  if (sourceKey === "none" || sourceKey === "custom") return 0;
  let sum = 0;
  for (const plan of savedPlans) {
    if (plan.id === draft.id) continue;
    for (const l of plan.seedLines ?? []) {
      if (l.sourceKey !== sourceKey) continue;
      sum += Math.max(0, l.amount);
    }
  }
  for (const l of draft.seedLines ?? []) {
    if (l.sourceKey !== sourceKey) continue;
    if (excludeLineId && l.id === excludeLineId) continue;
    sum += Math.max(0, l.amount);
  }
  return sum;
}

export type SourceGoalUsage = {
  planId: string;
  planName: string;
  amount: number;
  isDraft: boolean;
};

/**
 * Per-plan ₫ already allocated from `sourceKey`. By default returns only plans other than
 * the draft; pass `includeDraft` to also include the draft (useful for in-modal "this plan
 * still has X allocated elsewhere" displays).
 */
export function goalUsageForSourceKey(
  sourceKey: string,
  savedPlans: GoalProfile[],
  draft: GoalProfile,
  options?: { includeDraft?: boolean; excludeLineId?: string },
): SourceGoalUsage[] {
  if (sourceKey === "none" || sourceKey === "custom") return [];
  const out: SourceGoalUsage[] = [];
  for (const plan of savedPlans) {
    if (plan.id === draft.id) continue;
    let sum = 0;
    for (const l of plan.seedLines ?? []) {
      if (l.sourceKey === sourceKey) sum += Math.max(0, l.amount);
    }
    if (sum > 0) {
      out.push({
        planId: plan.id,
        planName: plan.name?.trim() || activeMessages().domain.fallbacks.untitledPlan,
        amount: sum,
        isDraft: false,
      });
    }
  }
  if (options?.includeDraft) {
    let sum = 0;
    for (const l of draft.seedLines ?? []) {
      if (l.sourceKey !== sourceKey) continue;
      if (options.excludeLineId && l.id === options.excludeLineId) continue;
      sum += Math.max(0, l.amount);
    }
    if (sum > 0) {
      out.push({
        planId: draft.id,
        planName: draft.name?.trim() || activeMessages().domain.fallbacks.thisPlan,
        amount: sum,
        isDraft: true,
      });
    }
  }
  return out;
}

/** Maximum ₫ this plan may assign from `sourceKey` on the given line (others' allocations subtracted). */
export function maxAllocationForSourceKey(
  sourceKey: string,
  options: GoalStartingOption[],
  savedPlans: GoalProfile[],
  draft: GoalProfile,
  excludeLineId: string | undefined,
): number {
  const live = liveBalanceForSourceKey(sourceKey, options);
  const takenElsewhere = allocatedFromSourceKeyAcrossPlans(
    sourceKey,
    savedPlans,
    draft,
    excludeLineId,
  );
  return Math.max(0, live - takenElsewhere);
}

/**
 * Effective ₫ for projections. While a source's reservations fit its live
 * balance, each line counts in full. When they exceed it (the asset lost value
 * after money was reserved), every plan's reservation is scaled down by the
 * same factor, so together they count exactly the live balance — never more,
 * and never less.
 */
export function effectiveGoalSeedLineAmount(
  line: GoalSeedLine,
  options: GoalStartingOption[],
  savedPlans: GoalProfile[],
  draft: GoalProfile,
): number {
  const amount = Math.max(0, line.amount);
  if (line.sourceKey === "custom") return amount;
  const live = liveBalanceForSourceKey(line.sourceKey, options);
  const reserved =
    allocatedFromSourceKeyAcrossPlans(line.sourceKey, savedPlans, draft, line.id) + amount;
  if (reserved <= live) return amount;
  // Whole ₫, rounded down so the plans together never exceed the live balance.
  return live > 0 ? Math.floor((amount * live) / reserved) : 0;
}

export function totalGoalStartingBalance(
  lines: GoalSeedLine[] | undefined,
  options: GoalStartingOption[],
  savedPlans: GoalProfile[],
  draft: GoalProfile,
): number {
  if (!lines?.length) return 0;
  return lines.reduce(
    (s, line) => s + effectiveGoalSeedLineAmount(line, options, savedPlans, draft),
    0,
  );
}

export function labelForSeedLine(
  line: GoalSeedLine,
  options: GoalStartingOption[],
): string {
  if (line.sourceKey === "custom") return activeMessages().domain.startingOptions.customLine;
  return options.find((o) => o.key === line.sourceKey)?.label ?? line.sourceKey;
}

export function appendGoalSeedLine(
  profile: GoalProfile,
  pendingKey: string,
  options: GoalStartingOption[],
  savedPlans: GoalProfile[],
): GoalProfile | null {
  if (!pendingKey || pendingKey === "none") return null;
  const opt = options.find((o) => o.key === pendingKey);
  if (!opt) return null;

  const lines = profile.seedLines ?? [];
  if (!opt.isCustom && lines.some((l) => l.sourceKey === pendingKey)) {
    return null;
  }

  const id = `seed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const draftForMax = { ...profile, seedLines: lines };
  const maxKeyed =
    pendingKey !== "custom"
      ? maxAllocationForSourceKey(pendingKey, options, savedPlans, draftForMax, undefined)
      : 0;
  const nextLine: GoalSeedLine = opt.isCustom
    ? { id, sourceKey: "custom", amount: 0 }
    : {
        id,
        sourceKey: pendingKey,
        amount: Math.min(Math.max(0, opt.amount), maxKeyed),
      };

  return {
    ...profile,
    seedLines: [...lines, nextLine],
  };
}

/** Clamp keyed line amounts so they never exceed the shared pool or live balance. */
export function clampSeedLinesToAllocationPool(
  lines: GoalSeedLine[],
  options: GoalStartingOption[],
  savedPlans: GoalProfile[],
  draft: GoalProfile,
): GoalSeedLine[] {
  return lines.map((l) => {
    if (l.sourceKey === "custom") return l;
    const max = maxAllocationForSourceKey(l.sourceKey, options, savedPlans, draft, l.id);
    return { ...l, amount: Math.min(Math.max(0, l.amount), max) };
  });
}

/**
 * After migration, keyed lines with amount 0 get a sensible default from the
 * remaining pool (legacy rows used live balance without persisting amount).
 */
export function ensureKeyedSeedDefaults(
  lines: GoalSeedLine[],
  options: GoalStartingOption[],
  savedPlans: GoalProfile[],
  draft: GoalProfile,
): GoalSeedLine[] {
  return lines.map((l) => {
    if (l.sourceKey === "custom" || l.sourceKey === "none") return l;
    const max = maxAllocationForSourceKey(l.sourceKey, options, savedPlans, draft, l.id);
    if (l.amount > 0) {
      return { ...l, amount: Math.min(l.amount, max) };
    }
    return { ...l, amount: max };
  });
}

/** Options that can still be added to a plan (custom may repeat; keyed sources once). */
export function addableSeedOptions(
  seedOptions: GoalStartingOption[],
  lines: GoalSeedLine[],
): GoalStartingOption[] {
  const used = new Set<string>();
  for (const l of lines) {
    if (l.sourceKey !== "custom") used.add(l.sourceKey);
  }
  return seedOptions.filter((o) => o.key !== "none" && (o.isCustom || !used.has(o.key)));
}

export type SourceAvailability = {
  live: number;
  usage: SourceGoalUsage[];
  reservedElsewhere: number;
  remaining: number;
  fullyReserved: boolean;
  empty: boolean;
};

/** How much of a keyed source is still free for this plan (picker rows). */
export function sourceAvailability(
  option: GoalStartingOption,
  savedPlans: GoalProfile[],
  planDraft: GoalProfile,
): SourceAvailability {
  const live = Math.max(0, option.amount);
  const usage = goalUsageForSourceKey(option.key, savedPlans, planDraft);
  const reservedElsewhere = usage.reduce((s, u) => s + u.amount, 0);
  const remaining = Math.max(0, live - reservedElsewhere);
  return {
    live,
    usage,
    reservedElsewhere,
    remaining,
    fullyReserved: live > 0 && remaining === 0,
    empty: live === 0,
  };
}

export type SeedLineAllocationView = {
  title: string;
  category?: string;
  liquidity?: GoalStartingOption["liquidity"];
  isCustom: boolean;
  live: number;
  /** Cap for this line (Infinity for custom). */
  maxAlloc: number;
  /** Amount that counts toward the plan after caps. */
  effective: number;
  /** Headroom left after the current input value. */
  availableToPlan: number;
  over: boolean;
  usage: SourceGoalUsage[];
  availabilityTone: "danger" | "warning" | "default";
};

/** Everything the allocation editor shows for one starting-balance line. */
export function seedLineAllocationView(
  line: GoalSeedLine,
  seedOptions: GoalStartingOption[],
  savedPlans: GoalProfile[],
  planDraft: GoalProfile,
): SeedLineAllocationView {
  const option = seedOptions.find((o) => o.key === line.sourceKey);
  const isCustom = line.sourceKey === "custom";
  const live = !isCustom ? liveBalanceForSourceKey(line.sourceKey, seedOptions) : 0;
  const maxAlloc = !isCustom
    ? maxAllocationForSourceKey(line.sourceKey, seedOptions, savedPlans, planDraft, line.id)
    : Number.POSITIVE_INFINITY;
  const effective = effectiveGoalSeedLineAmount(line, seedOptions, savedPlans, planDraft);
  const allocatedNow = Math.max(0, line.amount);
  const availableToPlan = Math.max(0, maxAlloc - allocatedNow);
  return {
    title: labelForSeedLine(line, seedOptions),
    category: option?.category,
    liquidity: option?.liquidity,
    isCustom,
    live,
    maxAlloc,
    effective,
    availableToPlan,
    over: !isCustom && line.amount > maxAlloc,
    usage: !isCustom ? goalUsageForSourceKey(line.sourceKey, savedPlans, planDraft) : [],
    availabilityTone:
      availableToPlan === 0 && maxAlloc > 0
        ? "danger"
        : maxAlloc < live
          ? "warning"
          : "default",
  };
}
