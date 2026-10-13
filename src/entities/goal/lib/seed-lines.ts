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
      ...(l.allIn === true && l.sourceKey !== "custom" && l.sourceKey !== "none" ? { allIn: true } : {}),
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

/** One plan's line on a keyed source, in plan order (the draft takes its saved plan's place). */
type SourceClaim = { planId: string; planName: string; isDraft: boolean; line: GoalSeedLine };

function claimsOnSource(sourceKey: string, savedPlans: GoalProfile[], draft: GoalProfile): SourceClaim[] {
  const plans = savedPlans.some((p) => p.id === draft.id) ? savedPlans.map((p) => (p.id === draft.id ? draft : p)) : [...savedPlans, draft];
  const out: SourceClaim[] = [];
  for (const plan of plans) {
    const isDraft = plan === draft;
    const name = plan.name?.trim() || (isDraft ? activeMessages().domain.fallbacks.thisPlan : activeMessages().domain.fallbacks.untitledPlan);
    for (const line of plan.seedLines ?? []) {
      if (line.sourceKey === sourceKey) out.push({ planId: plan.id, planName: name, isDraft, line });
    }
  }
  return out;
}

/**
 * The line taking everything left in `sourceKey`: the first all-in line in plan
 * order. Any later all-in line on the same source counts as a fixed amount.
 */
function allInHolder(claims: SourceClaim[]): SourceClaim | undefined {
  return claims.find((c) => c.line.allIn === true);
}

/** `line` is the claim's line (ids alone can repeat across plans, e.g. migrated seeds). */
function isSameLine(claim: SourceClaim, line: GoalSeedLine): boolean {
  return claim.line === line || (claim.isDraft && claim.line.id === line.id);
}

/** Whether `line` (of `draft` or a saved plan) is the one taking everything left in its source. */
export function isAllInHolder(line: GoalSeedLine, savedPlans: GoalProfile[], draft: GoalProfile): boolean {
  if (line.allIn !== true || line.sourceKey === "custom" || line.sourceKey === "none") return false;
  const holder = allInHolder(claimsOnSource(line.sourceKey, savedPlans, draft));
  return holder ? isSameLine(holder, line) : false;
}

/** The other plan (not the draft) holding `sourceKey` all-in, if any. */
export function allInPlanElsewhere(sourceKey: string, savedPlans: GoalProfile[], draft: GoalProfile): { planId: string; planName: string } | null {
  if (sourceKey === "none" || sourceKey === "custom") return null;
  const holder = allInHolder(claimsOnSource(sourceKey, savedPlans, draft));
  return holder && !holder.isDraft ? { planId: holder.planId, planName: holder.planName } : null;
}

/**
 * Sum of fixed `amount`s reserved from `sourceKey` across all saved plans, except the
 * active plan uses `draft.seedLines`. The line `excludeLineId` (if any) is
 * omitted so capacity for that row can be computed. The all-in line reserves
 * no fixed amount (it takes what is left).
 */
export function allocatedFromSourceKeyAcrossPlans(
  sourceKey: string,
  savedPlans: GoalProfile[],
  draft: GoalProfile,
  excludeLineId: string | undefined,
): number {
  if (sourceKey === "none" || sourceKey === "custom") return 0;
  const claims = claimsOnSource(sourceKey, savedPlans, draft);
  const holder = allInHolder(claims);
  let sum = 0;
  for (const c of claims) {
    if (c === holder) continue;
    if (excludeLineId && c.isDraft && c.line.id === excludeLineId) continue;
    sum += Math.max(0, c.line.amount);
  }
  return sum;
}

export type SourceGoalUsage = {
  planId: string;
  planName: string;
  amount: number;
  isDraft: boolean;
  /** Takes everything left in the source. */
  allIn?: boolean;
};

/**
 * Per-plan ₫ already allocated from `sourceKey` (an all-in plan: what it takes
 * now). By default returns only plans other than the draft; pass `includeDraft`
 * to also include the draft (useful for in-modal "this plan still has X
 * allocated elsewhere" displays).
 */
export function goalUsageForSourceKey(
  sourceKey: string,
  savedPlans: GoalProfile[],
  draft: GoalProfile,
  options?: { includeDraft?: boolean; excludeLineId?: string; seedOptions?: GoalStartingOption[] },
): SourceGoalUsage[] {
  if (sourceKey === "none" || sourceKey === "custom") return [];
  const claims = claimsOnSource(sourceKey, savedPlans, draft);
  const holder = allInHolder(claims);
  const out: SourceGoalUsage[] = [];
  // Other plans first, then the draft.
  const ordered = [...claims.filter((c) => !c.isDraft), ...claims.filter((c) => c.isDraft)];
  for (const c of ordered) {
    if (c.isDraft && (!options?.includeDraft || (options.excludeLineId && c.line.id === options.excludeLineId))) continue;
    const allIn = c === holder;
    const amount = allIn
      ? options?.seedOptions
        ? effectiveGoalSeedLineAmount(c.line, options.seedOptions, savedPlans, draft)
        : Math.max(0, c.line.amount)
      : Math.max(0, c.line.amount);
    if (amount <= 0 && !allIn) continue;
    const prev = out.find((u) => u.planId === c.planId);
    if (prev) prev.amount += amount;
    else out.push({ planId: c.planId, planName: c.planName, amount, isDraft: c.isDraft, ...(allIn ? { allIn: true } : {}) });
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
  const free = Math.max(0, live - takenElsewhere);
  // Another plan takes this source all-in: keep (or lower) what this line had, never more.
  if (allInPlanElsewhere(sourceKey, savedPlans, draft)) {
    const saved = savedPlans.find((p) => p.id === draft.id)?.seedLines?.find((l) => l.id === excludeLineId && l.sourceKey === sourceKey);
    return Math.min(free, saved && saved.allIn !== true ? Math.max(0, saved.amount) : 0);
  }
  return free;
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
  const claims = claimsOnSource(line.sourceKey, savedPlans, draft);
  const holder = allInHolder(claims);
  const fixed = claims.reduce((s, c) => (c === holder ? s : s + Math.max(0, c.line.amount)), 0);
  // All-in: whatever the fixed reservations leave.
  if (holder && isSameLine(holder, line)) {
    return Math.max(0, live - fixed);
  }
  const reserved = fixed;
  if (reserved <= live) return amount;
  // Whole ₫, rounded down so the plans together never exceed the live balance.
  return live > 0 ? Math.floor((amount * live) / reserved) : 0;
}

/** What a line holds from its source: its amount, or for the all-in line what it takes now. */
export function reservedAmountForSeedLine(
  line: GoalSeedLine,
  options: GoalStartingOption[],
  savedPlans: GoalProfile[],
  draft: GoalProfile,
): number {
  return isAllInHolder(line, savedPlans, draft)
    ? effectiveGoalSeedLineAmount(line, options, savedPlans, draft)
    : Math.max(0, line.amount);
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
    // All in: store what it takes now.
    if (l.allIn === true) return { ...l, amount: max };
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
    if (l.allIn === true) return { ...l, amount: max };
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
  const usage = goalUsageForSourceKey(option.key, savedPlans, planDraft, { seedOptions: [option] });
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
  /** This line takes everything left in the source. */
  allIn: boolean;
  /** Another plan already takes this source all-in (so this one can't). */
  allInElsewhere: string | null;
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
  const allIn = !isCustom && isAllInHolder(line, savedPlans, planDraft);
  // All-in already counts everything free; nothing is left over for this plan.
  const allocatedNow = allIn ? effective : Math.max(0, line.amount);
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
    over: !isCustom && !allIn && line.amount > maxAlloc,
    usage: !isCustom ? goalUsageForSourceKey(line.sourceKey, savedPlans, planDraft, { seedOptions }) : [],
    availabilityTone: allIn
      ? "default"
      : availableToPlan === 0 && maxAlloc > 0
        ? "danger"
        : maxAlloc < live
          ? "warning"
          : "default",
    allIn,
    allInElsewhere: isCustom ? null : (allInPlanElsewhere(line.sourceKey, savedPlans, planDraft)?.planName ?? null),
  };
}

/**
 * Turn all-in on or off for one keyed line. On: it takes everything free in
 * the source. Off: it keeps what it takes now as a fixed amount.
 */
export function setSeedLineAllIn(
  lines: GoalSeedLine[],
  lineId: string,
  allIn: boolean,
  seedOptions: GoalStartingOption[],
  savedPlans: GoalProfile[],
  draft: GoalProfile,
): GoalSeedLine[] {
  const target = lines.find((l) => l.id === lineId);
  if (!target || target.sourceKey === "custom" || target.sourceKey === "none") return lines;
  if (allIn && allInPlanElsewhere(target.sourceKey, savedPlans, { ...draft, seedLines: lines })) return lines;
  const next = lines.map((l) => {
    if (l.id !== lineId) return l;
    const rest = { ...l };
    delete rest.allIn;
    return allIn ? { ...rest, allIn: true } : rest;
  });
  const nextDraft = { ...draft, seedLines: next };
  const line = next.find((l) => l.id === lineId)!;
  const amount = effectiveGoalSeedLineAmount(allIn ? line : target, seedOptions, savedPlans, allIn ? nextDraft : { ...draft, seedLines: lines });
  return next.map((l) => (l.id === lineId ? { ...l, amount } : l));
}
