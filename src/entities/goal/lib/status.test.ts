import { describe, expect, it } from "vitest";

import { resolveGoalStatus } from "./status";

const NOW = new Date(2026, 9, 13, 12);
const base = { startingBalance: 0, targetAmount: 120_000_000, targetDateIso: "2027-10-13", householdMonthlyNet: 20_000_000, monthlyShare: 0.5, now: NOW };

describe("resolveGoalStatus", () => {
  it("is on track when this plan's share reaches the target in time", () => {
    // Just under 12 months left: 10tr a month falls a little short, 10,2tr makes it.
    expect(resolveGoalStatus(base).code).toBe("close");
    const s = resolveGoalStatus({ ...base, monthlyShare: 0.51 });
    expect(s.code).toBe("on_track");
    expect(s.tone).toBe("success");
    expect(s.requiredMonthly).toBeCloseTo(10_000_000, -5);
    expect(s.extraNeeded).toBe(0);
  });

  it("is close within 10 % of the needed saving, behind below that", () => {
    expect(resolveGoalStatus({ ...base, monthlyShare: 0.47 }).code).toBe("close");
    const behind = resolveGoalStatus({ ...base, monthlyShare: 0.3 });
    expect(behind.code).toBe("behind");
    expect(behind.extraNeeded).toBeCloseTo(4_000_000, -5);
    expect(behind.gap).toBeGreaterThan(40_000_000);
  });

  it("covers the other cases", () => {
    expect(resolveGoalStatus({ ...base, targetAmount: 0 }).code).toBe("no_target");
    expect(resolveGoalStatus({ ...base, startingBalance: 130_000_000 }).code).toBe("achieved");
    expect(resolveGoalStatus({ ...base, targetDateIso: "" }).code).toBe("no_date");
    expect(resolveGoalStatus({ ...base, targetDateIso: "2026-01-01" }).code).toBe("past_due");
    expect(resolveGoalStatus({ ...base, includeMonthlyIncome: false }).code).toBe("no_savings");
    expect(resolveGoalStatus({ ...base, householdMonthlyNet: -5_000_000 }).code).toBe("no_savings");
  });

  it("counts growth on the plan's money", () => {
    const grown = resolveGoalStatus({ ...base, startingBalance: 100_000_000, monthlyShare: 0, expectedReturnPct: 25 });
    expect(grown.code).toBe("on_track");
    expect(grown.progress).toBeCloseTo(100 / 120, 6);
  });
});
