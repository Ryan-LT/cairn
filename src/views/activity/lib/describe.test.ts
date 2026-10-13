import { describe, expect, it } from "vitest";

import { groupByDay, headlineAmount, monthSummary, splitMonthId, valueView } from "./describe";

describe("valueView", () => {
  it("picks money, percent, dates and labels by field", () => {
    expect(valueView("monthlyPayment", 8_500_000)).toEqual({ kind: "money", amount: 8_500_000 });
    expect(valueView("milestone.targetUsd", 1_000_000)).toEqual({ kind: "usd", amount: 1_000_000 });
    expect(valueView("ratePct", 9.5)).toEqual({ kind: "percent", value: 9.5 });
    expect(valueView("dueDay", 15)).toEqual({ kind: "number", value: 15 });
    expect(valueView("archivedAt", "2026-10-13")).toEqual({ kind: "date", iso: "2026-10-13" });
    expect(valueView("category", "utilities")).toEqual({ kind: "category", id: "utilities" });
    expect(valueView("kind", "bill")).toEqual({ kind: "expenseKind", id: "bill" });
    expect(valueView("kind", "active")).toEqual({ kind: "text", text: "active" });
    expect(valueView("autopay", false)).toEqual({ kind: "bool", value: false });
    expect(valueView("note", "")).toEqual({ kind: "empty" });
    expect(valueView("note", undefined)).toEqual({ kind: "empty" });
  });

  it("summarises lists", () => {
    expect(valueView("payments", [{ amount: 1_000 }, { amount: 450 }])).toEqual({ kind: "payments", total: 1_450, count: 2 });
    expect(valueView("seedLines", [{ amount: 5 }, { amount: 7 }])).toEqual({ kind: "moneyList", total: 12, count: 2 });
    expect(valueView("checkpoints", [{}, {}, {}])).toEqual({ kind: "count", count: 3 });
    expect(valueView("extraAssetCategories", ["Xe", "Đồng hồ"])).toEqual({ kind: "text", text: "Xe, Đồng hồ" });
  });
});

describe("month check-offs", () => {
  it("splits the record id and reads what was paid or spent", () => {
    expect(splitMonthId("2026-10:b-elec")).toEqual({ month: "2026-10", itemId: "b-elec" });
    expect(monthSummary({ action: "add", before: null, after: { payments: [{ amount: 1_450_000 }] } })).toEqual({ paid: { total: 1_450_000, count: 1 } });
    expect(monthSummary({ action: "update", before: {}, after: { spent: 250_000 } })).toEqual({ spent: 250_000 });
    expect(monthSummary({ action: "remove", before: { skipped: true }, after: null })).toEqual({ skipped: true });
  });
});

describe("headlineAmount", () => {
  it("uses the record's main amount, from the old version when removed", () => {
    expect(headlineAmount({ action: "add", before: null, after: { name: "Vàng", currentValue: 210_000_000 } })).toBe(210_000_000);
    expect(headlineAmount({ action: "remove", before: { balance: 18_000_000 }, after: null })).toBe(18_000_000);
    expect(headlineAmount({ action: "add", before: null, after: { name: "x" } })).toBeNull();
  });
});

describe("groupByDay", () => {
  it("groups newest-first entries into today, yesterday and earlier days", () => {
    const now = new Date(2026, 9, 13, 15, 0);
    const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString();
    const groups = groupByDay([{ at: at(13, 9) }, { at: at(13, 8) }, { at: at(12, 22) }, { at: at(3, 10) }], now);
    expect(groups.map((g) => [g.day, g.when, g.entries.length])).toEqual([
      ["2026-10-13", "today", 2],
      ["2026-10-12", "yesterday", 1],
      ["2026-10-03", "earlier", 1],
    ]);
  });
});
