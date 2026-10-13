"use client";

import { Download, Link2Off, Plus, ScrollText, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  CategoryTile,
  createExpenseDraft,
  isEssential,
  linkedDebt,
  liveItems,
  monthlyEquivalent,
  needsWantsSavings,
  NEEDS_WANTS_REFERENCE,
  occurrenceAmount,
  orphanedLinks,
  planVsActual,
  retireLegacyEstimate,
  scheduleText,
  spendingByCategory,
  suggestDebtBills,
  unretireLegacyEstimate,
  upsertExpenseItem,
  type ExpenseCategoryId,
  type ExpenseItem,
} from "@/entities/expense";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import { applyAverageMonthlySpending, PREFERENCES_SEED } from "@/entities/preferences";
import { TemplatePicker } from "@/features/expense-form";
import { ExportSpendingDialog } from "@/features/export-spending-csv";
import { useI18n } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import { formatMoney, formatPercent } from "@/shared/lib/format";
import { monthKeyOf, monthsEndingAt } from "@/shared/lib/month";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { useTable } from "@/shared/storage";
import { Callout } from "@/shared/ui/callout";
import { EmptyState } from "@/shared/ui/empty-state";
import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { ListGroup, ListRow } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";
import { HelpHint } from "@/shared/ui/help-hint";
import { Section } from "@/shared/ui/section";
import { StackedBar } from "@/shared/ui/stacked-bar";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { useExpenseEditor } from "../model/use-expense-editor";
import { EstimateForm } from "./estimate-form";
import { PlanVsActualCard } from "./plan-vs-actual-card";

function pct(share: number | null): string {
  return share === null ? "—" : formatPercent(share * 100, { maximumFractionDigits: 0 });
}

/** Cash flow › Spending: every bill and budget, what it adds up to, and how it splits. */
export function SpendingPage() {
  const { t } = useI18n();
  const sp = t.cashflow.spending;
  const editor = useExpenseEditor();
  const { updateExpenses } = useExpenses();
  const cash = useHouseholdCashflow();
  const [, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const { expenses, log, debts } = editor;

  useCreateParam(() => editor.openCreate(), editor.openEdit);

  const live = liveItems(expenses.items);
  const paused = expenses.items.filter((i) => !i.archivedAt && i.paused);
  const spending = cash.spending;
  const categories = useMemo(() => spendingByCategory(expenses.items, debts), [expenses.items, debts]);
  const byKind = useMemo(() => {
    let bills = 0;
    let budgets = 0;
    for (const item of liveItems(expenses.items)) {
      const monthly = monthlyEquivalent(item, linkedDebt(item, debts));
      if (item.kind === "bill") bills += monthly;
      else budgets += monthly;
    }
    return { bills, budgets };
  }, [expenses.items, debts]);
  const split = useMemo(
    () => needsWantsSavings({ items: expenses.items, debts, income: cash.totalIncome, unclassified: spending.unitemized }),
    [expenses.items, debts, cash.totalIncome, spending.unitemized],
  );
  const suggestions = useMemo(() => suggestDebtBills(expenses.items, debts), [expenses.items, debts]);
  const orphans = useMemo(() => orphanedLinks(expenses.items, debts), [expenses.items, debts]);
  const history = useMemo(
    () => planVsActual({ expenses, log, debts, monthKeys: monthsEndingAt(monthKeyOf(new Date()), 6), today: new Date() }),
    [expenses, log, debts],
  );
  const byCategory = useMemo(() => {
    const groups = new Map<ExpenseCategoryId, ExpenseItem[]>();
    for (const item of live) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    return categories.map((c) => ({ ...c, items: (groups.get(c.category) ?? []).sort((a, b) => monthlyEquivalent(b, linkedDebt(b, debts)) - monthlyEquivalent(a, linkedDebt(a, debts))) }));
  }, [live, categories, debts]);
  const maxCategory = categories[0]?.monthly ?? 0;
  // The top five, then everything else as one muted line (the full breakdown is in the list below).
  const TOP_CATEGORIES = 5;
  const rest = categories.slice(TOP_CATEGORIES);
  const restMonthly = rest.reduce((s, c) => s + c.monthly, 0);
  const restShare = rest.reduce((s, c) => s + c.share, 0);

  const row = (item: ExpenseItem) => {
    const debt = linkedDebt(item, debts);
    const each = occurrenceAmount(item, debt);
    const monthly = monthlyEquivalent({ ...item, paused: undefined }, debt);
    return (
      <ListRow
        key={item.id}
        leading={<CategoryTile category={item.category} />}
        title={item.name}
        muted={item.paused}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>
              {t.expenses.kinds[item.kind].label} ·{" "}
              {item.kind === "budget" && !item.dueMonth ? t.expenses.frequencies[item.frequency] : scheduleText(t, item, debt)}
            </span>
            {item.autopay ? <Badge variant="neutral">{t.expenses.badges.autopay}</Badge> : null}
            {debt ? <Badge variant="info">{t.expenses.badges.linkedDebt}</Badge> : null}
            {!isEssential(item) ? <Badge variant="neutral">{t.expenses.badges.want}</Badge> : null}
          </span>
        }
        trailing={
          <span>
            <Money value={each} compact interactive={false} />
            <span className="text-xs font-normal text-muted-foreground"> {t.expenses.per[item.frequency]}</span>
          </span>
        }
        trailingSub={item.frequency !== "monthly" ? <span data-private>{t.expenses.monthlyEquivalent({ amount: formatMoney(Math.round(monthly)) })}</span> : undefined}
        onClick={() => editor.openEdit(item.id)}
        label={item.name}
      />
    );
  };

  const addDebtBill = (debtId: string) => {
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return;
    updateExpenses((d) =>
      upsertExpenseItem(
        d,
        createExpenseDraft(todayIso(), { name: debt.name, category: "debt", kind: "bill", amount: debt.monthlyPayment ?? 0, debtId: debt.id }),
      ),
    );
    toast.success(sp.debts.added({ name: debt.name }));
  };

  if (!live.length && !paused.length) {
    return (
      <TabContent>
        <Card className="gap-0 py-0">
          <EmptyState illustrated title={sp.empty.title} description={sp.empty.description} action={
            <Button onClick={() => editor.openCreate()}>
              <Plus />
              {t.expenses.form.addTitle}
            </Button>
          } />
          <div className="border-t px-5 py-5">
            <p className="mb-1 text-sm font-semibold">{t.expenses.templatesPicker.title}</p>
            <p className="mb-3 text-sm text-muted-foreground">{t.expenses.templatesPicker.description}</p>
            <TemplatePicker debts={debts} onAdd={editor.addMany} />
          </div>
        </Card>
        <Section title={sp.estimate.title} description={sp.estimate.description}>
          <EstimateForm
            value={spending.legacyEstimate}
            onSave={(amount) => {
              setPrefs((p) => applyAverageMonthlySpending(p, amount));
              toast.success(sp.estimate.saved);
            }}
          />
        </Section>
        {editor.element}
      </TabContent>
    );
  }

  return (
    <TabContent>
      <TabToolbar
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/cashflow/history">
                <ScrollText />
                <span className="max-sm:sr-only">{t.ledger.history.openHistoryExpense}</span>
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setCsvOpen(true)}>
              <Download />
              <span className="max-sm:sr-only">{sp.exportCsv}</span>
            </Button>
            <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
              <Sparkles />
              <span className="max-sm:sr-only">{sp.templates}</span>
            </Button>
            <Button onClick={() => editor.openCreate()}>
              <Plus />
              {sp.add}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
        <Card className="bg-hero gap-5 px-5 xl:col-span-3" data-help="spendingTotal">
          <div className="grid gap-1">
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              {sp.monthlyTitle}
              <HelpHint topic="spendingTotal" className="-my-1" />
            </p>
            <p className="text-display font-semibold md:text-hero">
              <Money value={spending.total} compact />
            </p>
            <p className="text-xs text-muted-foreground">
              {sp.itemsCount({ count: live.length })} · {sp.monthlyHint}
            </p>
          </div>
          <dl aria-label={sp.mix.label} className="grid grid-cols-3 gap-3 rounded-xl border bg-background/60 p-3">
            {[
              { key: "bills", label: sp.mix.bills, value: byKind.bills },
              { key: "budgets", label: sp.mix.budgets, value: byKind.budgets },
              { key: "day", label: sp.mix.perDay, value: (spending.total * 12) / 365 },
            ].map((s) => (
              <div key={s.key} className="grid min-w-0 gap-0.5">
                <dt className="truncate text-xs text-muted-foreground">{s.label}</dt>
                <dd className="font-semibold">
                  <Money value={s.value} compact interactive={false} />
                </dd>
              </div>
            ))}
          </dl>
          {/* Pinned to the bottom: the card matches the category list's height. */}
          <div className="mt-auto grid gap-2">
            <p className="text-sm font-medium">{sp.split.title}</p>
            {cash.totalIncome > 0 ? (
              <StackedBar
                label={sp.split.label({ needs: pct(split.needsShare), wants: pct(split.wantsShare), savings: pct(split.savingsShare) })}
                markers={[
                  { at: NEEDS_WANTS_REFERENCE.needs, label: "50 %" },
                  { at: NEEDS_WANTS_REFERENCE.needs + NEEDS_WANTS_REFERENCE.wants, label: "80 %" },
                ]}
                segments={[
                  { key: "needs", value: split.needs, color: "var(--chart-1)", label: sp.split.needs, detail: pct(split.needsShare) },
                  { key: "wants", value: split.wants, color: "var(--chart-2)", label: sp.split.wants, detail: pct(split.wantsShare) },
                  ...(split.unclassified > 0
                    ? [{ key: "un", value: split.unclassified, color: "var(--muted-foreground)", label: sp.split.unclassified, detail: pct(split.unclassifiedShare) }]
                    : []),
                  { key: "save", value: Math.max(0, split.savings), color: "var(--chart-3)", label: sp.split.savings, detail: pct(split.savingsShare) },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{sp.split.noIncome}</p>
            )}
            <p className="text-xs text-muted-foreground">{sp.split.hint}</p>
          </div>
        </Card>

        <Section title={sp.byCategory} className="xl:col-span-2" help="spendingByCategory">
          <ul className="grid gap-3">
            {categories.slice(0, TOP_CATEGORIES).map((c) => (
              <li key={c.category} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <CategoryTile category={c.category} size="sm" />
                <div className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{t.expenses.categories[c.category]}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{pct(c.share)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${maxCategory > 0 ? (c.monthly / maxCategory) * 100 : 0}%` }} />
                  </div>
                </div>
                <Money value={c.monthly} compact interactive={false} className="text-sm font-medium" />
              </li>
            ))}
            {rest.length ? (
              <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-muted-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-medium" aria-hidden>
                  +{rest.length}
                </span>
                <div className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{sp.otherCategories({ count: rest.length })}</span>
                    <span className="text-xs tabular-nums">{pct(restShare)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${maxCategory > 0 ? Math.min(1, restMonthly / maxCategory) * 100 : 0}%` }} />
                  </div>
                </div>
                <Money value={restMonthly} compact interactive={false} className="text-sm font-medium" />
              </li>
            ) : null}
          </ul>
        </Section>
      </div>

      {spending.unitemized > 0 ? (
        <Callout tone="info" title={sp.migration.title}>
          <p data-private>
            {sp.migration.body({
              estimate: formatMoney(spending.legacyEstimate),
              itemized: formatMoney(spending.itemized - spending.debtPayments),
              rest: formatMoney(spending.unitemized),
            })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const rest = Math.round(spending.unitemized);
                updateExpenses((d) =>
                  retireLegacyEstimate(
                    upsertExpenseItem(d, createExpenseDraft(todayIso(), { name: sp.migration.otherName, category: "other", kind: "budget", amount: rest })),
                    spending.legacyEstimate,
                    todayIso(),
                  ),
                );
                toast.success(sp.migration.created);
              }}
            >
              {sp.migration.makeOther}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                updateExpenses((d) => retireLegacyEstimate(d, spending.legacyEstimate, todayIso()));
                toast.success(sp.migration.retired, { action: { label: t.common.undo, onClick: () => updateExpenses(unretireLegacyEstimate) } });
              }}
            >
              {sp.migration.retire}
            </Button>
          </div>
        </Callout>
      ) : null}

      {suggestions.length ? (
        <Callout tone="warning" title={sp.debts.title}>
          <p>{sp.debts.body}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((d) => (
              <Button key={d.id} size="sm" variant="outline" onClick={() => addDebtBill(d.id)}>
                <Plus />
                {sp.debts.add({ name: d.name })} · <Money value={d.monthlyPayment ?? 0} compact interactive={false} />
              </Button>
            ))}
          </div>
        </Callout>
      ) : null}

      {orphans.length ? (
        <Callout tone="neutral" title={sp.orphan.title} icon={Link2Off}>
          <p>{sp.orphan.body({ names: orphans.map((o) => o.name).join(", ") })}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => updateExpenses((d) => orphans.reduce((acc, o) => upsertExpenseItem(acc, { ...o, debtId: undefined }), d))}
          >
            {sp.orphan.fix}
          </Button>
        </Callout>
      ) : null}

      <div className="grid gap-5">
        {byCategory.map((c) => (
          <ListGroup
            key={c.category}
            title={t.expenses.categories[c.category]}
            aside={
              <span>
                <Money value={c.monthly} compact interactive={false} /> {t.expenses.per.monthly}
              </span>
            }
          >
            {c.items.map(row)}
          </ListGroup>
        ))}
        {paused.length ? <ListGroup title={sp.paused}>{paused.map(row)}</ListGroup> : null}
      </div>

      <PlanVsActualCard
        data={history}
        onUpdatePlan={(d) => {
          const item = expenses.items.find((i) => i.id === d.itemId);
          if (!item) return;
          updateExpenses((doc) => upsertExpenseItem(doc, { ...item, amount: Math.round(d.averagePaid / 1000) * 1000 }));
          toast.success(sp.history.updated);
        }}
      />

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-4 text-primary" aria-hidden />
              {t.expenses.templatesPicker.title}
            </DialogTitle>
            <DialogDescription>{t.expenses.templatesPicker.description}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <TemplatePicker
              debts={debts}
              onAdd={(items, payments) => {
                editor.addMany(items, payments);
                setTemplatesOpen(false);
              }}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
      <ExportSpendingDialog open={csvOpen} onOpenChange={setCsvOpen} expenses={expenses} log={log} debts={debts} />
      {editor.element}
    </TabContent>
  );
}
