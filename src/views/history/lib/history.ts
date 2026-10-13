import type { ExpenseCategoryId, ExpenseItem } from "@/entities/expense/model";
import type { IncomeSource } from "@/entities/income/model";
import type { LedgerTxn } from "@/entities/ledger/model";
import { foldSearch } from "@/shared/lib/search-fold";

/** A ledger entry with what the list shows. */
export type HistoryRow = {
  txn: LedgerTxn;
  /** Its own name, else its bill / budget / income source's (null: show the kind). */
  name: string | null;
  category: ExpenseCategoryId | null;
  /** Signed for totals: corrections can be negative. */
  amount: number;
};

export type HistoryFilters = {
  search: string;
  category: ExpenseCategoryId | "all";
  /** An account id, `none` (no account) or `all`. */
  account: string;
  /** A source type or `all`. */
  kind: LedgerTxn["source"]["type"] | "all";
};

export function historyRows(txns: readonly LedgerTxn[], kind: "expense" | "income", items: readonly ExpenseItem[], sources: readonly IncomeSource[]): HistoryRow[] {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const out: HistoryRow[] = [];
  for (const txn of txns) {
    if (txn.kind !== kind) continue;
    const src = txn.source;
    const item = src.type === "bill" || src.type === "budget" ? itemById.get(src.itemId) : undefined;
    const source = src.type === "income" ? sourceById.get(src.sourceId) : undefined;
    out.push({
      txn,
      name: txn.name ?? item?.name ?? source?.name ?? null,
      category: kind === "expense" ? (txn.category ?? item?.category ?? (src.type === "instant" ? "other" : null)) : null,
      amount: txn.amount,
    });
  }
  return out;
}

export function filterRows(rows: readonly HistoryRow[], f: HistoryFilters): HistoryRow[] {
  const q = foldSearch(f.search);
  return rows.filter((r) => {
    if (f.category !== "all" && r.category !== f.category) return false;
    if (f.kind !== "all" && r.txn.source.type !== f.kind) return false;
    if (f.account === "none" ? Boolean(r.txn.accountId) : f.account !== "all" && r.txn.accountId !== f.account) return false;
    if (q && !foldSearch(`${r.name ?? ""} ${r.txn.note ?? ""}`).includes(q)) return false;
    return true;
  });
}

export type MonthGroup = { month: string; total: number; count: number; days: { day: string; rows: HistoryRow[] }[] };

/** Rows (newest first) grouped by month, then day. */
export function groupRows(rows: readonly HistoryRow[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const r of rows) {
    const month = r.txn.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.month !== month) groups.push((g = { month, total: 0, count: 0, days: [] }));
    g.total += r.amount;
    g.count += 1;
    let d = g.days[g.days.length - 1];
    if (!d || d.day !== r.txn.date) g.days.push((d = { day: r.txn.date, rows: [] }));
    d.rows.push(r);
  }
  return groups;
}

export type HistorySummary = {
  thisMonth: { total: number; count: number };
  /** Average per month over finished months with records (up to the last 6), or null. */
  average: { value: number; months: number } | null;
  /** Biggest category (spending) or income source by total over the same months plus this one. */
  top: { key: string; label: string | null; category: ExpenseCategoryId | null; total: number } | null;
};

export function summarize(rows: readonly HistoryRow[], today: string): HistorySummary {
  const thisMonthKey = today.slice(0, 7);
  const byMonth = new Map<string, number>();
  let tm = { total: 0, count: 0 };
  for (const r of rows) {
    const m = r.txn.date.slice(0, 7);
    if (r.txn.date > today) continue;
    if (m === thisMonthKey) tm = { total: tm.total + r.amount, count: tm.count + 1 };
    byMonth.set(m, (byMonth.get(m) ?? 0) + r.amount);
  }
  const finished = [...byMonth.entries()].filter(([m]) => m < thisMonthKey).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 6);
  const average = finished.length ? { value: finished.reduce((s, [, v]) => s + v, 0) / finished.length, months: finished.length } : null;
  const window = new Set([thisMonthKey, ...finished.map(([m]) => m)]);
  const totals = new Map<string, { label: string | null; category: ExpenseCategoryId | null; total: number }>();
  for (const r of rows) {
    if (!window.has(r.txn.date.slice(0, 7)) || r.txn.date > today) continue;
    const key = r.category ?? (r.txn.source.type === "income" ? `src:${r.txn.source.sourceId}` : r.txn.source.type);
    const t = totals.get(key) ?? { label: r.category ? null : r.name, category: r.category, total: 0 };
    t.total += r.amount;
    totals.set(key, t);
  }
  let top: HistorySummary["top"] = null;
  for (const [key, v] of totals) if (v.total > 0 && (!top || v.total > top.total)) top = { key, ...v };
  return { thisMonth: tm, average, top };
}
