"use client";

import { CalendarClock, Hourglass, MoreHorizontal, Pencil, Trash2, TrendingUp, Wallet } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  computeGoalProjection,
  profilesWithDraft,
  resolveGoalStatus,
  resolveMonthlyShares,
  revertPlanSection,
  setCheckpointPaid,
  totalGoalStartingBalance,
  type GoalProfile,
  type GoalStatus,
} from "@/entities/goal";
import { GoalStatusBadge } from "@/entities/goal/ui";
import { useI18n, type Messages } from "@/shared/i18n";
import { formatDate, formatMoneyCompact, formatMonths, formatPercent } from "@/shared/lib/format";
import { Callout } from "@/shared/ui/callout";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { Money } from "@/shared/ui/money";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";

import type { GoalPlanEditor } from "../model/use-goal-plan-editor";
import { CheckpointsCard } from "./checkpoints-card";
import { PlanDetailsDialog } from "./plan-details-card";
import { ProjectionCard, StartingOnlyCard } from "./projection-card";
import { StartingBalancesCard } from "./starting-balances-card";

/** One plain sentence: what this plan needs (or has) right now. */
function statusSentence(t: Messages, s: GoalStatus, target: number): string {
  const h = t.goals.hero;
  switch (s.code) {
    case "no_target":
      return h.noTarget;
    case "achieved":
      return h.reached;
    case "on_track": {
      const spare = s.projectedAtTarget - target;
      return spare > target * 0.01 ? h.ahead({ amount: formatMoneyCompact(spare) }) : h.onTarget;
    }
    case "close":
    case "behind":
      return h.needMore({ amount: formatMoneyCompact(s.extraNeeded) });
    case "no_savings":
      return h.noSavings({ amount: formatMoneyCompact(s.requiredMonthly ?? 0) });
    case "past_due":
      return h.pastDue({ gap: formatMoneyCompact(s.gap) });
    default:
      return h.noDate;
  }
}

const RING_TONE = { success: "success", warning: "warning", danger: "danger", info: "primary", neutral: "primary" } as const;

/**
 * One plan, read first: progress and what it needs, the projection, then its
 * money and payment dates. Details are edited in one dialog with one save.
 * Mounted with `key={activeProfileId}` so the draft resets per plan.
 */
export function PlanWorkspace({ editor }: { editor: GoalPlanEditor }) {
  const { t } = useI18n();
  const g = t.goals;
  const { goals, savedProfile, seedOptions, incomeMonthly, householdMonthlyNet, isComposingNew, persistPlan, deletePlan, selectPlan } = editor;
  const [draft, setDraft] = useState<GoalProfile>(savedProfile);
  const [editing, setEditing] = useState(isComposingNew);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const startingBalance = useMemo(() => totalGoalStartingBalance(draft.seedLines, seedOptions, goals.profiles, draft), [draft, seedOptions, goals.profiles]);
  // This plan's slice of the monthly net, with the draft's share in place of the saved one.
  const shares = useMemo(() => {
    const all = profilesWithDraft(goals.profiles, draft);
    const resolved = resolveMonthlyShares(all);
    const key = draft.id || "__draft__";
    const others = all.filter((p) => p.id !== key && p.includeMonthlyIncome !== false);
    return {
      share: resolved.byPlan.get(key) ?? 0,
      overAllocated: resolved.overAllocated,
      otherPlans: others.length,
      automatic: resolveMonthlyShares(profilesWithDraft(goals.profiles, { ...draft, monthlySharePct: undefined })).byPlan.get(key) ?? 0,
    };
  }, [goals.profiles, draft]);
  const projection = useMemo(
    () =>
      computeGoalProjection({
        startingBalance,
        targetAmount: draft.targetAmount,
        targetDateIso: draft.targetDate,
        includeMonthlyIncome: draft.includeMonthlyIncome,
        incomeMonthly,
        householdMonthlyNet,
        monthlyShare: shares.share,
        expectedReturnPct: draft.expectedReturnPct,
      }),
    [startingBalance, draft.targetAmount, draft.targetDate, draft.includeMonthlyIncome, draft.expectedReturnPct, incomeMonthly, householdMonthlyNet, shares.share],
  );
  const status = useMemo(
    () =>
      resolveGoalStatus({
        startingBalance,
        targetAmount: draft.targetAmount,
        targetDateIso: draft.targetDate,
        includeMonthlyIncome: draft.includeMonthlyIncome,
        householdMonthlyNet,
        monthlyShare: shares.share,
        expectedReturnPct: draft.expectedReturnPct,
      }),
    [startingBalance, draft.targetAmount, draft.targetDate, draft.includeMonthlyIncome, draft.expectedReturnPct, householdMonthlyNet, shares.share],
  );

  const save = useCallback(
    async (next: GoalProfile, message: string) => {
      setDraft(next);
      const ok = await persistPlan(next);
      if (ok) toast.success(message);
      else toast.warning(g.workspace.toasts.savedLocally, { description: g.workspace.toasts.savedLocallyDescription });
    },
    [persistPlan, g],
  );

  const preview = useCallback(
    (v: { name: string; targetAmount: number; targetDate: string; includeMonthlyIncome: boolean; monthlySharePct?: number; expectedReturnPct?: number }) =>
      setDraft((d) => ({ ...d, ...v })),
    [],
  );

  const cancelDetails = () => {
    setDraft((d) => revertPlanSection(revertPlanSection(d, savedProfile, "basics"), savedProfile, "income"));
    // Backing out of a new plan returns to the first saved one.
    if (isComposingNew && goals.profiles.length) selectPlan(goals.profiles[0].id);
  };

  const displayName = draft.name.trim() || (isComposingNew ? g.list.newPlan : t.common.untitledPlan);
  const pct = formatPercent(Math.min(999, status.progress * 100), { maximumFractionDigits: 0 });

  const dialog = (
    <PlanDetailsDialog
      open={editing}
      onOpenChange={setEditing}
      isNew={isComposingNew}
      draft={draft}
      incomeMonthly={incomeMonthly}
      householdMonthlyNet={householdMonthlyNet}
      shares={shares}
      onPreview={preview}
      onCancel={cancelDetails}
      onSave={(v) => save({ ...draft, ...v }, isComposingNew ? g.workspace.toasts.planCreated : g.workspace.toasts.planSaved)}
    />
  );

  if (isComposingNew && !editing && goals.profiles.length === 0) {
    return (
      <Card className="gap-0 py-0">
        <EmptyState
          illustrated
          title={g.newPlanTitle}
          description={g.newPlanDescription}
          action={
            <Button onClick={() => setEditing(true)}>
              <Pencil />
              {g.newPlanTitle}
            </Button>
          }
        />
        {dialog}
      </Card>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{displayName}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {isComposingNew ? null : <GoalStatusBadge status={status} />}
            {draft.targetDate ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden /> {g.workspace.targetDate({ date: formatDate(draft.targetDate) })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            <span className="max-sm:sr-only">{g.editPlan}</span>
          </Button>
          {!isComposingNew ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={g.workspace.planActions}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 />
                  {g.workspace.deletePlan}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <Card className="bg-hero gap-3 px-5">
        <div className="flex items-center gap-4 md:gap-6">
          <ProgressRing value={status.progress} size={84} stroke={9} tone={RING_TONE[status.tone]} complete={status.progress >= 1} label={g.hero.ringLabel({ pct })}>
            <span className="text-sm">{pct}</span>
          </ProgressRing>
          <div className="grid min-w-0 flex-1 gap-1">
            <p className="text-sm text-muted-foreground">{g.hero.setAside}</p>
            <p className="text-display font-semibold">
              <Money value={startingBalance} compact />
              {draft.targetAmount > 0 ? (
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  {g.hero.ofPrefix}
                  <Money value={draft.targetAmount} compact interactive={false} />
                </span>
              ) : null}
            </p>
            <p className="text-sm" data-private>
              {statusSentence(t, status, draft.targetAmount)}
            </p>
          </div>
        </div>
      </Card>

      <StatGrid className="xl:grid-cols-3">
        <StatCard
          label={g.workspace.kpi.projected}
          icon={TrendingUp}
          value={<Money value={projection.projectedAtTarget} compact />}
          hint={draft.targetAmount > 0 ? <Money value={projection.projectedAtTarget - draft.targetAmount} compact signed tone="auto" /> : g.workspace.kpi.setTarget}
          aside={draft.targetAmount > 0 ? <span>{g.workspace.kpi.vsTarget}</span> : null}
        />
        <StatCard
          label={g.workspace.kpi.monthly}
          icon={Wallet}
          value={projection.applyMonthlyIncome ? <Money value={projection.effectiveMonthlyContribution} compact signed tone="auto" /> : g.status.excluded}
          hint={projection.applyMonthlyIncome ? g.workspace.kpi.shareOfSavings({ pct: formatPercent(projection.monthlyShare * 100, { maximumFractionDigits: 0 }) }) : null}
        />
        <StatCard
          className="max-xl:col-span-2"
          label={g.hero.timeLeft}
          icon={Hourglass}
          value={projection.pastDue ? g.status.datePassed : draft.targetDate ? formatMonths(projection.monthsToTarget) : "—"}
          hint={draft.targetDate ? g.workspace.kpi.byDate({ date: formatDate(draft.targetDate) }) : g.workspace.kpi.noDate}
        />
      </StatGrid>

      {projection.applyMonthlyIncome && shares.overAllocated ? (
        <Callout tone="warning" title={g.details.overAllocatedTitle}>
          {g.details.overAllocatedBody}
        </Callout>
      ) : null}

      {projection.applyMonthlyIncome ? (
        <ProjectionCard
          targetAmount={draft.targetAmount}
          startingAmount={startingBalance}
          monthlyNetContribution={projection.effectiveMonthlyContribution}
          monthsToTarget={projection.monthsToTarget}
          targetDateIso={draft.targetDate}
          checkpoints={draft.checkpoints ?? []}
          annualReturn={projection.annualReturn}
        />
      ) : (
        <StartingOnlyCard startingBalance={startingBalance} targetAmount={draft.targetAmount} />
      )}

      {isComposingNew ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">{g.saveFirst}</p>
      ) : (
        <div className="grid gap-4 md:gap-6 2xl:grid-cols-2">
          <StartingBalancesCard
            draft={draft}
            savedPlans={goals.profiles}
            seedOptions={seedOptions}
            total={startingBalance}
            onApply={(seedLines) => save({ ...draft, seedLines }, g.workspace.toasts.startingSaved)}
          />
          <CheckpointsCard
            checkpoints={draft.checkpoints ?? []}
            onApply={(checkpoints) => save({ ...draft, checkpoints }, g.workspace.toasts.checkpointsSaved)}
            onTogglePaid={(id, paid) => save({ ...draft, checkpoints: setCheckpointPaid(draft.checkpoints ?? [], id, paid) }, paid ? g.workspace.toasts.markedPaid : g.workspace.toasts.markedUnpaid)}
          />
        </div>
      )}

      {dialog}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={g.workspace.deleteDialog.title}
        destructive
        description={g.workspace.deleteDialog.description({ name: savedProfile.name || t.common.untitledPlan })}
        onConfirm={() => {
          deletePlan(savedProfile.id);
          toast.success(g.workspace.toasts.planDeleted, { description: savedProfile.name });
        }}
      />
    </div>
  );
}
