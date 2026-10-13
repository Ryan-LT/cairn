"use client";

import {
  ArrowRight,
  Archive,
  CalendarCheck,
  Calculator,
  CreditCard,
  HandCoins,
  History,
  Landmark,
  RotateCw,
  Settings,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { CategoryTile, EXPENSE_CATEGORY_META } from "@/entities/expense";
import type { ExpenseCategoryId } from "@/entities/expense/model";
import { useI18n, type Messages } from "@/shared/i18n";
import type { AuditEntityType } from "@/shared/lib/audit-diff";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatMoney, formatNumber, formatPercent, formatTime, formatUsd } from "@/shared/lib/format";
import type { StatusTone } from "@/shared/lib/tone";
import { Callout } from "@/shared/ui/callout";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Button } from "@/shared/ui/kit/button";
import { Skeleton } from "@/shared/ui/kit/skeleton";
import { StatusBadge } from "@/shared/ui/status-badge";
import { TabContent, useShell } from "@/widgets/app-shell";

import {
  ACTIVITY_FILTERS,
  groupByDay,
  headlineAmount,
  monthSummary,
  splitMonthId,
  valueView,
  type ActivityEntry,
  type ActivityFilter,
  type ValueView,
} from "../lib/describe";
import { useActivity } from "../model/use-activity";

const ENTITY_ICONS: Record<AuditEntityType, LucideIcon> = {
  expense: CalendarCheck,
  expense_month: CalendarCheck,
  spending_estimate: Calculator,
  income_source: TrendingUp,
  asset: Landmark,
  legacy_real_estate: Archive,
  legacy_cash: Archive,
  legacy_investment: Archive,
  debt: CreditCard,
  personal_loan: HandCoins,
  goal_plan: Target,
  goal_primary: Target,
  settings: Settings,
};

const ACTION_TONE: Record<ActivityEntry["action"], StatusTone> = { add: "success", update: "info", remove: "danger" };

/** Changes shown before "+N more". */
const VISIBLE_CHANGES = 4;

function categoryOf(entry: ActivityEntry): ExpenseCategoryId | null {
  if (entry.entityType !== "expense") return null;
  const v = (entry.after ?? entry.before) as { category?: unknown } | null;
  return typeof v?.category === "string" && v.category in EXPENSE_CATEGORY_META ? (v.category as ExpenseCategoryId) : null;
}

function renderValue(t: Messages, view: ValueView): string {
  const a = t.activity;
  switch (view.kind) {
    case "empty":
      return a.none;
    case "money":
      return formatMoney(view.amount);
    case "usd":
      return formatUsd(view.amount);
    case "percent":
      return formatPercent(view.value);
    case "number":
      return formatNumber(view.value);
    case "date":
      return formatDate(view.iso);
    case "bool":
      return view.value ? a.yes : a.no;
    case "payments":
      return view.count ? a.paidTotal({ amount: formatMoney(view.total), count: view.count }) : a.none;
    case "moneyList":
      return view.count ? `${formatMoney(view.total)} · ${a.items({ count: view.count })}` : a.none;
    case "count":
      return a.items({ count: view.count });
    case "category":
      return t.expenses.categories[view.id as ExpenseCategoryId] ?? view.id;
    case "frequency":
      return t.expenses.frequencies[view.id as keyof Messages["expenses"]["frequencies"]] ?? view.id;
    case "expenseKind":
      return t.expenses.kinds[view.id as "bill" | "budget"].label;
    case "rateKind":
      return t.debts.rateKind[view.id as "Fixed" | "Variable"] ?? view.id;
    case "text":
      return view.text;
  }
}

const isAmount = (view: ValueView) => view.kind === "money" || view.kind === "usd" || view.kind === "payments" || view.kind === "moneyList";

/** "10/2026" in Vietnamese (after "Tháng"), "Oct 2026" in English. */
function monthLabel(locale: string, month: string): string {
  const [y, m] = month.split("-");
  return locale === "vi" ? `${Number(m)}/${y}` : formatDate(`${month}-01`, "monthYear");
}

function fieldLabel(t: Messages, field: string): string {
  return (t.activity.fields as Record<string, string>)[field] ?? field;
}

function EntryRow({ entry, style }: { entry: ActivityEntry; style?: React.CSSProperties }) {
  const { t, locale } = useI18n();
  const a = t.activity;
  const category = categoryOf(entry);
  const isMonth = entry.entityType === "expense_month";
  const month = isMonth ? splitMonthId(entry.entityId).month : "";
  const name = entry.entityName ?? (entry.entityType === "settings" || entry.entityType === "spending_estimate" ? null : a.unnamed);

  let detail: React.ReactNode = null;
  if (isMonth) {
    const s = monthSummary(entry);
    const parts = [
      s.paid ? a.paidTotal({ amount: formatMoney(s.paid.total), count: s.paid.count }) : null,
      s.spent !== undefined ? a.spentTotal({ amount: formatMoney(s.spent) }) : null,
      s.skipped ? a.skippedMonth : null,
    ].filter(Boolean);
    if (parts.length) detail = <p className="text-sm" data-private>{parts.join(" · ")}</p>;
  } else if (entry.action === "update" && entry.changes?.length) {
    const shown = entry.changes.slice(0, VISIBLE_CHANGES);
    detail = (
      <dl className="mt-1 grid gap-1 text-sm">
        {shown.map((c) => {
          const before = valueView(c.field, c.before);
          const after = valueView(c.field, c.after);
          return (
            <div key={c.field} className="flex flex-wrap items-baseline gap-x-1.5">
              <dt className="text-muted-foreground">{fieldLabel(t, c.field)}:</dt>
              <dd className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                <span className="text-muted-foreground line-through decoration-muted-foreground/40" data-private={isAmount(before) || undefined}>
                  {renderValue(t, before)}
                </span>
                <ArrowRight className="size-3 shrink-0 self-center text-muted-foreground" aria-hidden />
                <span className="font-medium" data-private={isAmount(after) || undefined}>
                  {renderValue(t, after)}
                </span>
              </dd>
            </div>
          );
        })}
        {entry.changes.length > VISIBLE_CHANGES ? (
          <p className="text-xs text-muted-foreground">{a.moreChanges({ count: entry.changes.length - VISIBLE_CHANGES })}</p>
        ) : null}
      </dl>
    );
  } else {
    const amount = headlineAmount(entry);
    if (amount !== null) {
      detail = (
        <p className={cn("text-sm font-medium tabular-nums", entry.action === "remove" && "text-muted-foreground line-through")} data-private>
          {formatMoney(amount)}
        </p>
      );
    }
  }

  return (
    <li className="flex gap-3 px-4 py-3 motion-safe:animate-row-in" style={style}>
      {category ? <CategoryTile category={category} /> : <IconTile icon={ENTITY_ICONS[entry.entityType] ?? History} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge tone={ACTION_TONE[entry.action]}>{a.actions[entry.action]}</StatusBadge>
          <span className="text-sm text-muted-foreground">{a.entities[entry.entityType] ?? entry.entityType}</span>
        </div>
        <p className="mt-1 truncate font-medium">
          {name}
          {isMonth && month ? <span className="font-normal text-muted-foreground"> · {a.monthOf({ month: monthLabel(locale, month) })}</span> : null}
        </p>
        {detail}
      </div>
      <time dateTime={entry.at} className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatTime(new Date(entry.at))}
      </time>
    </li>
  );
}

export function ActivityPage() {
  const { t } = useI18n();
  const a = t.activity;
  const { authEnabled } = useShell();
  const params = useSearchParams();
  const entity = params.get("entity");
  const entityName = params.get("name");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const { entries, status, hasMore, loadingMore, loadMore, reload } = useActivity({
    types: entity ? [] : ACTIVITY_FILTERS[filter],
    entity,
    enabled: authEnabled,
  });
  const groups = useMemo(() => groupByDay(entries, new Date()), [entries]);
  const filters = Object.keys(ACTIVITY_FILTERS) as ActivityFilter[];

  if (!authEnabled) {
    return (
      <TabContent className="max-w-3xl">
        <EmptyState icon={History} title={a.signedOutTitle} description={a.signedOutDescription} />
      </TabContent>
    );
  }

  return (
    <TabContent className="max-w-3xl">
      <div>
        <p className="text-sm text-muted-foreground">{a.intro}</p>
        <p className="mt-1 text-xs text-muted-foreground">{a.syncNote}</p>
      </div>

      {entity ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3">
          <p className="font-medium">{a.forRecord({ name: entityName ?? entity })}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/activity">{a.showAll}</Link>
          </Button>
        </div>
      ) : (
        <div role="group" aria-label={a.filters.label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {filters.map((f) => (
            <Button
              key={f}
              type="button"
              size="sm"
              variant={f === filter ? "default" : "outline"}
              aria-pressed={f === filter}
              className="shrink-0 rounded-full"
              onClick={() => {
                if (f === filter) return;
                setFilter(f);
                reload();
              }}
            >
              {a.filters[f]}
            </Button>
          ))}
        </div>
      )}

      {status === "loading" ? (
        <div className="grid gap-2" aria-busy aria-label={a.loading}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : status === "unavailable" ? (
        <Callout tone="warning">{a.unavailable}</Callout>
      ) : status === "error" ? (
        <Callout tone="danger" title={a.loadFailed}>
          <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
            <RotateCw />
            {a.retry}
          </Button>
        </Callout>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border bg-card">
          {filter === "all" && !entity ? (
            <EmptyState illustrated title={a.empty.title} description={a.empty.description} />
          ) : (
            <EmptyState icon={History} title={a.emptyFiltered} />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.day} aria-labelledby={`day-${g.day}`}>
              <h2 id={`day-${g.day}`} className="mb-2 px-1 text-sm font-semibold text-muted-foreground">
                {g.when === "today" ? a.today : g.when === "yesterday" ? a.yesterday : formatDate(g.day, "medium")}
              </h2>
              <ol className="divide-y overflow-hidden rounded-xl border bg-card">
                {g.entries.map((e, i) => (
                  <EntryRow key={e.id} entry={e} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} />
                ))}
              </ol>
            </section>
          ))}
          {hasMore ? (
            <Button variant="outline" className="self-center" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? a.loading : a.loadMore}
            </Button>
          ) : null}
        </div>
      )}
    </TabContent>
  );
}
