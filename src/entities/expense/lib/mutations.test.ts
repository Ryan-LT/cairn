import { describe, expect, it } from "vitest";

import { fixtureDebts, fixtureExpenseLog, fixtureExpenses } from "@/test/fixtures/tables";

import { EXPENSE_TEMPLATES } from "../config/templates";
import type { ExpenseLogDoc, ExpensesDoc } from "../model";
import { needsWantsSavings, spendingByCategory } from "./breakdown";
import { orphanedLinks, suggestDebtBills } from "./debt-links";
import { planVsActual } from "./history";
import {
  addBudgetSpend,
  clearBillPayments,
  createItemFromTemplate,
  pruneExpenseLog,
  recordBillPayment,
  removeExpenseItem,
  retireLegacyEstimate,
  setBillSkipped,
  setMonthEntry,
  unretireLegacyEstimate,
  upsertExpenseItem,
} from "./mutations";
import { sanitizeExpenseLog, sanitizeExpensesDoc } from "./sanitize";

const NOW = new Date(2026, 9, 13, 10);

describe("expense log mutations", () => {
  it("records, clears and skips bill payments", () => {
    let log: ExpenseLogDoc = { months: {} };
    const t = { monthKey: "2026-10", itemId: "e5", planned: 7_000_000 };
    log = recordBillPayment(log, { ...t, amount: 7_000_000.4, date: "2026-10-15" }, NOW);
    expect(log.months["2026-10"].e5).toEqual({ payments: [{ amount: 7_000_000, date: "2026-10-15" }], planned: 7_000_000 });
    log = clearBillPayments(log, "2026-10", "e5", NOW);
    expect(log.months["2026-10"]).toBeUndefined();
    log = setBillSkipped(log, { ...t, skipped: true }, NOW);
    expect(log.months["2026-10"].e5).toMatchObject({ skipped: true });
    // Paying un-skips.
    log = recordBillPayment(log, { ...t, amount: 1, date: "2026-10-15" }, NOW);
    expect(log.months["2026-10"].e5.skipped).toBeUndefined();
  });

  it("adds budget spending but never goes below zero", () => {
    let log: ExpenseLogDoc = { months: {} };
    const t = { monthKey: "2026-10", itemId: "e3", planned: 6_000_000 };
    log = addBudgetSpend(log, { ...t, amount: 200_000 }, NOW);
    log = addBudgetSpend(log, { ...t, amount: 50_000 }, NOW);
    expect(log.months["2026-10"].e3.spent).toBe(250_000);
    log = addBudgetSpend(log, { ...t, amount: -1_000_000 }, NOW);
    expect(log.months["2026-10"]).toBeUndefined();
  });

  it("restores a previous entry for undo", () => {
    const before = fixtureExpenseLog.months["2026-10"].e1;
    const paidTwice = recordBillPayment(fixtureExpenseLog, { monthKey: "2026-10", itemId: "e1", planned: 1, amount: 5, date: "2026-10-13" }, NOW);
    expect(setMonthEntry(paidTwice, "2026-10", "e1", before, NOW).months["2026-10"].e1).toEqual(before);
  });

  it("keeps 36 months and stays far below the table size cap", () => {
    const months: ExpenseLogDoc["months"] = {};
    for (let i = 0; i < 58; i++) {
      const d = new Date(2022, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = Object.fromEntries(
        Array.from({ length: 80 }, (_, j) => [`exp-${j.toString(36)}-abcdefgh`, { payments: [{ amount: 12_345_678, date: `${key}-15` }], planned: 12_000_000 }]),
      );
    }
    const pruned = pruneExpenseLog({ months }, NOW);
    expect(Object.keys(pruned.months)).toHaveLength(36);
    expect(Object.keys(pruned.months)[0]).toBe("2023-11");
    expect(JSON.stringify(pruned).length).toBeLessThan(800_000);
  });
});

describe("expense items", () => {
  it("creates from a template and upserts", () => {
    const tpl = EXPENSE_TEMPLATES.find((t) => t.id === "tuition")!;
    const item = createItemFromTemplate(tpl, { name: "Học phí", amount: 30_000_000 }, "2026-10-13");
    expect(item).toMatchObject({ category: "education", frequency: "semiannual", dueMonth: 9, dueDay: 5, amount: 30_000_000, createdAt: "2026-10-13" });
    const doc = upsertExpenseItem({ items: [] }, item);
    expect(upsertExpenseItem(doc, { ...item, amount: 1 }).items).toEqual([{ ...item, amount: 1 }]);
  });

  it("archives items with history and deletes the rest", () => {
    const withHistory = removeExpenseItem(fixtureExpenses, fixtureExpenseLog, "e1", "2026-10-13");
    expect(withHistory.items.find((i) => i.id === "e1")?.archivedAt).toBe("2026-10-13");
    const without = removeExpenseItem(fixtureExpenses, fixtureExpenseLog, "e4", "2026-10-13");
    expect(without.items.some((i) => i.id === "e4")).toBe(false);
  });

  it("retires and restores the old estimate", () => {
    const retired = retireLegacyEstimate(fixtureExpenses, 25_000_000, "2026-10-13");
    expect(retired.legacyEstimate).toEqual({ retiredAt: "2026-10-13", amount: 25_000_000 });
    expect(unretireLegacyEstimate(retired).legacyEstimate).toBeUndefined();
  });

  it("suggests unlinked debt payments and flags links to deleted debts", () => {
    const debts = [{ ...fixtureDebts[0], monthlyPayment: 7_000_000 }, { ...fixtureDebts[1], monthlyPayment: 2_000_000 }];
    expect(suggestDebtBills(fixtureExpenses.items, debts).map((d) => d.id)).toEqual(["d2"]);
    expect(orphanedLinks(fixtureExpenses.items, [debts[1]]).map((i) => i.id)).toEqual(["e5"]);
  });
});

describe("expense breakdown and history", () => {
  it("totals by category and splits needs and wants", () => {
    const doc: ExpensesDoc = {
      items: [...fixtureExpenses.items, { id: "w", name: "Netflix", category: "subscriptions", kind: "bill", amount: 300_000, frequency: "monthly", createdAt: "2026-01-01" }],
    };
    const cats = spendingByCategory(doc.items, fixtureDebts);
    expect(cats[0]).toMatchObject({ category: "housing", monthly: 8_000_000, count: 1 });
    expect(cats.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 9);
    const split = needsWantsSavings({ items: doc.items, debts: fixtureDebts, income: 50_000_000, unclassified: 1_000_000 });
    expect(split).toMatchObject({ needs: 23_200_000, wants: 300_000, unclassified: 1_000_000, savings: 25_500_000 });
    expect(split.savingsShare).toBeCloseTo(0.51, 9);
    expect(needsWantsSavings({ items: [], debts: [], income: 0 }).needsShare).toBeNull();
  });

  it("compares plan and actual only for tracked months", () => {
    const r = planVsActual({ expenses: fixtureExpenses, log: fixtureExpenseLog, debts: fixtureDebts, monthKeys: ["2026-08", "2026-09", "2026-10"], today: NOW });
    expect(r.months.map((m) => m.monthKey)).toEqual(["2026-08", "2026-09", "2026-10"]);
    // August has no records except autopay rent (1 of 4 lines): not tracked.
    expect(r.months[0].coverage).toBe(0.25);
    // September: everything recorded (rent autopaid) → planned 22,2tr, actual 1,45 + 8 + 6,5 + 7 = 22,95tr.
    expect(r.months[1]).toMatchObject({ planned: 22_200_000, actual: 22_950_000, coverage: 1 });
    expect(r.averagePlanned).toBe(22_200_000);
    expect(r.drift).toBe(750_000);
    // Electricity needs two tracked months before it's called out.
    expect(r.itemDrift).toEqual([]);
  });
});

describe("expense sanitizing", () => {
  it("drops broken rows and fills defaults", () => {
    const doc = sanitizeExpensesDoc(
      {
        items: [
          { id: "a", name: "  Điện ", category: "utilities", kind: "bill", amount: 1.6, frequency: "monthly", dueDay: 40, dueWeekday: 3, createdAt: "2026-01-02" },
          { id: "a", name: "dup" },
          { name: "no id" },
          { id: "b", category: "nope", kind: "nope", amount: -5, frequency: "weekly", dueWeekday: 3, dueDay: 5 },
        ],
        legacyEstimate: { retiredAt: "2026-10-01", amount: 5 },
      },
      "2026-10-13",
    );
    expect(doc.items).toEqual([
      { id: "a", name: "Điện", category: "utilities", kind: "bill", amount: 2, frequency: "monthly", createdAt: "2026-01-02" },
      { id: "b", name: "Other", category: "other", kind: "bill", amount: 0, frequency: "weekly", dueWeekday: 3, createdAt: "2026-10-13" },
    ]);
    expect(doc.legacyEstimate).toEqual({ retiredAt: "2026-10-01", amount: 5 });
    expect(sanitizeExpensesDoc(null, "2026-10-13")).toEqual({ items: [] });
  });

  it("reads the log tolerantly", () => {
    expect(
      sanitizeExpenseLog({
        months: {
          "2026-10": { a: { payments: [{ amount: 5, date: "2026-10-01" }, { amount: 1 }] }, b: { spent: 0 }, c: "x" },
          bad: { a: { spent: 1 } },
        },
      }),
    ).toEqual({ months: { "2026-10": { a: { payments: [{ amount: 5, date: "2026-10-01" }] } } } });
    expect(sanitizeExpenseLog(undefined)).toEqual({ months: {} });
  });
});
