"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { AllocateSourcesDialog } from "@/features/allocate-sources";
import {
  effectiveGoalSeedLineAmount,
  isAllInHolder,
  labelForSeedLine,
  type GoalProfile,
  type GoalSeedLine,
  type GoalStartingOption,
} from "@/entities/goal";
import { CategoryBadge, LiquidityBadge } from "@/entities/settings-asset/ui";
import { useI18n } from "@/shared/i18n";
import { EmptyState } from "@/shared/ui/empty-state";
import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";

type StartingBalancesCardProps = {
  draft: GoalProfile;
  savedPlans: GoalProfile[];
  seedOptions: GoalStartingOption[];
  total: number;
  onApply: (lines: GoalSeedLine[]) => Promise<void>;
};

export function StartingBalancesCard({ draft, savedPlans, seedOptions, total, onApply }: StartingBalancesCardProps) {
  const { t } = useI18n();
  const m = t.goals.starting;
  const [open, setOpen] = useState(false);
  const lines = draft.seedLines ?? [];

  return (
    <Section
      title={m.title}
      description={m.description}
      actions={
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil />
          {t.common.edit}
        </Button>
      }
      flush
    >
      {lines.length === 0 ? (
        <EmptyState
          title={m.emptyTitle}
          description={m.emptyDescription}
          className="py-8"
          action={
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Plus />
              {m.allocateSources}
            </Button>
          }
        />
      ) : (
        <>
          <ul className="divide-y">
            {lines.map((line) => {
              const option = seedOptions.find((o) => o.key === line.sourceKey);
              const allIn = isAllInHolder(line, savedPlans, draft);
              return (
                <li key={line.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{labelForSeedLine(line, seedOptions)}</p>
                    {option?.category || option?.liquidity || allIn ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {option?.category ? <CategoryBadge category={option.category} /> : null}
                        {option?.liquidity ? <LiquidityBadge liquidity={option.liquidity} /> : null}
                        {allIn ? <Badge variant="info">{t.goals.allocate.allInBadge}</Badge> : null}
                      </div>
                    ) : null}
                  </div>
                  <Money value={effectiveGoalSeedLineAmount(line, seedOptions, savedPlans, draft)} className="text-sm font-medium" />
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-5 py-3 text-sm font-medium">
            <span>{m.combined}</span>
            <Money value={total} />
          </div>
        </>
      )}

      <AllocateSourcesDialog
        open={open}
        onOpenChange={setOpen}
        title={m.title}
        description={m.dialogDescription}
        profile={draft}
        savedPlans={savedPlans}
        seedOptions={seedOptions}
        applyLabel={m.applyToPlan}
        allowAllIn
        onApply={onApply}
      />
    </Section>
  );
}
