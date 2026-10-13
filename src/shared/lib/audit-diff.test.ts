import { describe, expect, it } from "vitest";

import { diffTable, expenseNamesOf, fieldChanges, jsonEqual } from "@/shared/lib/audit-diff";

describe("jsonEqual", () => {
  it("compares structure, treating a missing key as undefined", () => {
    expect(jsonEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(jsonEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(jsonEqual([1, 2], [2, 1])).toBe(false);
    expect(jsonEqual(null, {})).toBe(false);
  });
});

describe("fieldChanges", () => {
  it("lists changed fields, one level into nested groups", () => {
    expect(
      fieldChanges(
        { name: "Xe", balance: 100, milestone: { birthDate: "1990-01-01", targetAge: 40 } },
        { name: "Xe", balance: 90, milestone: { birthDate: "1990-01-01", targetAge: 45 }, note: "mới" },
      ),
    ).toEqual([
      { field: "balance", before: 100, after: 90 },
      { field: "milestone.targetAge", before: 40, after: 45 },
      { field: "note", before: null, after: "mới" },
    ]);
  });
});

describe("diffTable", () => {
  const debt = { id: "d1", name: "Vay mua xe", balance: 380_000_000, monthlyPayment: 8_500_000 };

  it("logs every record as added on the first save", () => {
    const out = diffTable("debts", null, [debt]);
    expect(out).toEqual([{ entityType: "debt", entityId: "d1", entityName: "Vay mua xe", action: "add", changes: null, before: null, after: debt }]);
  });

  it("logs edits with the changed fields and both versions", () => {
    const edited = { ...debt, monthlyPayment: 9_000_000 };
    const [e] = diffTable("debts", [debt], [edited]);
    expect(e.action).toBe("update");
    expect(e.changes).toEqual([{ field: "monthlyPayment", before: 8_500_000, after: 9_000_000 }]);
    expect(e.before).toEqual(debt);
    expect(e.after).toEqual(edited);
  });

  it("logs removals with the last version, and nothing when unchanged", () => {
    expect(diffTable("debts", [debt], [])).toEqual([
      { entityType: "debt", entityId: "d1", entityName: "Vay mua xe", action: "remove", changes: null, before: debt, after: null },
    ]);
    expect(diffTable("debts", [debt], [{ ...debt }])).toEqual([]);
  });

  it("names a loan after the person and ignores records without an id", () => {
    const out = diffTable("personalLoans", [], [{ id: "l1", person: "Minh", amount: 5 }, { person: "no id" }]);
    expect(out.map((e) => [e.entityType, e.entityName])).toEqual([["personal_loan", "Minh"]]);
  });

  it("tracks bills and the old spending estimate in the expenses table", () => {
    const before = { items: [{ id: "b1", name: "Tiền điện", amount: 1_200_000 }] };
    const after = {
      items: [{ id: "b1", name: "Tiền điện", amount: 1_300_000 }, { id: "b2", name: "Tiền nước", amount: 200_000 }],
      legacyEstimate: { retiredAt: "2026-10-13", amount: 25_000_000 },
    };
    const out = diffTable("expenses", before, after);
    expect(out.map((e) => [e.entityType, e.entityId, e.action])).toEqual([
      ["expense", "b1", "update"],
      ["expense", "b2", "add"],
      ["spending_estimate", "legacy", "add"],
    ]);
  });

  it("logs each month's check-off as its own record, named after the bill", () => {
    const names = expenseNamesOf({ items: [{ id: "b1", name: "Tiền điện" }] });
    const before = { months: { "2026-10": { g1: { spent: 100 } } } };
    const after = { months: { "2026-10": { g1: { spent: 250 }, b1: { payments: [{ amount: 1_450_000, date: "2026-10-15" }] } } } };
    const out = diffTable("expenseLog", before, after, { expenseNames: names });
    expect(out).toEqual([
      {
        entityType: "expense_month",
        entityId: "2026-10:g1",
        entityName: null,
        action: "update",
        changes: [{ field: "spent", before: 100, after: 250 }],
        before: { spent: 100 },
        after: { spent: 250 },
      },
      {
        entityType: "expense_month",
        entityId: "2026-10:b1",
        entityName: "Tiền điện",
        action: "add",
        changes: null,
        before: null,
        after: { payments: [{ amount: 1_450_000, date: "2026-10-15" }] },
      },
    ]);
  });

  it("logs settings as one record, leaving out view state and recomputed net worth", () => {
    const before = { averageMonthlySpending: 25_000_000, lastKnownNetWorth: 1, allocationsBandFilter: "both" };
    expect(diffTable("preferences", before, { ...before, lastKnownNetWorth: 2, allocationsBandFilter: "instant" })).toEqual([]);
    const [e] = diffTable("preferences", before, { ...before, averageMonthlySpending: 20_000_000, setup: { noDebts: true } });
    expect(e.entityType).toBe("settings");
    expect(e.changes).toEqual([
      { field: "averageMonthlySpending", before: 25_000_000, after: 20_000_000 },
      { field: "setup.noDebts", before: null, after: true },
    ]);
    expect(e.after).not.toHaveProperty("lastKnownNetWorth");
  });

  it("logs goal plans but not which plan is open", () => {
    const plan = { id: "g1", name: "Đổi xe", targetAmount: 900_000_000 };
    const goals = (activeProfileId: string, profiles = [plan]) => ({ primary: { name: "", targetAmount: 0, saved: 0 }, profiles, activeProfileId });
    expect(diffTable("goals", goals("g1"), goals(""))).toEqual([]);
    const out = diffTable("goals", goals("g1"), goals("g1", [{ ...plan, targetAmount: 1e9 }]));
    expect(out.map((e) => [e.entityType, e.action, e.changes])).toEqual([
      ["goal_plan", "update", [{ field: "targetAmount", before: 900_000_000, after: 1e9 }]],
    ]);
  });

  it("splits the old holdings store into its three kinds", () => {
    const out = diffTable("assets", null, {
      realEstate: [{ id: "r1", name: "Căn hộ" }],
      cashAccounts: [{ id: "c1", category: "Tiết kiệm", details: "Techcombank" }],
      investments: [],
    });
    expect(out.map((e) => [e.entityType, e.entityName])).toEqual([
      ["legacy_real_estate", "Căn hộ"],
      ["legacy_cash", "Tiết kiệm · Techcombank"],
    ]);
  });
});
