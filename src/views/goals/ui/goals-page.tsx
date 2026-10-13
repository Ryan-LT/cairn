"use client";

import { Plus } from "lucide-react";

import { useI18n } from "@/shared/i18n";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { Button } from "@/shared/ui/kit/button";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { useGoalPlanEditor } from "../model/use-goal-plan-editor";
import { PlanList, PlanSwitcher } from "./plan-list";
import { PlanWorkspace } from "./plan-workspace";

export function GoalsPage() {
  const { t } = useI18n();
  const editor = useGoalPlanEditor();
  const { goals, seedOptions, householdMonthlyNet, isComposingNew, selectPlan, startNewPlan, savedProfile } = editor;
  useCreateParam(startNewPlan);

  const listProps = {
    goals,
    seedOptions,
    monthlyNet: householdMonthlyNet,
    activeId: savedProfile.id,
    isComposingNew,
    onSelect: selectPlan,
    onNew: startNewPlan,
  };

  return (
    <TabContent>
      <TabToolbar
        actions={
        <Button onClick={startNewPlan} disabled={isComposingNew}>
          <Plus />
          {t.goals.page.newPlan}
        </Button>
        }
      />
      <div className="xl:hidden">
        <PlanSwitcher {...listProps} />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="sticky top-6 hidden xl:block" aria-label={t.goals.page.plansAria}>
          <PlanList {...listProps} />
        </aside>
        <PlanWorkspace key={goals.activeProfileId || savedProfile.id || "new"} editor={editor} />
      </div>
    </TabContent>
  );
}
