"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import type { GoalProfile } from "@/entities/goal";
import { useI18n } from "@/shared/i18n";
import { toIsoDay } from "@/shared/lib/date";
import { formatDate, formatPercent } from "@/shared/lib/format";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { DescriptionList } from "@/shared/ui/description-list";
import { Callout } from "@/shared/ui/callout";
import { DateField, MoneyField, PercentField, SegmentedField, SwitchField, TextField } from "@/shared/ui/form";
import { Button } from "@/shared/ui/kit/button";
import { Form } from "@/shared/ui/kit/form";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { StatusBadge } from "@/shared/ui/status-badge";

const makeSchema = (nameRequired: string) => z.object({
  name: z.string().trim().min(1, nameRequired).max(80),
  targetAmount: z.number().min(0),
  targetDate: z.string(),
  includeMonthlyIncome: z.boolean(),
  shareMode: z.enum(["auto", "custom"]),
  sharePct: z.number().min(0).max(100),
  expectedReturnPct: z.number().min(0).max(30),
});

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/** What the plan stores: an explicit share only in "custom" mode, a return only when > 0. */
type Values = {
  name: string;
  targetAmount: number;
  targetDate: string;
  includeMonthlyIncome: boolean;
  monthlySharePct?: number;
  expectedReturnPct?: number;
};

function toPlanValues(v: Partial<FormValues>): Values {
  return {
    name: v.name ?? "",
    targetAmount: v.targetAmount ?? 0,
    targetDate: v.targetDate ?? "",
    includeMonthlyIncome: v.includeMonthlyIncome !== false,
    monthlySharePct: v.shareMode === "custom" ? (v.sharePct ?? 0) : undefined,
    expectedReturnPct: (v.expectedReturnPct ?? 0) > 0 ? v.expectedReturnPct : undefined,
  };
}

export type PlanShares = {
  /** Fraction of monthly net this plan gets now. */
  share: number;
  /** Explicit shares across plans add up to more than 100 %. */
  overAllocated: boolean;
  /** Other plans that include monthly income. */
  otherPlans: number;
  /** The even-split share this plan would get without an explicit %. */
  automatic: number;
};

const pct = (fraction: number) => formatPercent(fraction * 100, { maximumFractionDigits: 0 });

type PlanDetailsCardProps = {
  draft: GoalProfile;
  /** Opens directly in edit mode (new plans). */
  startEditing: boolean;
  incomeMonthly: number;
  householdMonthlyNet: number;
  shares: PlanShares;
  /** Live preview while editing (KPIs and chart update before saving). */
  onPreview: (values: Values) => void;
  onCancel: () => void;
  onSave: (values: Values) => Promise<void>;
};

export function PlanDetailsCard({ draft, startEditing, incomeMonthly, householdMonthlyNet, shares, onPreview, onCancel, onSave }: PlanDetailsCardProps) {
  const { t } = useI18n();
  const d = t.goals.details;
  const [editing, setEditing] = useState(startEditing);
  const includes = draft.includeMonthlyIncome !== false;

  return (
    <Section
      title={d.title}
      description={d.description}
      actions={
        editing ? null : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            {t.common.edit}
          </Button>
        )
      }
    >
      {editing ? (
        <DetailsForm
          draft={draft}
          incomeMonthly={incomeMonthly}
          householdMonthlyNet={householdMonthlyNet}
          shares={shares}
          onPreview={onPreview}
          onCancel={() => {
            onCancel();
            setEditing(false);
          }}
          onSave={async (v) => {
            await onSave(v);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <DescriptionList
            items={[
              { label: d.name, value: draft.name.trim() || <span className="text-muted-foreground">{t.common.untitledPlan}</span> },
              { label: d.targetAmount, value: draft.targetAmount > 0 ? <Money value={draft.targetAmount} /> : "—" },
              { label: d.targetDate, value: draft.targetDate ? formatDate(draft.targetDate) : "—" },
              {
                label: d.monthlyIncome,
                value: includes ? <StatusBadge tone="success" dot>{t.goals.status.included}</StatusBadge> : <StatusBadge dot>{t.goals.status.excluded}</StatusBadge>,
                hint: includes ? (
                  <>
                    {d.incomeHint.before}
                    <Money value={incomeMonthly} />
                    {d.incomeHint.middle}
                    <Money value={householdMonthlyNet} signed tone="auto" />
                    {d.incomeHint.after}
                  </>
                ) : (
                  d.startingOnlyHint
                ),
              },
              ...(includes
                ? [
                    {
                      label: d.share,
                      value: (
                        <span>
                          {pct(shares.share)} · <Money value={householdMonthlyNet * shares.share} signed tone="auto" /> {t.common.perMonth}
                        </span>
                      ),
                      hint:
                        draft.monthlySharePct === undefined
                          ? shares.otherPlans > 0
                            ? d.shareAutoSplit
                            : d.shareAutoOnly
                          : d.shareSetByYou,
                    },
                  ]
                : []),
              {
                label: d.expectedReturn,
                value: (draft.expectedReturnPct ?? 0) > 0 ? formatPercent(draft.expectedReturnPct!) : t.common.none,
                hint: (draft.expectedReturnPct ?? 0) > 0 ? d.compounded : d.asCash,
              },
            ]}
          />
          {includes && shares.overAllocated ? (
            <Callout tone="warning" title={d.overAllocatedTitle} className="mt-3">
              {d.overAllocatedBody}
            </Callout>
          ) : null}
        </>
      )}
    </Section>
  );
}

function DetailsForm({
  draft,
  incomeMonthly,
  householdMonthlyNet,
  shares,
  onPreview,
  onCancel,
  onSave,
}: Omit<PlanDetailsCardProps, "startEditing"> & { draft: GoalProfile }) {
  const { t } = useI18n();
  const f = t.goals.details.form;
  const form = useForm<FormValues>({
    resolver: zodResolver(makeSchema(t.goals.details.form.planNameRequired)),
    defaultValues: {
      name: draft.name,
      targetAmount: draft.targetAmount,
      targetDate: draft.targetDate ?? "",
      includeMonthlyIncome: draft.includeMonthlyIncome !== false,
      shareMode: draft.monthlySharePct === undefined ? "auto" : "custom",
      sharePct: draft.monthlySharePct ?? Math.round(shares.automatic * 100),
      expectedReturnPct: draft.expectedReturnPct ?? 0,
    },
  });

  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values: v }) => onPreview(toPlanValues(v)),
      }),
    [form, onPreview],
  );

  const includeIncome = useWatch({ control: form.control, name: "includeMonthlyIncome" });
  const shareMode = useWatch({ control: form.control, name: "shareMode" });

  return (
    <Form {...form}>
      <form className="grid gap-4" onSubmit={form.handleSubmit((v) => onSave(toPlanValues(v)))}>
        <TextField control={form.control} name="name" label={f.planName} placeholder={f.planNamePlaceholder} autoFocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyField control={form.control} name="targetAmount" label={f.targetAmount} />
          <div className="grid gap-2">
            <DateField control={form.control} name="targetDate" label={f.targetDate} placeholder={f.pickDate} />
            <div className="flex flex-wrap gap-1.5">
              {([1, 3, 5] as const).map((years) => (
                <Button
                  key={years}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-full px-2.5 text-xs"
                  onClick={() => {
                    const d = new Date();
                    form.setValue("targetDate", toIsoDay(new Date(d.getFullYear() + years, d.getMonth(), d.getDate())), { shouldDirty: true });
                  }}
                >
                  {t.goals.datePresets[`y${years}`]}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <SwitchField
          control={form.control}
          name="includeMonthlyIncome"
          label={f.includeIncomeShort}
          description={
            <>
              {f.includeIncomeDescription.before}
              <Money value={householdMonthlyNet} signed />
              {f.includeIncomeDescription.middle}
              <Money value={incomeMonthly} />
              {f.includeIncomeDescription.after}
            </>
          }
        />
        {includeIncome ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SegmentedField
              control={form.control}
              name="shareMode"
              label={f.share}
              options={[
                { value: "auto", label: f.splitEvenly },
                { value: "custom", label: f.setPct },
              ]}
              description={
                shareMode === "auto"
                  ? f.autoDescription({ pct: pct(shares.automatic) })
                  : f.customDescription
              }
            />
            {shareMode === "custom" ? (
              <PercentField control={form.control} name="sharePct" label={f.thisPlanShare} description={<>{f.ofPerMonth.before}<Money value={householdMonthlyNet} signed />{f.ofPerMonth.after}</>} />
            ) : null}
          </div>
        ) : null}
        <PercentField
          control={form.control}
          name="expectedReturnPct"
          label={f.expectedReturn}
          description={f.expectedReturnDescription}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={form.formState.isSubmitting}>
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
            {f.savePlan}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * The one place to edit a plan's details (and to start a new plan). Changes
 * preview live behind the dialog; closing without saving puts them back.
 */
export function PlanDetailsDialog({
  open,
  onOpenChange,
  isNew,
  ...rest
}: Omit<PlanDetailsCardProps, "startEditing"> & { open: boolean; onOpenChange: (open: boolean) => void; isNew: boolean }) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) rest.onCancel();
        onOpenChange(o);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isNew ? t.goals.newPlanTitle : t.goals.editPlan}</DialogTitle>
          <DialogDescription>{isNew ? t.goals.newPlanDescription : t.goals.details.description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {open ? (
            <DetailsForm
              {...rest}
              onCancel={() => {
                rest.onCancel();
                onOpenChange(false);
              }}
              onSave={async (v) => {
                await rest.onSave(v);
                onOpenChange(false);
              }}
            />
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
