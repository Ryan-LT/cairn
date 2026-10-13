"use client";

import { Plus } from "lucide-react";
import { useMemo } from "react";

import { buildGoalPlanStatuses, type GoalPlanWithStatus, type GoalStartingOption, type GoalsState } from "@/entities/goal";
import { GoalStatusBadge } from "@/entities/goal/ui";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatPercent } from "@/shared/lib/format";
import { Card } from "@/shared/ui/kit/card";
import { Money } from "@/shared/ui/money";
import { ProgressRing } from "@/shared/ui/progress-ring";

type PlanListProps = {
  goals: GoalsState;
  seedOptions: GoalStartingOption[];
  monthlyNet: number;
  activeId: string;
  isComposingNew: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
};

function usePlanRows(goals: GoalsState, seedOptions: GoalStartingOption[], monthlyNet: number) {
  return useMemo(() => buildGoalPlanStatuses(goals, seedOptions, monthlyNet), [goals, seedOptions, monthlyNet]);
}

function ringTone(row: GoalPlanWithStatus) {
  return row.status.tone === "success" ? "success" : row.status.tone === "danger" ? "danger" : row.status.tone === "warning" ? "warning" : "primary";
}

function PlanButton({ row, active, onSelect, compact }: { row: GoalPlanWithStatus; active: boolean; onSelect: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const pct = formatPercent(Math.min(999, row.status.progress * 100), { maximumFractionDigits: 0 });
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring",
        active ? "border-primary/50 bg-primary-soft hover:bg-primary-soft" : "border-transparent",
        compact && "h-full border-border bg-card",
        compact && active && "border-primary bg-primary-soft",
      )}
    >
      <ProgressRing value={row.status.progress} size={44} stroke={5} tone={ringTone(row)} label={t.goals.hero.ringLabel({ pct })}>
        <span className="text-xs">{pct}</span>
      </ProgressRing>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="truncate text-sm font-medium">{row.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          <Money value={row.targetAmount} compact interactive={false} />
          {row.targetDate ? ` · ${formatDate(row.targetDate, "monthYear")}` : ""}
        </span>
        <GoalStatusBadge status={row.status} />
      </span>
    </button>
  );
}

/** Desktop list of plans (sticky beside the plan). */
export function PlanList({ goals, seedOptions, monthlyNet, activeId, isComposingNew, onSelect }: PlanListProps) {
  const { t } = useI18n();
  const rows = usePlanRows(goals, seedOptions, monthlyNet);
  return (
    <Card className="gap-0 py-2">
      <p className="px-4 pt-2 pb-2 text-xs font-medium text-muted-foreground">{t.goals.list.count({ count: goals.profiles.length })}</p>
      <ul className="grid gap-1 px-2">
        {isComposingNew ? (
          <li>
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary-soft px-3 py-3 text-sm font-medium text-primary-soft-foreground" aria-current="true">
              {t.goals.list.newPlanUnsaved}
            </div>
          </li>
        ) : null}
        {rows.map((r) => (
          <li key={r.key}>
            <PlanButton row={r} active={!isComposingNew && r.planId === activeId} onSelect={() => r.planId && onSelect(r.planId)} />
          </li>
        ))}
      </ul>
      {rows.length === 0 && !isComposingNew ? <p className="px-4 py-3 text-sm text-muted-foreground">{t.goals.list.empty}</p> : null}
    </Card>
  );
}

/** Phones and narrow screens: plans as a row of cards you swipe through. */
export function PlanSwitcher({ goals, seedOptions, monthlyNet, activeId, isComposingNew, onSelect, onNew }: PlanListProps) {
  const { t } = useI18n();
  const rows = usePlanRows(goals, seedOptions, monthlyNet);
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1" aria-label={t.goals.list.choosePlan}>
      {rows.map((r) => (
        <li key={r.key} className="w-64 shrink-0 snap-start">
          <PlanButton compact row={r} active={!isComposingNew && r.planId === activeId} onSelect={() => r.planId && onSelect(r.planId)} />
        </li>
      ))}
      <li className="w-40 shrink-0 snap-start">
        <button
          type="button"
          onClick={onNew}
          aria-pressed={isComposingNew}
          className={cn(
            "flex h-full min-h-20 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring",
            isComposingNew && "border-primary bg-primary-soft text-primary-soft-foreground",
          )}
        >
          <Plus className="size-4" aria-hidden />
          {isComposingNew ? t.goals.list.newPlanUnsaved : t.goals.list.newPlan}
        </button>
      </li>
    </ul>
  );
}
