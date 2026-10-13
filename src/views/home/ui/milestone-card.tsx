"use client";

import { CircleCheck, Pencil, RotateCw, Settings, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { feasibilityToneMeta } from "@/entities/goal/ui";
import {
  analyzeMilestone,
  milestoneChipDetail,
  milestoneHint,
  resolveMilestoneSettings,
  type MilestoneFormatters,
  type MilestoneSettings,
} from "@/entities/milestone";
import type { useMilestoneConfig } from "@/entities/milestone/api/use-milestone-config";
import { useI18n } from "@/shared/i18n";
import { formatDate, formatMoney, formatMonths, formatOrdinal, formatPercent, formatUsd, formatUsdCompact } from "@/shared/lib/format";
import { Callout } from "@/shared/ui/callout";
import { DescriptionList } from "@/shared/ui/description-list";
import { Button } from "@/shared/ui/kit/button";
import { Progress } from "@/shared/ui/kit/progress";
import { Skeleton } from "@/shared/ui/kit/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { StatusBadge } from "@/shared/ui/status-badge";

/** Every state of the card links to where the goal (target, age, birth date) is set. */
function EditGoalLink() {
  const { t } = useI18n();
  return (
    <Button asChild variant="ghost" size="sm">
      <Link href="/settings#milestone">
        <Pencil />
        {t.dashboard.milestone.editGoal}
      </Link>
    </Button>
  );
}

const FMT: MilestoneFormatters = {
  money: (n, o) => formatMoney(n, { signDisplay: o?.signed ? "always" : "auto" }),
  usd: formatUsd,
};

export function MilestoneCard({
  netWorth,
  monthlyNet,
  settings: rawSettings,
  configState,
}: {
  netWorth: number;
  monthlyNet: number;
  /** The user's `preferences.milestone`. */
  settings: MilestoneSettings | undefined;
  /** From `useMilestoneConfig()` (the dashboard shares it with the health card). */
  configState: ReturnType<typeof useMilestoneConfig>;
}) {
  const { config, error, reload } = configState;
  const { t } = useI18n();
  const m = t.dashboard.milestone;
  const settings = resolveMilestoneSettings(rawSettings);
  const heading = m.title({ target: formatUsdCompact(settings.targetUsd), age: settings.targetAge });

  if (error) {
    return (
      <Section title={heading}>
        <Callout tone="danger" title={m.loadError}>
          {error}
          <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
            <RotateCw />
            {t.common.retry}
          </Button>
        </Callout>
      </Section>
    );
  }

  if (!config) {
    return (
      <Section title={heading}>
        <div className="grid gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Section>
    );
  }

  const a = analyzeMilestone({ config, settings, currentNetWorth: netWorth, monthlyNetContribution: monthlyNet });
  const hint = milestoneHint(a, FMT, t.domain.milestone);

  if (a.kind === "incomplete") {
    return (
      <Section
        title={heading}
        description={m.description({ age: a.targetAge, ordinal: formatOrdinal(a.targetAge) })}
        actions={a.missing === "BIRTH_DATE" ? undefined : <EditGoalLink />}
      >
        <Callout tone="info" title={m.finishSetup}>
          {hint}
          {a.missing === "BIRTH_DATE" ? (
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/settings#milestone">
                <Settings />
                {m.openSettings}
              </Link>
            </Button>
          ) : null}
        </Callout>
      </Section>
    );
  }

  const badge =
    a.kind === "achieved"
      ? { tone: "success" as const, icon: CircleCheck, label: t.domain.milestone.targetMet }
      : a.kind === "past_deadline"
        ? { tone: "danger" as const, icon: TriangleAlert, label: t.domain.milestone.pastMilestone }
        : { tone: feasibilityToneMeta(a.tone).status, icon: feasibilityToneMeta(a.tone).icon, label: t.domain.milestone.verdict[a.verdict] };
  const detail = milestoneChipDetail(a, netWorth, FMT);

  return (
    <Section
      title={heading}
      description={
        a.kind === "projection" && a.annualRealRate > 0
          ? m.deadlineWithGrowth({ date: formatDate(a.deadline), rate: formatPercent(a.annualRealRate * 100) })
          : m.deadline({ date: formatDate(a.deadline) })
      }
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                <StatusBadge tone={badge.tone} icon={badge.icon}>
                  {badge.label}
                </StatusBadge>
              </span>
            </TooltipTrigger>
            {hint ? <TooltipContent>{hint}</TooltipContent> : null}
          </Tooltip>
          <EditGoalLink />
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight">
            <Money value={netWorth} compact className="normal-nums" />
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={a.pct} className="flex-1" />
            <span className="w-10 text-right text-xs font-medium tabular-nums">{a.pct}%</span>
          </div>
          {detail ? <p className="mt-1.5 text-xs text-muted-foreground">{m.vsTarget({ detail })}</p> : null}
        </div>
        <DescriptionList
          items={[
            {
              label: m.target,
              value: (
                <span>
                  <Money value={a.targetVnd} compact /> <span className="text-xs text-muted-foreground">≈ {formatUsd(a.targetUsd)}</span>
                </span>
              ),
            },
            ...(a.kind === "projection"
              ? [
                  { label: m.projectedAt({ age: a.targetAge }), value: <Money value={a.projectedEndingNetWorth} compact /> },
                  { label: m.timeLeft, value: formatMonths(a.monthsRemaining) },
                ]
              : []),
          ]}
        />
      </div>
    </Section>
  );
}
