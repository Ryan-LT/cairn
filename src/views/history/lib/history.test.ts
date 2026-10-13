import { describe, expect, it } from "vitest";

import type { ExpenseItem } from "@/entities/expense/model";
import type { IncomeSource } from "@/entities/income/model";
import { compareTxnsDesc } from "@/entities/ledger/lib/ops";
import type { LedgerTxn } from "@/entities/ledger/model";

import { filterRows, groupRows, historyRows, summarize } from "./history";

const t = (p: Partial<LedgerTxn> & Pick<LedgerTxn, "id" | "date" | "amount">): LedgerTxn => ({ kind: "expense", at: `${p.date}T05:00:00.000Z`, source: { type: "instant" }, ...p });
const items: ExpenseItem[] = [{ id: "food", name: "Đi chợ", category: "food", kind: "budget", amount: 1, frequency: "monthly", createdAt: "2026-01-01" }];
const sources: IncomeSource[] = [{ id: "sal", kind: "active", name: "Lương", details: "", icon: "work", monthly: 1 }];
const txns: LedgerTxn[] = [
  t({ id: "a", date: "2026-10-12", amount: 50_000, name: "Cà phê", category: "food", accountId: "cash" }),
  t({ id: "b", date: "2026-10-12", amount: 300_000, source: { type: "budget", itemId: "food", month: "2026-10" }, note: "Xăng xe tuần này" }),
  t({ id: "c", date: "2026-09-30", amount: 1_000_000, source: { type: "budget", itemId: "food", month: "2026-09" } }),
  t({ id: "d", date: "2026-08-15", amount: 2_000_000, name: "Sửa xe", category: "transport" }),
  t({ id: "e", date: "2026-10-05", amount: 30_000_000, kind: "income", source: { type: "income", sourceId: "sal", month: "2026-10" } }),
  t({ id: "f", date: "2026-10-20", amount: 9, name: "Ngày mai" }),
];

describe("history", () => {
  const rows = historyRows(txns, "expense", items, sources);

  it("names rows after their item and keeps only one kind", () => {
    expect(rows.map((r) => [r.txn.id, r.name, r.category])).toEqual([
      ["a", "Cà phê", "food"],
      ["b", "Đi chợ", "food"],
      ["c", "Đi chợ", "food"],
      ["d", "Sửa xe", "transport"],
      ["f", "Ngày mai", "other"],
    ]);
    expect(historyRows(txns, "income", items, sources).map((r) => [r.name, r.category])).toEqual([["Lương", null]]);
  });

  it("filters by search (accents ignored), category, kind and account", () => {
    const base = { search: "", category: "all" as const, account: "all", kind: "all" as const };
    expect(filterRows(rows, { ...base, search: "xang" }).map((r) => r.txn.id)).toEqual(["b"]);
    expect(filterRows(rows, { ...base, category: "transport" }).map((r) => r.txn.id)).toEqual(["d"]);
    expect(filterRows(rows, { ...base, kind: "budget" }).map((r) => r.txn.id)).toEqual(["b", "c"]);
    expect(filterRows(rows, { ...base, account: "cash" }).map((r) => r.txn.id)).toEqual(["a"]);
    expect(filterRows(rows, { ...base, account: "none" }).map((r) => r.txn.id)).toEqual(["b", "c", "d", "f"]);
  });

  it("groups by month and day with totals", () => {
    // The ledger hands rows over newest first.
    const g = groupRows(historyRows([...txns].sort(compareTxnsDesc), "expense", items, sources));
    expect(g.map((m) => [m.month, m.count, m.total])).toEqual([
      ["2026-10", 3, 350_009],
      ["2026-09", 1, 1_000_000],
      ["2026-08", 1, 2_000_000],
    ]);
    expect(g[0].days.map((d) => [d.day, d.rows.length])).toEqual([
      ["2026-10-20", 1],
      ["2026-10-12", 2],
    ]);
  });

  it("summarizes this month, the monthly average and the biggest category (future dates left out)", () => {
    const s = summarize(rows, "2026-10-13");
    expect(s.thisMonth).toEqual({ total: 350_000, count: 2 });
    expect(s.average).toEqual({ value: 1_500_000, months: 2 });
    expect(s.top).toMatchObject({ category: "transport", total: 2_000_000 });
    expect(summarize([], "2026-10-13")).toEqual({ thisMonth: { total: 0, count: 0 }, average: null, top: null });
  });
});
