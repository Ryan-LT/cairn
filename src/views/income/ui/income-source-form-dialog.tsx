"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Coins, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { AllocateSourcesDialog } from "@/features/allocate-sources";
import type { GoalProfile, GoalSeedLine, GoalStartingOption } from "@/entities/goal";
import { totalCapitalAmount, wrapIncomeSourceAsProfile, type IncomeSource } from "@/entities/income";
import { useI18n, type Messages } from "@/shared/i18n";
import { useCurrency } from "@/shared/lib/currency/provider";
import { todayIso } from "@/shared/lib/date";
import { AccountSelect } from "@/entities/settings-asset/ui";
import { DayOfMonthField, MoneyField, SegmentedField, SelectField, SwitchField, TextField } from "@/shared/ui/form";
import { ICON_OPTIONS, RegistryIcon } from "@/shared/ui/icon-registry";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/kit/form";
import { Label } from "@/shared/ui/kit/label";
import { Money } from "@/shared/ui/money";

const makeSchema = (t: Messages) =>
  z.object({
    kind: z.enum(["active", "passive"]),
    name: z.string().trim().min(1, t.income.form.nameRequired).max(80),
    details: z.string().max(160),
    icon: z.string(),
    monthly: z.number().min(0),
    currency: z.enum(["VND", "USD"]),
    accountId: z.string().optional(),
    autoReceive: z.boolean(),
    paymentEntity: z.string().max(80).optional(),
    paymentDay: z.number().int().min(1).max(31).optional(),
  });

type Values = z.infer<ReturnType<typeof makeSchema>>;

type IncomeSourceFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  source: IncomeSource | null;
  /** Other income sources wrapped as plans (their capital caps this one). */
  peers: GoalProfile[];
  seedOptions: GoalStartingOption[];
  onSubmit: (source: IncomeSource) => void;
};

export function IncomeSourceFormDialog({ open, onOpenChange, source, ...rest }: IncomeSourceFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {source ? (
          <IncomeSourceForm
            key={source.id}
            source={source}
            onCancel={() => onOpenChange(false)}
            {...rest}
            onSubmit={(next) => {
              rest.onSubmit(next);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function IncomeSourceForm({
  mode,
  source,
  peers,
  seedOptions,
  onCancel,
  onSubmit,
}: Omit<IncomeSourceFormDialogProps, "open" | "onOpenChange" | "source"> & { source: IncomeSource; onCancel: () => void }) {
  const { t } = useI18n();
  const rate = useCurrency()?.rates.vndPerUsd ?? null;
  const [capitalLines, setCapitalLines] = useState<GoalSeedLine[]>(source.capitalLines ?? []);
  const [capitalOpen, setCapitalOpen] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(makeSchema(t)),
    defaultValues: {
      kind: source.kind,
      name: source.name,
      details: source.details,
      icon: source.icon || "work",
      // Paid in USD: the field holds dollars.
      monthly: source.amountUsd ?? source.monthly,
      currency: source.amountUsd ? "USD" : "VND",
      accountId: source.accountId,
      autoReceive: source.autoReceive ?? false,
      paymentEntity: source.paymentEntity ?? "",
      paymentDay: source.paymentDay,
    },
  });

  const name = useWatch({ control: form.control, name: "name" });
  const currency = useWatch({ control: form.control, name: "currency" });
  const iconOptions = useMemo(() => {
    const opts = ICON_OPTIONS.map((o) => ({
      value: o.value,
      label: (
        <span className="flex items-center gap-2">
          <o.icon className="size-4 text-muted-foreground" />
          {o.label}
        </span>
      ),
    }));
    // Keep an unknown stored key selectable so editing never silently changes it.
    if (source.icon && !ICON_OPTIONS.some((o) => o.value === source.icon)) {
      opts.push({
        value: source.icon,
        label: (
          <span className="flex items-center gap-2">
            <RegistryIcon name={source.icon} className="text-muted-foreground" />
            {source.icon}
          </span>
        ),
      });
    }
    return opts;
  }, [source.icon]);

  const capitalTotal = totalCapitalAmount(capitalLines);
  const capitalProfile = useMemo(
    () => wrapIncomeSourceAsProfile({ ...source, name: name || source.name, capitalLines }),
    [source, name, capitalLines],
  );

  return (
    <Form {...form}>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={form.handleSubmit(({ currency: cur, monthly, accountId, autoReceive, ...v }) => {
          const usd = cur === "USD" ? Math.round(monthly * 100) / 100 : undefined;
          // VND at today's rate (the last saved amount if no rate is known).
          const vnd = usd === undefined ? monthly : rate ? Math.round(usd * rate) : source.monthly;
          // Automatic recording starts with the month it's turned on.
          const autoSince = autoReceive ? (source.autoReceive && source.autoSince ? source.autoSince : `${todayIso().slice(0, 7)}-01`) : undefined;
          onSubmit({ ...source, ...v, monthly: vnd, amountUsd: usd, accountId: accountId || undefined, autoReceive: autoReceive || undefined, autoSince, capitalLines });
        })}
      >
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t.income.form.addTitle : t.income.form.editTitle}</DialogTitle>
          <DialogDescription>{t.income.form.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <SegmentedField
            control={form.control}
            name="kind"
            label={t.income.form.type}
            options={[
              { value: "active", label: t.income.active },
              { value: "passive", label: t.income.passive },
            ]}
          />
          <TextField control={form.control} name="name" label={t.income.form.name} placeholder={t.income.form.namePlaceholder} autoFocus={mode === "create"} />
          <TextField control={form.control} name="details" label={t.income.form.details} placeholder={t.income.form.detailsPlaceholder} />
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              control={form.control}
              name="monthly"
              label={t.income.form.monthly}
              currency={currency}
              onCurrencyChange={(c) => form.setValue("currency", c)}
            />
            <SelectField control={form.control} name="icon" label={t.income.form.icon} options={iconOptions} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t.income.form.capital}</Label>
            <Button type="button" variant="outline" className="justify-between font-normal" onClick={() => setCapitalOpen(true)}>
              <span className="flex min-w-0 items-center gap-2">
                <Coins className="text-muted-foreground" />
                {capitalTotal > 0 ? (
                  <span className="truncate">
                    <Money value={capitalTotal} />
                    {t.income.form.capitalFrom({ count: capitalLines.length })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t.income.form.capitalEmpty}</span>
                )}
              </span>
              <Pencil className="text-muted-foreground" />
            </Button>
            <p className="text-xs text-muted-foreground">{t.income.form.capitalHint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField control={form.control} name="paymentEntity" label={t.income.form.paidBy} placeholder={t.income.form.paidByPlaceholder} />
            <DayOfMonthField control={form.control} name="paymentDay" label={t.income.form.paymentDay} />
          </div>
          <FormField
            control={form.control}
            name="accountId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.ledger.account.into}</FormLabel>
                <FormControl>
                  <AccountSelect value={field.value} onChange={field.onChange} />
                </FormControl>
                <p className="text-xs text-muted-foreground">{t.ledger.account.hintIncome}</p>
              </FormItem>
            )}
          />
          <SwitchField control={form.control} name="autoReceive" label={t.ledger.timing.autoReceive} description={t.ledger.timing.autoReceiveHint} />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{mode === "create" ? t.income.form.submitAdd : t.common.saveChanges}</Button>
        </DialogFooter>
      </form>

      <AllocateSourcesDialog
        open={capitalOpen}
        onOpenChange={setCapitalOpen}
        title={t.income.capitalDialog.title}
        description={t.income.capitalDialog.description}
        profile={capitalProfile}
        savedPlans={peers}
        seedOptions={seedOptions}
        applyLabel={t.income.capitalDialog.apply}
        subject={t.income.capitalDialog.subject}
        onApply={(lines) => setCapitalLines(lines)}
      />
    </Form>
  );
}
