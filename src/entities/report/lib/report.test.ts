import { describe, expect, it } from "vitest";

import type { ExpenseItem } from "@/entities/expense/model";
import type { IncomeSource } from "@/entities/income/model";
import type { LedgerTxn } from "@/entities/ledger/model";

import { buildSharedReport, reportTotals, resolvePeriod, type ReportInput } from "./build";
import { sanitizeSharedReport } from "./sanitize";

const txn = (p: Partial<LedgerTxn> & Pick<LedgerTxn, "id" | "date" | "amount">): LedgerTxn => ({
  kind: "expense",
  at: `${p.date}T05:00:00.000Z`,
  source: { type: "instant" },
  ...p,
});

const items: ExpenseItem[] = [
  { id: "food", name: "Ăn uống", category: "food", kind: "budget", amount: 5_000_000, frequency: "monthly", createdAt: "2026-01-01" },
  { id: "rent", name: "Tiền nhà", category: "housing", kind: "bill", amount: 8_000_000, frequency: "monthly", createdAt: "2026-01-01" },
];
const sources = [{ id: "salary", name: "Lương", monthly: 30_000_000 }] as IncomeSource[];

const txns: LedgerTxn[] = [
  txn({ id: "1", date: "2026-08-03", amount: 8_000_000, source: { type: "bill", itemId: "rent", month: "2026-08" } }),
  txn({ id: "2", date: "2026-08-10", amount: 1_200_000, source: { type: "budget", itemId: "food", month: "2026-08" } }),
  txn({ id: "3", date: "2026-08-05", amount: 30_000_000, kind: "income", source: { type: "income", sourceId: "salary", month: "2026-08" } }),
  txn({ id: "4", date: "2026-09-12", amount: 300_000, name: "Grab", category: "transport" }),
  txn({ id: "5", date: "2026-09-20", amount: 2_000_000, kind: "income", source: { type: "extra" }, name: "Thưởng" }),
  txn({ id: "6", date: "2026-10-02", amount: 900_000, source: { type: "budget", itemId: "food", month: "2026-10" }, name: "Highlands" }),
  txn({ id: "7", date: "2026-07-30", amount: 500_000, kind: "income", source: { type: "income", sourceId: "gone", month: "2026-07" } }),
  // After "today": not in the report yet.
  txn({ id: "8", date: "2026-10-20", amount: 1, source: { type: "budget", itemId: "food", month: "2026-10" } }),
];

const base: ReportInput = {
  title: "  Báo cáo quý 3 ",
  period: { all: false, from: "2026-08", to: "2026-10" },
  sections: ["cashflow", "categories", "income", "netWorth"],
  today: "2026-10-15",
  now: "2026-10-15T03:00:00.000Z",
  txns,
  items,
  sources,
  netWorth: {
    history: [
      { monthKey: "2026-07", value: 900 },
      { monthKey: "2026-08", value: 1000 },
      { monthKey: "2026-09", value: 1100.4 },
      { monthKey: "2026-10", value: 1150 },
    ],
    assets: 2000,
    debts: 800,
    netWorth: 1200,
    byCategory: [
      { label: "Tiền mặt", value: 500 },
      { label: "Nhà", value: 1500 },
      { label: "Trống", value: 0 },
    ],
  },
};

describe("resolvePeriod", () => {
  it("clamps a range to this month and orders it", () => {
    expect(resolvePeriod({ ...base, period: { all: false, from: "2026-08", to: "2027-01" } })).toEqual({ from: "2026-08", to: "2026-10", all: false });
    expect(resolvePeriod({ ...base, period: { all: false, from: "2026-11", to: "2026-09" } })).toEqual({ from: "2026-09", to: "2026-09", all: false });
  });

  it("starts 'all time' at the first record (net worth history too when shown)", () => {
    expect(resolvePeriod({ ...base, period: { all: true }, sections: ["cashflow"] })).toEqual({ from: "2026-07", to: "2026-10", all: true });
    expect(resolvePeriod({ ...base, period: { all: true }, netWorth: { ...base.netWorth, history: [{ monthKey: "2025-01", value: 1 }] } }).from).toBe("2025-01");
    expect(resolvePeriod({ ...base, period: { all: true }, txns: [], sections: ["cashflow"] })).toEqual({ from: "2026-10", to: "2026-10", all: true });
  });

  it("covers at most ten years", () => {
    expect(resolvePeriod({ ...base, period: { all: false, from: "2001-01", to: "2026-10" } }).from).toBe("2016-11");
  });
});

describe("buildSharedReport", () => {
  it("adds up money in and out per month, up to today", () => {
    const r = buildSharedReport(base);
    expect(r.title).toBe("Báo cáo quý 3");
    expect(r.months).toEqual([
      { month: "2026-08", income: 30_000_000, spending: 9_200_000 },
      { month: "2026-09", income: 2_000_000, spending: 300_000 },
      { month: "2026-10", income: 0, spending: 900_000 },
    ]);
    expect(reportTotals(r)).toEqual({ income: 32_000_000, spending: 10_400_000, net: 21_600_000, savingsRate: 21_600_000 / 32_000_000, monthlySpending: 10_400_000 / 3 });
  });

  it("groups spending by category and by bill / budget name", () => {
    const r = buildSharedReport(base);
    expect(r.categories).toEqual([
      { category: "housing", total: 8_000_000 },
      { category: "food", total: 2_100_000 },
      { category: "transport", total: 300_000 },
    ]);
    expect(r.topItems).toEqual([
      { name: "Tiền nhà", category: "housing", total: 8_000_000 },
      { name: "Ăn uống", category: "food", total: 2_100_000 },
      { name: "Grab", category: "transport", total: 300_000 },
    ]);
  });

  it("lists income by source, with the rest as other money in", () => {
    expect(buildSharedReport(base).income).toEqual({ sources: [{ name: "Lương", total: 30_000_000 }], other: 2_000_000 });
    // A deleted source counts as other.
    expect(buildSharedReport({ ...base, period: { all: true } }).income).toEqual({ sources: [{ name: "Lương", total: 30_000_000 }], other: 2_500_000 });
  });

  it("takes month-end net worth in the period plus today's value", () => {
    expect(buildSharedReport(base).netWorth).toEqual({
      history: [
        { month: "2026-08", value: 1000 },
        { month: "2026-09", value: 1100 },
        { month: "2026-10", value: 1200 },
      ],
      assets: 2000,
      debts: 800,
      netWorth: 1200,
      byCategory: [
        { label: "Nhà", value: 1500 },
        { label: "Tiền mặt", value: 500 },
      ],
    });
  });

  it("leaves out sections that weren't chosen (money in / out is always in)", () => {
    const r = buildSharedReport({ ...base, sections: [] });
    expect(r.sections).toEqual(["cashflow"]);
    expect(r).not.toHaveProperty("categories");
    expect(r).not.toHaveProperty("income");
    expect(r).not.toHaveProperty("netWorth");
  });
});

describe("sanitizeSharedReport", () => {
  it("accepts a built report unchanged", () => {
    const r = buildSharedReport(base);
    expect(sanitizeSharedReport(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });

  it("drops sections not listed and refuses broken ones", () => {
    const r = buildSharedReport(base);
    const trimmed = sanitizeSharedReport({ ...r, sections: ["cashflow"] });
    expect(trimmed).not.toHaveProperty("income");
    expect(trimmed).not.toHaveProperty("netWorth");
    expect(sanitizeSharedReport({ ...r, income: { sources: "x", other: 1 } })).toBeNull();
    expect(sanitizeSharedReport({ ...r, months: [{ month: "2026-13", income: 1, spending: 1 }] })).toBeNull();
    expect(sanitizeSharedReport({ ...r, sections: ["income"] })).toBeNull(); // no cashflow
    expect(sanitizeSharedReport({ ...r, v: 2 })).toBeNull();
    expect(sanitizeSharedReport({ ...r, title: " " })).toBeNull();
    expect(sanitizeSharedReport(null)).toBeNull();
  });
});
