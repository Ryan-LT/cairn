"use client";

import {
  ArrowRight,
  ArrowUp,
  Archive,
  CalendarCheck,
  CalendarSearch,
  Calculator,
  CreditCard,
  HandCoins,
  History,
  Landmark,
  Loader2,
  RotateCw,
  Search,
  Settings,
  Target,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CategoryTile, EXPENSE_CATEGORY_META } from "@/entities/expense";
import type { ExpenseCategoryId } from "@/entities/expense/model";
import { useI18n, type Messages } from "@/shared/i18n";
import { AUDIT_ACTIONS, type AuditAction, type AuditEntityType } from "@/shared/lib/audit-diff";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatMoney, formatNumber, formatPercent, formatTime, formatUsd } from "@/shared/lib/format";
import type { StatusTone } from "@/shared/lib/tone";
import { Callout } from "@/shared/ui/callout";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Button } from "@/shared/ui/kit/button";
import { Input } from "@/shared/ui/kit/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
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
    case "goldProduct":
      return t.currency.gold.products[view.id as keyof Messages["currency"]["gold"]["products"]] ?? view.id;
    case "weightUnit":
      return t.currency.gold.units[view.id as keyof Messages["currency"]["gold"]["units"]] ?? view.id;
    case "holdingKind":
      return t.currency.holding.kinds[view.id as "vnd" | "usd" | "gold"] ?? view.id;
    case "goldBasis":
      return view.id === "sell" ? t.currency.settings.basisSell : t.currency.settings.basisBuy;
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

/** `YYYY-MM` from the newest month back to the month of `oldestIso`. */
function monthsSince(oldestIso: string | null, now: Date): string[] {
  if (!oldestIso) return [];
  const oldest = new Date(oldestIso);
  const out: string[] = [];
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  const stopY = oldest.getFullYear();
  const stopM = oldest.getMonth() + 1;
  while ((y > stopY || (y === stopY && m >= stopM)) && out.length < 240) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/** Start of the month after `YYYY-MM`, local time, as an ISO instant (entries before it). */
function endOfMonthIso(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 1).toISOString();
}

const SEARCH_DEBOUNCE_MS = 300;
const ALL_ACTIONS = "all";
const LATEST = "latest";

export function ActivityPage() {
  const { t, locale } = useI18n();
  const a = t.activity;
  const { authEnabled } = useShell();
  const params = useSearchParams();
  const entity = params.get("entity");
  const entityName = params.get("name");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [action, setAction] = useState<AuditAction | typeof ALL_ACTIONS>(ALL_ACTIONS);
  const [month, setMonth] = useState<string>(LATEST);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { entries, status, summary, hasMore, loadingMore, loadMore, reload } = useActivity({
    types: entity ? [] : ACTIVITY_FILTERS[filter],
    entity,
    actions: action === ALL_ACTIONS ? [] : [action],
    search: entity ? "" : search,
    until: month === LATEST ? null : endOfMonthIso(month),
    enabled: authEnabled,
  });
  const groups = useMemo(() => groupByDay(entries, new Date()), [entries]);
  const months = useMemo(() => monthsSince(summary?.oldest ?? null, new Date()), [summary?.oldest]);
  const filters = Object.keys(ACTIVITY_FILTERS) as ActivityFilter[];
  const narrowed = action !== ALL_ACTIONS || month !== LATEST || search.trim() !== "" || (!entity && filter !== "all");
  const busy = status === "refreshing";

  // Older pages load on their own as the end of the list comes near; the button stays as a fallback.
  // Re-observing after each page re-checks a sentinel that is still in view (short pages).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || status !== "ready" || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) void loadMore().catch(() => undefined);
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, status, entries.length, loadMore]);

  const clearFilters = () => {
    setFilter("all");
    setAction(ALL_ACTIONS);
    setMonth(LATEST);
    setSearchInput("");
    setSearch("");
  };

  const backToTop = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rootRef.current?.closest("main")?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  if (!authEnabled) {
    return (
      <TabContent className="max-w-3xl">
        <EmptyState icon={History} title={a.signedOutTitle} description={a.signedOutDescription} />
      </TabContent>
    );
  }

  const count = summary?.total ?? 0;
  const countText = narrowed ? a.matches({ count, n: formatNumber(count) }) : a.total({ count, n: formatNumber(count) });

  return (
    <TabContent className="max-w-3xl">
      <div ref={rootRef}>
        <p className="text-sm text-muted-foreground">{a.intro}</p>
        <p className="mt-1 text-xs text-muted-foreground">{a.syncNote}</p>
      </div>

      <div className="flex flex-col gap-3">
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
                onClick={() => setFilter(f)}
              >
                {a.filters[f]}
              </Button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {entity ? null : (
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={a.search.placeholder}
                aria-label={a.search.label}
                className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
                enterKeyHint="search"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                  }}
                  aria-label={a.search.clear}
                  className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          )}
          <Select value={action} onValueChange={(v) => setAction(v as AuditAction | typeof ALL_ACTIONS)}>
            <SelectTrigger aria-label={a.actionFilter.label} className="w-auto min-w-36 flex-1 sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACTIONS}>{a.actionFilter.all}</SelectItem>
              {AUDIT_ACTIONS.map((act) => (
                <SelectItem key={act} value={act}>
                  {a.actions[act]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {months.length > 1 ? (
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger aria-label={a.monthJump.label} className="w-auto min-w-36 flex-1 sm:flex-none">
                <CalendarSearch className="text-muted-foreground" aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LATEST}>{a.monthJump.latest}</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {locale === "vi" ? a.monthOf({ month: monthLabel(locale, m) }) : monthLabel(locale, m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>

        {status === "ready" || busy ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground" aria-live="polite">
            <p className="tabular-nums">
              {countText}
              {month !== LATEST ? <span> · {a.fromMonth({ month: monthLabel(locale, month) })}</span> : null}
            </p>
            {narrowed ? (
              <Button type="button" variant="ghost" size="sm" className="-my-1" onClick={clearFilters}>
                <X />
                {a.clearFilters}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

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
        <div className={cn("rounded-xl border bg-card transition-opacity", busy && "opacity-60")}>
          {!narrowed && !entity ? (
            <EmptyState illustrated title={a.empty.title} description={a.empty.description} />
          ) : (
            <EmptyState
              icon={History}
              title={entity && !narrowed ? a.emptyFiltered : a.emptyMatches}
              action={
                narrowed ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    {a.clearFilters}
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity duration-200", busy && "pointer-events-none opacity-60")} aria-busy={busy || undefined}>
          {groups.map((g) => (
            // Days far off screen skip layout and paint, so a long history stays smooth.
            <section key={g.day} aria-labelledby={`day-${g.day}`} className="[contain-intrinsic-size:auto_420px] [content-visibility:auto]">
              <h2
                id={`day-${g.day}`}
                className="sticky top-[3.6rem] z-10 -mx-1 mb-2 bg-background/90 px-2 py-1 text-sm font-semibold text-muted-foreground backdrop-blur-sm"
              >
                {g.when === "today" ? a.today : g.when === "yesterday" ? a.yesterday : formatDate(g.day, "medium")}
              </h2>
              <ol className="divide-y overflow-hidden rounded-xl border bg-card">
                {g.entries.map((e, i) => (
                  <EntryRow key={e.id} entry={e} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }} />
                ))}
              </ol>
            </section>
          ))}
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {hasMore ? (
            <Button variant="outline" className="self-center" onClick={() => void loadMore().catch(() => undefined)} disabled={loadingMore}>
              {loadingMore ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  {a.loading}
                </>
              ) : (
                a.loadMore
              )}
            </Button>
          ) : entries.length > 10 ? (
            <div className="flex flex-col items-center gap-2 py-2 text-sm text-muted-foreground">
              <p>{a.endOfList({ count: entries.length, n: formatNumber(entries.length) })}</p>
              <Button variant="ghost" size="sm" onClick={backToTop}>
                <ArrowUp />
                {a.backToTop}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </TabContent>
  );
}
