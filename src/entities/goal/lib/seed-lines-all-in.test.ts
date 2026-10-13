import { describe, expect, it } from "vitest";

import { EMPTY_GOAL_PROFILE, type GoalProfile } from "@/entities/goal/model";
import { buildGoalStartingOptions } from "@/entities/goal/lib/starting-options";
import {
  allInPlanElsewhere,
  clampSeedLinesToAllocationPool,
  effectiveGoalSeedLineAmount,
  goalUsageForSourceKey,
  isAllInHolder,
  maxAllocationForSourceKey,
  migrateLegacySeedsToLines,
  seedLineAllocationView,
  setSeedLineAllIn,
  sourceAvailability,
  totalGoalStartingBalance,
} from "@/entities/goal/lib/seed-lines";
import { buildAllocationReport } from "@/entities/portfolio/lib/allocation-report";
import { fixtureAssets, fixtureCatalog } from "@/test/fixtures/tables";

const GOLD = "catalog:a2"; // Gold bars, 150tr
const optionsAt = (gold: number) => buildGoalStartingOptions(fixtureAssets, fixtureCatalog.map((a) => (a.id === "a2" ? { ...a, currentValue: gold } : a)));
const options = optionsAt(150_000_000);

const plan = (id: string, name: string, lines: GoalProfile["seedLines"]): GoalProfile => ({ ...EMPTY_GOAL_PROFILE, id, name, targetAmount: 1_000_000_000, seedLines: lines });
// A takes the gold all in; B reserved a fixed 40tr from it before.
const planA = plan("pa", "Nhà", [{ id: "x1", sourceKey: GOLD, amount: 0, allIn: true }]);
const planB = plan("pb", "Xe", [{ id: "y1", sourceKey: GOLD, amount: 40_000_000 }]);
const saved = [planA, planB];
const lineA = planA.seedLines![0];
const lineB = planB.seedLines![0];

describe("all-in starting balance", () => {
  it("takes everything the fixed reservations leave", () => {
    expect(effectiveGoalSeedLineAmount(lineA, options, saved, planA)).toBe(110_000_000);
    expect(effectiveGoalSeedLineAmount(lineB, options, saved, planB)).toBe(40_000_000);
    expect(totalGoalStartingBalance(planA.seedLines, options, saved, planA) + totalGoalStartingBalance(planB.seedLines, options, saved, planB)).toBe(150_000_000);
  });

  it("follows the source's value without edits", () => {
    expect(effectiveGoalSeedLineAmount(lineA, optionsAt(200_000_000), saved, planA)).toBe(160_000_000);
    expect(effectiveGoalSeedLineAmount(lineA, optionsAt(90_000_000), saved, planA)).toBe(50_000_000);
  });

  it("gets nothing when the fixed reservations already exceed the source; those scale down", () => {
    const low = optionsAt(30_000_000);
    expect(effectiveGoalSeedLineAmount(lineA, low, saved, planA)).toBe(0);
    expect(effectiveGoalSeedLineAmount(lineB, low, saved, planB)).toBe(30_000_000);
  });

  it("other plans keep (or lower) their share but can't grow it or add the source", () => {
    expect(maxAllocationForSourceKey(GOLD, options, saved, planB, "y1")).toBe(40_000_000);
    const planC = plan("pc", "Du lịch", [{ id: "z1", sourceKey: GOLD, amount: 0 }]);
    expect(maxAllocationForSourceKey(GOLD, options, saved, planC, "z1")).toBe(0);
    // Saving B with a bigger amount is clamped back.
    const greedy = { ...planB, seedLines: [{ ...lineB, amount: 90_000_000 }] };
    expect(clampSeedLinesToAllocationPool(greedy.seedLines!, options, saved, greedy)[0].amount).toBe(40_000_000);
  });

  it("knows who holds the source", () => {
    expect(isAllInHolder(lineA, saved, planA)).toBe(true);
    expect(allInPlanElsewhere(GOLD, saved, planB)).toEqual({ planId: "pa", planName: "Nhà" });
    expect(allInPlanElsewhere(GOLD, saved, planA)).toBeNull();
    expect(allInPlanElsewhere("custom", saved, planB)).toBeNull();
  });

  it("shows the all-in plan's live amount to the others", () => {
    expect(goalUsageForSourceKey(GOLD, saved, planB, { seedOptions: options })).toEqual([{ planId: "pa", planName: "Nhà", amount: 110_000_000, isDraft: false, allIn: true }]);
    const fresh = plan("pc", "Du lịch", []);
    const gold = options.find((o) => o.key === GOLD)!;
    expect(sourceAvailability(gold, saved, fresh)).toMatchObject({ remaining: 0, fullyReserved: true, reservedElsewhere: 150_000_000 });
  });

  it("describes the line for the editor", () => {
    const a = seedLineAllocationView(lineA, options, saved, planA);
    expect(a).toMatchObject({ allIn: true, allInElsewhere: null, effective: 110_000_000, availableToPlan: 0, over: false, availabilityTone: "default" });
    const b = seedLineAllocationView(lineB, options, saved, planB);
    expect(b).toMatchObject({ allIn: false, allInElsewhere: "Nhà", effective: 40_000_000, maxAlloc: 40_000_000 });
  });

  it("turning it off keeps today's amount fixed; turning it on takes what's free", () => {
    const off = setSeedLineAllIn(planA.seedLines!, "x1", false, options, saved, planA);
    expect(off).toEqual([{ id: "x1", sourceKey: GOLD, amount: 110_000_000 }]);
    // B can't take it while A holds it.
    expect(setSeedLineAllIn(planB.seedLines!, "y1", true, options, saved, planB)).toBe(planB.seedLines);
    // Once A lets go, B can.
    const savedAfter = [{ ...planA, seedLines: off }, planB];
    expect(setSeedLineAllIn(planB.seedLines!, "y1", true, options, savedAfter, planB)).toEqual([{ id: "y1", sourceKey: GOLD, amount: 40_000_000, allIn: true }]);
    // Alone on a source: everything.
    const solo = plan("ps", "Solo", [{ id: "q1", sourceKey: GOLD, amount: 5 }]);
    expect(setSeedLineAllIn(solo.seedLines!, "q1", true, options, [solo], solo)[0].amount).toBe(150_000_000);
    // Custom amounts can't be all in.
    const custom = [{ id: "c1", sourceKey: "custom", amount: 9 }];
    expect(setSeedLineAllIn(custom, "c1", true, options, [], plan("pz", "", custom))).toBe(custom);
  });

  it("saving stores what it takes now", () => {
    expect(clampSeedLinesToAllocationPool(planA.seedLines!, options, saved, planA)[0]).toEqual({ id: "x1", sourceKey: GOLD, amount: 110_000_000, allIn: true });
  });

  it("survives normalizing; never on custom lines", () => {
    expect(migrateLegacySeedsToLines(planA)).toEqual([{ id: "x1", sourceKey: GOLD, amount: 0, allIn: true }]);
    expect(migrateLegacySeedsToLines(plan("p", "", [{ id: "c", sourceKey: "custom", amount: 1, allIn: true }]))).toEqual([{ id: "c", sourceKey: "custom", amount: 1 }]);
  });

  it("if two plans both claim it, the first holds it and the other counts as fixed", () => {
    const dupB = { ...planB, seedLines: [{ ...lineB, allIn: true }] };
    const both = [planA, dupB];
    expect(isAllInHolder(dupB.seedLines![0], both, dupB)).toBe(false);
    expect(effectiveGoalSeedLineAmount(dupB.seedLines![0], options, both, dupB)).toBe(40_000_000);
    expect(effectiveGoalSeedLineAmount(lineA, options, both, planA)).toBe(110_000_000);
  });

  it("the allocations report shows the all-in plan's live amount and no room left", () => {
    const report = buildAllocationReport(saved, options, fixtureCatalog);
    const row = report.sources.find((r) => r.sourceKey === GOLD)!;
    expect(row.perPlanStored).toEqual({ pa: 110_000_000, pb: 40_000_000 });
    expect(row.totalReservedStored).toBe(150_000_000);
    expect(row.remainingPool).toBe(0);
  });
});
