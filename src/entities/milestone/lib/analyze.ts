import type { StatusTone } from "@/shared/lib/tone";
import { activeMessages } from "@/shared/i18n/active";
import type { Messages } from "@/shared/i18n/messages/en";
import { formatNumber } from "@/shared/lib/format";
import type {
  MilestoneConfigResponse,
  MilestoneSettings,
  ResolvedMilestoneSettings,
} from "@/entities/milestone/model";
import {
  birthdayAtAge,
  DEFAULT_MILESTONE_AGE,
  DEFAULT_MILESTONE_USD,
  evaluateMilestoneFeasibility,
  MAX_MILESTONE_AGE,
  MIN_MILESTONE_AGE,
  parseIsoDateOnly,
} from "@/shared/lib/milestone-projection";

type Target = { targetUsd: number; targetAge: number };

export type MilestoneAnalysis =
  | (Target & { kind: "incomplete"; missing: "BIRTH_DATE" | "FX_RATE" })
  | (Target & {
      kind: "achieved";
      targetVnd: number;
      pct: number;
      deadline: Date;
      pastDeadline: boolean;
      /** Current net worth minus target. */
      surplus: number;
    })
  | (Target & {
      kind: "past_deadline";
      targetVnd: number;
      pct: number;
      deadline: Date;
    })
  | (Target & {
      kind: "projection";
      targetVnd: number;
      pct: number;
      deadline: Date;
      projectedEndingNetWorth: number;
      feasible: boolean;
      monthsRemaining: number;
      /** Yearly real return assumed in the projection (fraction). */
      annualRealRate: number;
      tone: StatusTone;
      /** Badge text is `t.domain.milestone.verdict[verdict]`. */
      verdict: MilestoneVerdict;
    });

export type MilestoneVerdict = "on_track" | "tight" | "below";

/** Apply defaults ($1M, age 35) and drop invalid values from `preferences.milestone`. */
export function resolveMilestoneSettings(settings: MilestoneSettings | undefined): ResolvedMilestoneSettings {
  const targetUsd =
    typeof settings?.targetUsd === "number" && Number.isFinite(settings.targetUsd) && settings.targetUsd > 0
      ? settings.targetUsd
      : DEFAULT_MILESTONE_USD;
  const age = settings?.targetAge;
  const targetAge =
    typeof age === "number" && Number.isInteger(age) && age >= MIN_MILESTONE_AGE && age <= MAX_MILESTONE_AGE
      ? age
      : DEFAULT_MILESTONE_AGE;
  const birthDate = settings?.birthDate ? parseIsoDateOnly(settings.birthDate) : null;
  return { birthDate, targetUsd, targetAge };
}

/** Pure state machine behind the dashboard milestone card (target and age are per user). */
export function analyzeMilestone(input: {
  config: MilestoneConfigResponse;
  settings: ResolvedMilestoneSettings;
  currentNetWorth: number;
  monthlyNetContribution: number;
  now?: Date;
}): MilestoneAnalysis {
  const { config, settings, currentNetWorth, monthlyNetContribution } = input;
  const { targetUsd, targetAge } = settings;
  const now = input.now ?? new Date();

  if (!settings.birthDate) {
    return { kind: "incomplete", targetUsd, targetAge, missing: "BIRTH_DATE" };
  }
  if (config.vndPerUsd === null) {
    return { kind: "incomplete", targetUsd, targetAge, missing: "FX_RATE" };
  }

  const deadline = birthdayAtAge(settings.birthDate, targetAge);
  const targetVnd = Math.round(targetUsd * config.vndPerUsd);
  const pastDeadline = deadline.getTime() < now.getTime();
  const pct =
    targetVnd <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((currentNetWorth / targetVnd) * 100)));

  if (currentNetWorth >= targetVnd) {
    return {
      kind: "achieved",
      targetUsd,
      targetAge,
      targetVnd,
      pct,
      deadline,
      pastDeadline,
      surplus: currentNetWorth - targetVnd,
    };
  }

  if (pastDeadline) {
    return { kind: "past_deadline", targetUsd, targetAge, targetVnd, pct, deadline };
  }

  const { projectedEndingNetWorth, feasible, monthsRemaining } = evaluateMilestoneFeasibility({
    currentNetWorth,
    monthlyNetContribution,
    targetNetWorthVnd: targetVnd,
    deadline,
    annualRealRate: config.annualRealRate,
    now,
  });

  let tone: StatusTone;
  let verdict: MilestoneVerdict;
  if (feasible && monthsRemaining > 1) {
    tone = "success";
    verdict = "on_track";
  } else if (feasible) {
    tone = "warning";
    verdict = "tight";
  } else {
    tone = "danger";
    verdict = "below";
  }

  return {
    kind: "projection",
    targetUsd,
    targetAge,
    targetVnd,
    pct,
    deadline,
    projectedEndingNetWorth,
    feasible,
    monthsRemaining,
    annualRealRate: config.annualRealRate,
    tone,
    verdict,
  };
}

export type MilestoneFormatters = {
  /** Full money value; `signed` prefixes "+" for non-negative values. */
  money: (amount: number, opts?: { signed?: boolean }) => string;
  usd: (amount: number) => string;
};

/** "+12.5% · +125.000.000 ₫" style surplus label. */
export function formatAheadOfTarget(
  projected: number,
  target: number,
  fmt: MilestoneFormatters,
): { surplus: number; pctLabel: string; moneyLabel: string; detail: string } {
  const surplus = projected - target;
  const pct = target > 0 ? (surplus / target) * 100 : 0;
  const pctLabel = `${pct >= 0 ? "+" : ""}${formatNumber(pct, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
  const moneyLabel = fmt.money(Math.abs(surplus), { signed: surplus >= 0 });
  return { surplus, pctLabel, moneyLabel, detail: `${pctLabel} · ${moneyLabel}` };
}

/** Longer explanation for the status badge tooltip, in the page's language. */
export function milestoneHint(
  a: MilestoneAnalysis,
  fmt: MilestoneFormatters,
  m: Messages["domain"]["milestone"] = activeMessages().domain.milestone,
): string | null {
  switch (a.kind) {
    case "incomplete":
      return a.missing === "BIRTH_DATE" ? m.hintBirthDate({ age: a.targetAge }) : m.hintFxRate;
    case "achieved": {
      const ahead = formatAheadOfTarget(a.targetVnd + a.surplus, a.targetVnd, fmt);
      return m.hintAchieved({ detail: ahead.detail, target: fmt.usd(a.targetUsd) });
    }
    case "past_deadline":
      return m.hintPastDeadline({ age: a.targetAge });
    case "projection": {
      const ahead = formatAheadOfTarget(a.projectedEndingNetWorth, a.targetVnd, fmt);
      const projected = fmt.money(a.projectedEndingNetWorth);
      if (a.verdict === "on_track") {
        return m.hintOnTrack({
          projected,
          age: a.targetAge,
          pct: ahead.pctLabel,
          money: ahead.moneyLabel,
          target: fmt.usd(a.targetUsd),
          targetVnd: fmt.money(a.targetVnd),
        });
      }
      if (a.verdict === "tight") return m.hintTight({ projected, pct: ahead.pctLabel, money: ahead.moneyLabel });
      const gap = a.targetVnd - a.projectedEndingNetWorth;
      const shortPct = a.targetVnd > 0 ? formatNumber((gap / a.targetVnd) * 100, { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "0";
      return m.hintBelow({ projected, gap: fmt.money(gap), pct: `${shortPct}%` });
    }
  }
}

/** Short chip detail ("+12.5% · +X ₫") when the milestone is met or projected to be. */
export function milestoneChipDetail(
  a: MilestoneAnalysis,
  currentNetWorth: number,
  fmt: MilestoneFormatters,
): string | undefined {
  if (a.kind === "achieved") return formatAheadOfTarget(currentNetWorth, a.targetVnd, fmt).detail;
  if (a.kind === "projection" && a.feasible) {
    return formatAheadOfTarget(a.projectedEndingNetWorth, a.targetVnd, fmt).detail;
  }
  return undefined;
}
