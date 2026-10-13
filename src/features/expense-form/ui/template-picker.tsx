"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import type { Debt } from "@/entities/debt";
import { CategoryTile, createItemFromTemplate, EXPENSE_TEMPLATES, type ExpenseItem } from "@/entities/expense";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { todayIso } from "@/shared/lib/date";
import { formatMoneyCompact } from "@/shared/lib/format";
import { MoneyInput } from "@/shared/ui/form";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

const NONE = "_none";

type Template = (typeof EXPENSE_TEMPLATES)[number];
type Row = { template: Template; name: string; amount: number; debtId: string };

/**
 * One-tap starters: tap the costs you have, then enter all amounts on one
 * sheet. Bills like a credit card or instalment can link to a debt.
 */
export function TemplatePicker({
  debts,
  onAdd,
  className,
}: {
  debts: Debt[];
  onAdd: (items: ExpenseItem[], debtPayments: { debtId: string; monthlyPayment: number }[]) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const m = t.expenses.templatesPicker;
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const start = () =>
    setRows(
      EXPENSE_TEMPLATES.filter((tpl) => selected.includes(tpl.id)).map((tpl) => {
        const debt = "linksDebt" in tpl && tpl.linksDebt ? debts.find((d) => (d.monthlyPayment ?? 0) > 0) : undefined;
        return { template: tpl, name: t.expenses.templates[tpl.id], amount: debt?.monthlyPayment ?? 0, debtId: debt?.id ?? NONE };
      }),
    );

  const save = () => {
    if (!rows) return;
    const today = todayIso();
    const payments: { debtId: string; monthlyPayment: number }[] = [];
    const items = rows
      .filter((r) => r.amount > 0)
      .map((r) => {
        const debtId = r.debtId !== NONE ? r.debtId : undefined;
        const debt = debtId ? debts.find((d) => d.id === debtId) : undefined;
        if (debt && debt.monthlyPayment !== r.amount) payments.push({ debtId: debt.id, monthlyPayment: r.amount });
        return createItemFromTemplate(r.template, { name: r.name.trim() || t.expenses.templates[r.template.id], amount: r.amount, debtId }, today);
      });
    onAdd(items, payments);
    setRows(null);
    setSelected([]);
  };

  return (
    <div className={cn("grid gap-3", className)}>
      <div className="flex flex-wrap gap-2">
        {EXPENSE_TEMPLATES.map((tpl) => {
          const on = selected.includes(tpl.id);
          return (
            <button
              key={tpl.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(tpl.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                on ? "border-primary bg-primary-soft text-primary-soft-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {on ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5 animate-check-pop motion-reduce:animate-none" aria-hidden />
                </span>
              ) : (
                <CategoryTile category={tpl.category} size="sm" className="rounded-full" />
              )}
              {t.expenses.templates[tpl.id]}
            </button>
          );
        })}
      </div>
      <div>
        <Button onClick={start} disabled={selected.length === 0}>
          {m.continue({ count: selected.length })}
        </Button>
      </div>

      <Dialog open={rows !== null} onOpenChange={(o) => !o && setRows(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{m.sheetTitle}</DialogTitle>
            <DialogDescription>{m.sheetDescription}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3">
            {rows?.map((r, i) => {
              const set = (patch: Partial<Row>) => setRows((all) => all && all.map((x, j) => (j === i ? { ...x, ...patch } : x)));
              const linksDebt = "linksDebt" in r.template && r.template.linksDebt && debts.length > 0;
              return (
                <div key={r.template.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <CategoryTile category={r.template.category} size="sm" />
                    <Input value={r.name} onChange={(e) => set({ name: e.target.value })} aria-label={t.expenses.form.name} className="h-8" />
                  </div>
                  <div className={cn("grid gap-2", linksDebt && "sm:grid-cols-2")}>
                    <MoneyInput
                      value={r.amount || undefined}
                      onChange={(amount) => set({ amount })}
                      placeholder={m.typical({ amount: formatMoneyCompact(r.template.typical) })}
                      aria-label={`${t.expenses.form.amount}: ${r.name}`}
                    />
                    {linksDebt ? (
                      <Select
                        value={r.debtId}
                        onValueChange={(debtId) => {
                          const debt = debts.find((d) => d.id === debtId);
                          set({ debtId, amount: debt?.monthlyPayment ?? r.amount });
                        }}
                      >
                        <SelectTrigger aria-label={t.expenses.form.debt}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t.expenses.form.noDebt}</SelectItem>
                          {debts.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRows(null)}>
              {t.common.cancel}
            </Button>
            <Button onClick={save} disabled={!rows?.some((r) => r.amount > 0)}>
              {m.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
