"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import type { Debt } from "@/entities/debt";
import {
  CategoryTile,
  EXPENSE_CATEGORY_IDS,
  EXPENSE_CATEGORY_META,
  EXPENSE_FREQUENCIES,
  type ExpenseCategoryId,
  type ExpenseItem,
} from "@/entities/expense";
import { useI18n } from "@/shared/i18n";
import { useCurrency } from "@/shared/lib/currency/provider";
import { cn } from "@/shared/lib/cn";
import { DayOfMonthField, MoneyField, SegmentedField, SelectField, SwitchField, TextField } from "@/shared/ui/form";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/shared/ui/kit/form";

const NONE = "_none";

const schema = z.object({
  name: z.string().trim().max(80),
  category: z.enum(EXPENSE_CATEGORY_IDS),
  kind: z.enum(["bill", "budget"]),
  amount: z.number().min(0),
  currency: z.enum(["VND", "USD"]),
  frequency: z.enum(EXPENSE_FREQUENCIES),
  dueDay: z.number().int().min(1).max(31).optional(),
  dueMonth: z.string(),
  dueWeekday: z.string(),
  debtId: z.string(),
  autopay: z.boolean(),
  essential: z.boolean(),
  note: z.string().max(200),
  paused: z.boolean(),
});

type Values = z.infer<typeof schema>;

export type ExpenseFormResult = {
  item: ExpenseItem;
  /** Set when the linked debt's monthly payment should change to this amount (the debt holds the amount). */
  debtPayment?: { debtId: string; monthlyPayment: number };
};

type ExpenseFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  item: ExpenseItem | null;
  debts: Debt[];
  onSubmit: (result: ExpenseFormResult) => void;
  onDelete?: (item: ExpenseItem) => void;
};

/** Add or edit one bill / budget (bottom sheet on phones). */
export function ExpenseFormSheet({ open, onOpenChange, item, ...rest }: ExpenseFormSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {item ? (
          <ExpenseForm
            key={item.id}
            item={item}
            {...rest}
            onCancel={() => onOpenChange(false)}
            onSubmit={(r) => {
              rest.onSubmit(r);
              onOpenChange(false);
            }}
            onDelete={
              rest.onDelete
                ? (i) => {
                    onOpenChange(false);
                    rest.onDelete?.(i);
                  }
                : undefined
            }
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryGrid({ value, onChange }: { value: ExpenseCategoryId; onChange: (v: ExpenseCategoryId) => void }) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
      {EXPENSE_CATEGORY_IDS.map((id) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center text-xs leading-tight transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
              selected ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-transparent hover:bg-accent",
            )}
          >
            <CategoryTile category={id} size="sm" />
            <span className="line-clamp-2">{t.expenses.categories[id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function ExpenseForm({
  mode,
  item,
  debts,
  onCancel,
  onSubmit,
  onDelete,
}: Omit<ExpenseFormSheetProps, "open" | "onOpenChange" | "item"> & { item: ExpenseItem; onCancel: () => void }) {
  const { t } = useI18n();
  const f = t.expenses.form;
  const rate = useCurrency()?.rates.vndPerUsd ?? null;
  const initialDebt = item.debtId ? debts.find((d) => d.id === item.debtId) : undefined;
  const inUsd = Boolean(item.amountUsd) && !initialDebt;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item.name,
      category: item.category,
      kind: item.kind,
      // Charged in USD: the field holds dollars.
      amount: inUsd ? item.amountUsd! : (initialDebt?.monthlyPayment ?? item.amount),
      currency: inUsd ? "USD" : "VND",
      frequency: item.frequency,
      dueDay: item.dueDay,
      dueMonth: item.dueMonth ? String(item.dueMonth) : NONE,
      dueWeekday: item.dueWeekday ? String(item.dueWeekday) : NONE,
      debtId: item.debtId ?? NONE,
      autopay: item.autopay ?? false,
      essential: item.essential ?? EXPENSE_CATEGORY_META[item.category].essential,
      note: item.note ?? "",
      paused: item.paused ?? false,
    },
  });

  const [category, kind, frequency, debtId, currency] = useWatch({ control: form.control, name: ["category", "kind", "frequency", "debtId", "currency"] });
  const linkedDebt = debtId !== NONE ? debts.find((d) => d.id === debtId) : undefined;
  const showDebt = debts.length > 0 && (category === "debt" || category === "housing" || debtId !== NONE);
  // Linking a debt makes the amount its (đồng) payment.
  useEffect(() => {
    if (!linkedDebt || form.getValues("currency") !== "USD") return;
    form.setValue("currency", "VND");
    form.setValue("amount", linkedDebt.monthlyPayment ?? (rate ? Math.round(form.getValues("amount") * rate) : 0));
  }, [linkedDebt, form, rate]);
  const amountLabel = kind === "budget" ? (frequency === "monthly" ? f.amountBudget : f.amount) : frequency === "monthly" ? f.amountMonthly : f.amount;

  const submit = (v: Values) => {
    const linked = v.debtId !== NONE ? debts.find((d) => d.id === v.debtId) : undefined;
    // A debt's payment is in đồng; otherwise USD items keep their dollars and today's đồng.
    const usd = v.currency === "USD" && !linked ? Math.round(v.amount * 100) / 100 : undefined;
    const amount = usd === undefined ? v.amount : rate ? Math.round(usd * rate) : item.amount;
    const next: ExpenseItem = {
      ...item,
      // No name: use the category's ("Ăn uống").
      name: v.name.trim() || t.expenses.categories[v.category],
      category: v.category,
      kind: v.kind,
      amount,
      amountUsd: usd,
      frequency: linked ? "monthly" : v.frequency,
      dueDay: v.frequency === "weekly" ? undefined : v.dueDay,
      dueMonth: ["quarterly", "semiannual", "yearly"].includes(v.frequency) && v.dueMonth !== NONE ? Number(v.dueMonth) : undefined,
      dueWeekday: v.frequency === "weekly" && v.dueWeekday !== NONE ? Number(v.dueWeekday) : undefined,
      debtId: linked?.id,
      autopay: v.autopay || undefined,
      // Only store "essential" when it differs from the category's default.
      essential: v.essential === EXPENSE_CATEGORY_META[v.category].essential ? undefined : v.essential,
      note: v.note.trim() || undefined,
      paused: v.paused || undefined,
    };
    const debtPayment = linked && v.amount > 0 && v.amount !== linked.monthlyPayment ? { debtId: linked.id, monthlyPayment: v.amount } : undefined;
    onSubmit({ item: next, debtPayment });
  };

  return (
    <Form {...form}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(submit)}>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? f.addTitle : f.editTitle}</DialogTitle>
          <DialogDescription>{f.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{f.category}</FormLabel>
                <FormControl>
                  <CategoryGrid
                    value={field.value}
                    onChange={(c) => {
                      field.onChange(c);
                      form.setValue("essential", EXPENSE_CATEGORY_META[c].essential);
                    }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <TextField control={form.control} name="name" label={f.name} placeholder={mode === "create" ? t.expenses.categories[category] : f.namePlaceholder} />
          <SegmentedField
            control={form.control}
            name="kind"
            label={f.kind}
            description={t.expenses.kinds[kind].hint}
            options={[
              { value: "bill", label: t.expenses.kinds.bill.label },
              { value: "budget", label: t.expenses.kinds.budget.label },
            ]}
          />
          {showDebt ? (
            <SelectField
              control={form.control}
              name="debtId"
              label={f.debt}
              description={f.debtHint}
              options={[{ value: NONE, label: f.noDebt }, ...debts.map((d) => ({ value: d.id, label: d.name }))]}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              control={form.control}
              name="amount"
              label={amountLabel}
              description={linkedDebt ? f.amountFromDebt : undefined}
              currency={linkedDebt ? "VND" : currency}
              onCurrencyChange={(c) => form.setValue("currency", c)}
              currencySwitch={!linkedDebt}
            />
            {linkedDebt ? null : (
              <SelectField
                control={form.control}
                name="frequency"
                label={f.frequency}
                options={EXPENSE_FREQUENCIES.map((fr) => ({ value: fr, label: t.expenses.frequencies[fr] }))}
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {frequency === "weekly" && !linkedDebt ? (
              <SelectField
                control={form.control}
                name="dueWeekday"
                label={f.dueWeekday}
                placeholder={f.weekdayPlaceholder}
                options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: t.expenses.weekdays[d as 1] }))}
              />
            ) : (
              <DayOfMonthField control={form.control} name="dueDay" label={f.dueDay} description={f.dueDayHint} />
            )}
            {["quarterly", "semiannual", "yearly"].includes(frequency) && !linkedDebt ? (
              <SelectField
                control={form.control}
                name="dueMonth"
                label={f.dueMonth}
                placeholder={f.monthPlaceholder}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: t.expenses.months[(i + 1) as 1] }))}
              />
            ) : null}
          </div>
          <div className="grid gap-2">
            {kind === "bill" ? <SwitchField control={form.control} name="autopay" label={f.autopay} description={f.autopayHint} /> : null}
            <SwitchField control={form.control} name="essential" label={f.essential} description={f.essentialHint} />
            {mode === "edit" ? <SwitchField control={form.control} name="paused" label={f.paused} description={f.pausedHint} /> : null}
          </div>
          <TextField control={form.control} name="note" label={f.note} placeholder={f.notePlaceholder} />
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          {mode === "edit" && onDelete ? (
            <Button type="button" variant="ghost" className="text-danger hover:text-danger" onClick={() => onDelete(item)}>
              <Trash2 />
              {t.expenses.actions.delete}
            </Button>
          ) : (
            <span className="max-sm:hidden" />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t.common.cancel}
            </Button>
            <Button type="submit">{mode === "create" ? f.submitAdd : t.common.saveChanges}</Button>
          </div>
        </DialogFooter>
      </form>
    </Form>
  );
}
