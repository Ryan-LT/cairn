import { describe, expect, it } from "vitest";

import {
  analyzeMilestone,
  formatAheadOfTarget,
  milestoneChipDetail,
  milestoneHint,
  resolveMilestoneSettings,
  type MilestoneConfigResponse,
  type MilestoneFormatters,
  type ResolvedMilestoneSettings,
} from "@/entities/milestone";

const fmt: MilestoneFormatters = {
  money: (n, o) => `${o?.signed ? "+" : ""}${n}₫`,
  usd: (n) => `$${n}`,
};
const now = new Date("2026-01-01T00:00:00Z");
const config: MilestoneConfigResponse = {
  vndPerUsd: 10,
  annualRealRate: 0.025,
  realRateSource: "default",
  vndPerUsdSource: "env",
  fxFetchedAtIso: null,
  fxApiLastUpdateIso: null,
};
/** Turns 35 on 1 Jan 2030 → target 1,000 USD = 10,000 ₫. */
const settings: ResolvedMilestoneSettings = {
  birthDate: new Date(1995, 0, 1, 12),
  targetUsd: 1_000,
  targetAge: 35,
};

describe("resolveMilestoneSettings", () => {
  it("defaults to $1M by 35 without a birth date", () => {
    expect(resolveMilestoneSettings(undefined)).toEqual({ birthDate: null, targetUsd: 1_000_000, targetAge: 35 });
  });

  it("keeps valid values and drops invalid ones", () => {
    const r = resolveMilestoneSettings({ birthDate: "1990-06-15", targetUsd: 500_000, targetAge: 40 });
    expect(r.targetUsd).toBe(500_000);
    expect(r.targetAge).toBe(40);
    expect(r.birthDate?.getFullYear()).toBe(1990);
    expect(resolveMilestoneSettings({ birthDate: "15/06/1990", targetUsd: -1, targetAge: 7 })).toEqual({
      birthDate: null,
      targetUsd: 1_000_000,
      targetAge: 35,
    });
  });
});

describe("analyzeMilestone", () => {
  it("asks for a birth date first", () => {
    const a = analyzeMilestone({
      config,
      settings: { ...settings, birthDate: null },
      currentNetWorth: 0,
      monthlyNetContribution: 0,
      now,
    });
    expect(a).toEqual({ kind: "incomplete", targetUsd: 1_000, targetAge: 35, missing: "BIRTH_DATE" });
    expect(milestoneHint(a, fmt)).toContain("date of birth in Settings");
  });

  it("incomplete without an FX rate", () => {
    const a = analyzeMilestone({
      config: { ...config, vndPerUsd: null },
      settings,
      currentNetWorth: 0,
      monthlyNetContribution: 0,
      now,
    });
    expect(a).toEqual({ kind: "incomplete", targetUsd: 1_000, targetAge: 35, missing: "FX_RATE" });
    expect(milestoneHint(a, fmt)).toContain("exchange rate");
  });

  it("achieved", () => {
    const a = analyzeMilestone({ config, settings, currentNetWorth: 12_500, monthlyNetContribution: 0, now });
    expect(a).toMatchObject({ kind: "achieved", pct: 100, surplus: 2_500, pastDeadline: false, targetVnd: 10_000 });
    expect(milestoneChipDetail(a, 12_500, fmt)).toBe("+25,0% · +2500₫");
    expect(milestoneHint(a, fmt)).toBe("Already +25,0% · +2500₫ above the $1000 target.");
  });

  it("past deadline", () => {
    const a = analyzeMilestone({
      config,
      settings: { ...settings, birthDate: new Date(1990, 0, 1, 12) },
      currentNetWorth: 2_500,
      monthlyNetContribution: 0,
      now,
    });
    expect(a).toMatchObject({ kind: "past_deadline", pct: 25 });
    expect(milestoneHint(a, fmt)).toBe("Age 35 deadline passed.");
  });

  it("uses the user's own target and age", () => {
    const a = analyzeMilestone({
      config,
      settings: { birthDate: new Date(1990, 0, 1, 12), targetUsd: 2_000, targetAge: 45 },
      currentNetWorth: 0,
      monthlyNetContribution: 1_000,
      now,
    });
    expect(a).toMatchObject({ kind: "projection", targetUsd: 2_000, targetVnd: 20_000, targetAge: 45 });
    if (a.kind !== "projection") throw new Error("expected projection");
    expect(a.deadline.getFullYear()).toBe(2035);
    expect(milestoneHint(a, fmt)).toContain("at age 45");
  });

  it("projection tones", () => {
    const onTrack = analyzeMilestone({ config, settings, currentNetWorth: 1_000, monthlyNetContribution: 1_000, now });
    expect(onTrack).toMatchObject({ kind: "projection", tone: "success", verdict: "on_track", feasible: true, pct: 10 });
    expect(milestoneHint(onTrack, fmt)).toMatch(/^Projected \d+(\.\d+)?₫ at age 35 — \+\d/);
    expect(milestoneChipDetail(onTrack, 1_000, fmt)).toMatch(/^\+\d+,\d% · \+/);

    const tight = analyzeMilestone({
      config,
      settings: { ...settings, birthDate: new Date(1991, 0, 19, 12) },
      currentNetWorth: 9_990,
      monthlyNetContribution: 100,
      now,
    });
    expect(tight).toMatchObject({ kind: "projection", tone: "warning", verdict: "tight" });

    const behind = analyzeMilestone({ config, settings, currentNetWorth: 0, monthlyNetContribution: 10, now });
    expect(behind).toMatchObject({ kind: "projection", tone: "danger", verdict: "below", feasible: false });
    expect(milestoneHint(behind, fmt)).toMatch(/^Trajectory lands near .* below target\.$/);
    expect(milestoneChipDetail(behind, 0, fmt)).toBeUndefined();
  });

  it("formats ahead-of-target labels", () => {
    expect(formatAheadOfTarget(90, 100, fmt)).toEqual({ surplus: -10, pctLabel: "−10,0%", moneyLabel: "10₫", detail: "−10,0% · 10₫" });
  });
});
