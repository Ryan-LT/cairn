"use client";

import { ArrowUp, Gift, Plus, Search, TrendingUp, X, Zap } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CategoryTile, EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from "@/entities/expense";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { useIncomeSources } from "@/entities/income";
import { isAccountAsset, useLedger, type LedgerTxn } from "@/entities/ledger";
import { resolveAssetCategoryEmoji, useSettingsAssets } from "@/entities/settings-asset";
import { TxnSheet, type TxnSheetMode } from "@/features/record-transaction";
import { useI18n } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import { formatDate, formatMoney, formatNumber } from "@/shared/lib/format";
import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { EmptyState } from "@/shared/ui/empty-state";
import { IconTile } from "@/shared/ui/icon-tile";
import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";
import { HelpHint } from "@/shared/ui/help-hint";
import { Card } from "@/shared/ui/kit/card";
import { Input } from "@/shared/ui/kit/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Money } from "@/shared/ui/money";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { filterRows, groupRows, historyRows, summarize, type HistoryFilters, type HistoryRow } from "../lib/history";

const PAGE = 60;
const SEARCH_DEBOUNCE_MS = 250;
const EXPENSE_KINDS = ["bill", "budget", "instant"] as const;
const INCOME_KINDS = ["income", "extra"] as const;
type View = "expense" | "income";

/** "Hôm nay", "Hôm qua", or the date. */
function dayLabel(day: string, today: string, t: { today: string; yesterday: string }): string {
  if (day === today) return t.today;
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  if (day === todayIso(y)) return t.yesterday;
  return formatDate(day, "medium");
}

function monthLabel(locale: string, month: string, vi: (p: { month: string }) => string): string {
  const [y, m] = month.split("-");
  return locale === "vi" ? vi({ month: `${Number(m)}/${y}` }) : formatDate(`${month}-01`, "monthYear");
}

/** Cashflow › History: every payment out and every payment in, day by day. */
export function HistoryPage() {
  const { t, locale } = useI18n();
  const l = t.ledger;
  const h = l.history;
  const params = useSearchParams();
  const router = useRouter();
  const pathname = useAppPathname();
  const view: View = params.get("view") === "income" ? "income" : "expense";
  const ledger = useLedger();
  const { expenses } = useExpenses();
  const [sources] = useIncomeSources();
  const [assets] = useSettingsAssets();
  const accounts = useMemo(() => assets.filter(isAccountAsset), [assets]);
  const accountById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const [sheet, setSheet] = useState<TxnSheetMode | null>(null);
  const [searchInput, setSearchInput] = useState("");
  // `?account=` (from an asset) opens the list on that account.
  const [filters, setFilters] = useState<HistoryFilters>(() => ({ search: "", category: "all", account: params.get("account") ?? "all", kind: "all" }));
  const [shown, setShown] = useState(PAGE);
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const today = todayIso();

  useCreateParam(() => setSheet(view === "income" ? { kind: "extra" } : { kind: "instant" }));

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput }));
      setShown(PAGE);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const rows = useMemo(() => historyRows(ledger.txns, view, expenses.items, sources), [ledger.txns, view, expenses.items, sources]);
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const summary = useMemo(() => summarize(rows, today), [rows, today]);
  const visible = useMemo(() => filtered.slice(0, shown), [filtered, shown]);
  const groups = useMemo(() => groupRows(visible), [visible]);
  // Month totals over everything matching, not just the rows shown so far.
  const monthTotals = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const g of groupRows(filtered)) m.set(g.month, { total: g.total, count: g.count });
    return m;
  }, [filtered]);
  const narrowed = filters.search.trim() !== "" || filters.category !== "all" || filters.account !== "all" || filters.kind !== "all";
  const hasMore = shown < filtered.length;
  const filteredTotal = filtered.reduce((s, r) => s + r.amount, 0);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((items) => items.some((i) => i.isIntersecting) && setShown((n) => n + PAGE), { rootMargin: "0px 0px 600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shown]);

  const setView = (v: View) => {
    const q = new URLSearchParams(params.toString());
    if (v === "income") q.set("view", "income");
    else q.delete("view");
    setFilters((f) => ({ ...f, category: "all", kind: "all" }));
    setShown(PAGE);
    router.replace(q.size ? `${pathname}?${q}` : pathname, { scroll: false });
  };

  const clearFilters = () => {
    setSearchInput("");
    setFilters({ search: "", category: "all", account: "all", kind: "all" });
  };

  const save = (txn: LedgerTxn) => {
    const existed = ledger.txns.some((x) => x.id === txn.id);
    ledger.put(txn);
    if (existed) toast.success(l.edit.saved);
    else toast.success(txn.kind === "expense" ? l.instant.saved({ amount: formatMoney(txn.amount) }) : l.extra.saved({ amount: formatMoney(txn.amount) }));
  };

  const remove = (txn: LedgerTxn) => {
    ledger.remove([txn.id]);
    toast.success(l.edit.deleted, { action: { label: t.common.undo, onClick: () => ledger.restore([txn]) } });
  };

  const titleFor = (r: HistoryRow) => r.name ?? l.kinds[r.txn.source.type];

  const backToTop = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rootRef.current?.closest("main")?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  const kinds = view === "expense" ? EXPENSE_KINDS : INCOME_KINDS;
  const isExpense = view === "expense";
  const top = summary.top;

  return (
    <TabContent>
      <TabToolbar
        actions={
          <Button onClick={() => setSheet(isExpense ? { kind: "instant" } : { kind: "extra" })}>
            {isExpense ? <Zap /> : <Plus />}
            {isExpense ? h.addExpense : h.addIncome}
          </Button>
        }
      >
        <div ref={rootRef}>
          <SegmentedControl<View>
            aria-label={h.viewLabel}
            value={view}
            onValueChange={setView}
            options={[
              { value: "expense", label: h.views.expense },
              { value: "income", label: h.views.income },
            ]}
          />
        </div>
      </TabToolbar>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="gap-1 px-5 py-4" data-help="historyThisMonth">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {h.summaryThisMonth}
            <HelpHint topic="historyThisMonth" className="-my-1" />
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            <Money value={summary.thisMonth.total} compact tone={isExpense ? "none" : "success"} />
          </p>
          <p className="text-xs text-muted-foreground">{h.summaryCount({ count: summary.thisMonth.count })}</p>
        </Card>
        <Card className="gap-1 px-5 py-4" data-help="historyAverage">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {h.summaryAverage}
            <HelpHint topic="historyAverage" className="-my-1" />
          </p>
          <p className="text-2xl font-semibold tracking-tight">{summary.average ? <Money value={summary.average.value} compact /> : "—"}</p>
          <p className="text-xs text-muted-foreground">{summary.average ? h.averageHint({ months: summary.average.months }) : " "}</p>
        </Card>
        <Card className="gap-1 px-5 py-4" data-help="historyTop">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {isExpense ? h.summaryTop : h.summaryTopIncome}
            <HelpHint topic="historyTop" className="-my-1" />
          </p>
          <div className="flex min-w-0 items-center gap-2">
            {top?.category ? <CategoryTile category={top.category} size="sm" /> : null}
            <p className="truncate text-lg font-semibold">{top ? (top.category ? t.expenses.categories[top.category] : (top.label ?? l.kinds.extra)) : "—"}</p>
          </div>
          <p className="text-xs text-muted-foreground">{top ? <Money value={top.total} compact interactive={false} /> : " "}</p>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={h.searchPlaceholder}
              aria-label={h.searchLabel}
              className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label={h.clearSearch}
                className="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          {isExpense ? (
            <Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v as ExpenseCategoryId | "all" }))}>
              <SelectTrigger aria-label={h.categoryLabel} className="w-auto min-w-36 flex-1 sm:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">{h.allCategories}</SelectItem>
                <SelectSeparator />
                {EXPENSE_CATEGORY_IDS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t.expenses.categories[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select value={filters.kind} onValueChange={(v) => setFilters((f) => ({ ...f, kind: v as HistoryFilters["kind"] }))}>
            <SelectTrigger aria-label={h.kindLabel} className="w-auto min-w-32 flex-1 sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{h.allKinds}</SelectItem>
              {kinds.map((k) => (
                <SelectItem key={k} value={k}>
                  {l.kinds[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.account} onValueChange={(v) => setFilters((f) => ({ ...f, account: v }))}>
            <SelectTrigger aria-label={h.accountLabel} className="w-auto min-w-36 flex-1 sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">{h.allAccounts}</SelectItem>
              <SelectItem value="none">{h.noAccount}</SelectItem>
              {accounts.length ? <SelectSeparator /> : null}
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {resolveAssetCategoryEmoji(a.category)} {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {narrowed && filtered.length ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground" aria-live="polite">
            <p className="tabular-nums" data-private>
              {h.matches({ count: filtered.length, amount: formatMoney(filteredTotal) })}
            </p>
            <Button type="button" variant="ghost" size="sm" className="-my-1" onClick={clearFilters}>
              <X />
              {h.clearFilters}
            </Button>
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <Card className="gap-0 py-0">
          {narrowed ? (
            <EmptyState
              art="search"
              title={h.emptyFiltered}
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  {h.clearFilters}
                </Button>
              }
            />
          ) : (
            <EmptyState
              art={isExpense ? "receipts" : "sprout"}
              title={isExpense ? h.emptyExpense.title : h.emptyIncome.title}
              description={isExpense ? h.emptyExpense.description : h.emptyIncome.description}
              action={
                <Button onClick={() => setSheet(isExpense ? { kind: "instant" } : { kind: "extra" })}>
                  {isExpense ? <Zap /> : <Plus />}
                  {isExpense ? h.addExpense : h.addIncome}
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => {
            const totals = monthTotals.get(g.month) ?? { total: g.total, count: g.count };
            return (
              <section key={g.month} aria-labelledby={`m-${g.month}`} className="[contain-intrinsic-size:auto_640px] [content-visibility:auto]">
                <div className="sticky top-[3.6rem] z-10 -mx-1 mb-2 flex items-baseline justify-between gap-3 bg-background/90 px-2 py-1.5 backdrop-blur-sm">
                  <h2 id={`m-${g.month}`} className="font-semibold">
                    {monthLabel(locale, g.month, t.activity.monthOf)}
                  </h2>
                  <p className="text-sm text-muted-foreground tabular-nums" data-private>
                    {h.monthTotal({ count: totals.count, amount: formatMoney(totals.total) })}
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  {g.days.map((d) => (
                    <div key={d.day}>
                      <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{dayLabel(d.day, today, t.activity)}</p>
                      <ol className="divide-y overflow-hidden rounded-xl border bg-card">
                        {d.rows.map((r, i) => {
                          const txn = r.txn;
                          const account = txn.accountId ? accountById.get(txn.accountId) : undefined;
                          const edited = txn.originalAmount !== undefined && txn.originalAmount !== txn.amount;
                          return (
                            <li key={txn.id} className="motion-safe:animate-row-in" style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}>
                              <button
                                type="button"
                                onClick={() => setSheet({ kind: "edit", txn, title: titleFor(r) })}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                              >
                                {r.category ? (
                                  <CategoryTile category={r.category} />
                                ) : (
                                  <IconTile icon={txn.source.type === "extra" ? Gift : TrendingUp} color="var(--success)" background="color-mix(in oklab, var(--success) 14%, transparent)" />
                                )}
                                <span className="grid min-w-0 flex-1 gap-0.5">
                                  <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate font-medium">{titleFor(r)}</span>
                                    {txn.auto ? <Badge variant="neutral">{l.badges.auto}</Badge> : null}
                                    {edited ? <Badge variant="info">{l.badges.edited}</Badge> : null}
                                    {txn.correction ? <Badge variant="neutral">{l.badges.correction}</Badge> : null}
                                    {txn.legacy && txn.source.type === "budget" ? <Badge variant="neutral">{l.badges.legacy}</Badge> : null}
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {[l.kinds[txn.source.type], account ? `${resolveAssetCategoryEmoji(account.category)} ${account.name}` : txn.accountId ? l.account.deleted : null, txn.note]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                </span>
                                <span className="flex flex-col items-end">
                                  <Money
                                    value={r.amount}
                                    signed={!isExpense}
                                    tone={isExpense ? (r.amount < 0 ? "success" : "none") : "success"}
                                    interactive={false}
                                    className="font-semibold"
                                  />
                                  {txn.amountUsd ? (
                                    <span className="text-xs text-muted-foreground tabular-nums" data-private>
                                      ${formatNumber(txn.amountUsd, { maximumFractionDigits: 2 })}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {hasMore ? (
            <Button variant="outline" className="self-center" onClick={() => setShown((n) => n + PAGE)}>
              {h.loadMore}
            </Button>
          ) : filtered.length > 12 ? (
            <div className="flex flex-col items-center gap-2 py-2 text-sm text-muted-foreground">
              <p>{h.endOfList({ count: filtered.length })}</p>
              <Button variant="ghost" size="sm" onClick={backToTop}>
                <ArrowUp />
                {h.backToTop}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <TxnSheet mode={sheet} onOpenChange={(o) => !o && setSheet(null)} onSave={save} onDelete={remove} />
    </TabContent>
  );
}
