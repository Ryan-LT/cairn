import { describe, expect, it } from "vitest";

import { fixtureDebts, fixtureExpenseLog, fixtureExpenses } from "@/test/fixtures/tables";

import type { ExpenseItem, ExpensesDoc } from "../model";
import { buildMonthView, suggestedPayment } from "./month";

const TODAY = new Date(2026, 9, 13, 10); // 13 Oct 2026

function view(monthKey = "2026-10", expenses: ExpensesDoc = fixtureExpenses, log = fixtureExpenseLog, today = TODAY) {
  return buildMonthView({ expenses, log, debts: fixtureDebts, monthKey, today });
}

function line(v: ReturnType<typeof view>, id: string) {
  return v.lines.find((l) => l.item.id === id);
}

describe("buildMonthView", () => {
  it("sorts bills into paid, autopaid, due soon and budgets", () => {
    const v = view();
    expect(v.isCurrent).toBe(true);
    // Electricity paid 1,3tr on the 12th.
    expect(line(v, "e1")).toMatchObject({ status: "paid", paid: 1_300_000, settled: 1_300_000, remaining: 0 });
    // Rent is on direct debit and was due on the 5th.
    expect(line(v, "e2")).toMatchObject({ status: "autopaid", settled: 8_000_000, remaining: 0 });
    // Car loan follows debt d1's payment day (15th): due in 2 days.
    expect(line(v, "e5")).toMatchObject({ status: "due_soon", nextDue: "2026-10-15", daysUntilDue: 2, planned: 7_000_000 });
    // Yearly insurance is due in March only; paused and removed items are left out.
    expect(line(v, "e4")).toBeUndefined();
    expect(line(v, "e6")).toBeUndefined();
    expect(line(v, "e7")).toBeUndefined();
    expect(v.groups.dueSoon.map((b) => b.item.id)).toEqual(["e5"]);
    expect(v.groups.settled.map((b) => b.item.id)).toEqual(["e2", "e1"]);
    expect(v.groups.budgets.map((b) => b.item.id)).toEqual(["e3"]);
  });

  it("totals planned, settled and remaining", () => {
    const v = view();
    expect(v.totals).toMatchObject({
      planned: 1_200_000 + 8_000_000 + 7_000_000 + 6_000_000,
      settled: 1_300_000 + 8_000_000 + 2_000_000,
      remaining: 7_000_000 + 4_000_000,
      billsCount: 3,
      billsDone: 2,
      budgetsSpent: 2_000_000,
      overBudget: 0,
    });
    expect(v.totals.projected).toBe(v.totals.settled + v.totals.remaining);
  });

  it("paces budgets through the month", () => {
    const groceries = line(view(), "e3");
    // 13 of 31 days: about 2,5tr expected by now, 2tr spent.
    expect(groceries).toMatchObject({ kind: "budget", status: "on_track", spent: 2_000_000, remaining: 4_000_000 });
    const over = line(view("2026-09"), "e3");
    expect(over).toMatchObject({ status: "over", spent: 6_500_000, remaining: -500_000 });
    expect(view("2026-09").totals.overBudget).toBe(500_000);
  });

  it("marks unpaid bills of past months overdue, and keeps their planned snapshot", () => {
    const sept = view("2026-09");
    expect(line(sept, "e1")).toMatchObject({ status: "paid", planned: 1_200_000, paid: 1_450_000 });
    // Rent autopays; the archived gym bill was removed before September.
    expect(line(sept, "e2")).toMatchObject({ status: "autopaid" });
    expect(line(sept, "e7")).toBeUndefined();
    const aug = view("2026-08");
    expect(line(aug, "e1")).toMatchObject({ status: "overdue" });
    expect(line(aug, "e5")).toMatchObject({ status: "overdue" });
  });

  it("shows only planned amounts for future months", () => {
    const nov = view("2026-11");
    expect(nov.isFuture).toBe(true);
    expect(line(nov, "e2")).toMatchObject({ status: "upcoming", settled: 0 });
    expect(line(nov, "e3")).toMatchObject({ status: "unused" });
  });

  it("asks rather than calling a bill overdue when it was due before it was added", () => {
    const newBill: ExpenseItem = { id: "n1", name: "Water", category: "utilities", kind: "bill", amount: 200_000, frequency: "monthly", dueDay: 5, createdAt: "2026-10-12" };
    const v = view("2026-10", { items: [newBill] }, { months: {} });
    expect(line(v, "n1")).toMatchObject({ status: "unconfirmed" });
    expect(v.groups.needsConfirm).toHaveLength(1);
    expect(v.groups.overdue).toHaveLength(0);
  });

  it("handles skipped bills, due today and weekly occurrences", () => {
    const bills: ExpenseItem[] = [
      { id: "a", name: "A", category: "other", kind: "bill", amount: 100, frequency: "monthly", dueDay: 13, createdAt: "2026-01-01" },
      { id: "b", name: "B", category: "other", kind: "bill", amount: 100, frequency: "monthly", dueDay: 1, createdAt: "2026-01-01" },
      { id: "w", name: "W", category: "other", kind: "bill", amount: 50, frequency: "weekly", dueWeekday: 6, createdAt: "2026-01-01" },
    ];
    const log = {
      months: {
        "2026-10": {
          b: { skipped: true },
          w: { payments: [{ amount: 50, date: "2026-10-03" }] },
        },
      },
    };
    const v = view("2026-10", { items: bills }, log);
    expect(line(v, "a")).toMatchObject({ status: "due_today", daysUntilDue: 0 });
    expect(line(v, "b")).toMatchObject({ status: "skipped", settled: 0, remaining: 0 });
    // Weekly on Saturdays: 5 in October, one paid; the 10th is overdue.
    const w = line(v, "w");
    expect(w).toMatchObject({ occurrences: 5, paidCount: 1, status: "overdue", nextDue: "2026-10-10", remaining: 200 });
    expect(w && w.kind === "bill" && suggestedPayment(w)).toBe(50);
    expect(v.totals.planned).toBe(100 + 250);
  });

  it("builds calendar days with bills and paydays", () => {
    const v = buildMonthView({
      expenses: fixtureExpenses,
      log: fixtureExpenseLog,
      debts: fixtureDebts,
      monthKey: "2026-02",
      today: TODAY,
      paydays: [{ id: "inc1", name: "Salary", day: 31 }],
    });
    expect(v.calendar).toHaveLength(28);
    expect(v.calendar[4].billIds).toEqual(["e2"]);
    expect(v.calendar[14].billIds.sort()).toEqual(["e1", "e5"]);
    expect(v.calendar[27].paydayIds).toEqual(["inc1"]);
  });
});
