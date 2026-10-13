import { describe, expect, it } from "vitest";

import type { Debt } from "@/entities/debt";

import type { ExpenseItem } from "../model";
import { monthlyEquivalent, occurrenceAmount, plannedForMonth } from "./amounts";
import { dueDatesInMonth, isActiveInMonth, isDueInMonth, nextDueDate, occurrencesInMonth } from "./schedule";

function item(over: Partial<ExpenseItem> = {}): ExpenseItem {
  return { id: "x", name: "X", category: "other", kind: "bill", amount: 1_000_000, frequency: "monthly", createdAt: "2026-01-01", ...over };
}

const debt: Debt = { id: "d1", name: "Loan", balance: 100_000_000, ratePct: 12, rateKind: "Fixed", nextPayment: "", paymentDayOfMonth: 20, monthlyPayment: 3_000_000 };

describe("expense schedule", () => {
  it("clamps due days to the month length", () => {
    const rent = item({ dueDay: 31 });
    expect(dueDatesInMonth(rent, "2026-02")).toEqual(["2026-02-28"]);
    expect(dueDatesInMonth(rent, "2028-02")).toEqual(["2028-02-29"]);
    expect(dueDatesInMonth(rent, "2026-04")).toEqual(["2026-04-30"]);
    expect(dueDatesInMonth(rent, "2026-10")).toEqual(["2026-10-31"]);
  });

  it("anchors quarterly, half-yearly and yearly items to their month", () => {
    const quarterly = item({ frequency: "quarterly", dueMonth: 2, dueDay: 10 });
    expect(["2026-01", "2026-02", "2026-05", "2026-08", "2026-11", "2026-12"].map((m) => isDueInMonth(quarterly, m))).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
    const semi = item({ frequency: "semiannual", dueMonth: 9 });
    expect(isDueInMonth(semi, "2026-03")).toBe(true);
    expect(isDueInMonth(semi, "2026-09")).toBe(true);
    expect(isDueInMonth(semi, "2026-06")).toBe(false);
    // Without a due month the cycle starts in the month it was added.
    const yearly = item({ frequency: "yearly", createdAt: "2026-04-20" });
    expect(isDueInMonth(yearly, "2027-04")).toBe(true);
    expect(isDueInMonth(yearly, "2026-05")).toBe(false);
  });

  it("lists every weekday of a weekly item", () => {
    const weekly = item({ frequency: "weekly", dueWeekday: 6 }); // Saturdays
    expect(dueDatesInMonth(weekly, "2026-10")).toEqual(["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"]);
    expect(occurrencesInMonth(weekly, "2026-10")).toBe(5);
    expect(plannedForMonth({ ...weekly, amount: 100_000 }, "2026-10")).toBe(500_000);
  });

  it("has no due date without a due day, but still occurs", () => {
    const groceries = item({ kind: "budget" });
    expect(dueDatesInMonth(groceries, "2026-10")).toEqual([]);
    expect(occurrencesInMonth(groceries, "2026-10")).toBe(1);
  });

  it("uses the linked debt's payment day and amount", () => {
    const loan = item({ debtId: "d1", amount: 1 });
    expect(dueDatesInMonth(loan, "2026-10", debt)).toEqual(["2026-10-20"]);
    expect(occurrenceAmount(loan, debt)).toBe(3_000_000);
    expect(occurrenceAmount(loan, { ...debt, monthlyPayment: undefined })).toBe(1);
    expect(occurrenceAmount(loan, { ...debt, balance: 0 })).toBe(0);
    expect(occurrenceAmount(loan)).toBe(1);
  });

  it("averages to a monthly equivalent", () => {
    expect(monthlyEquivalent(item({ frequency: "yearly", amount: 12_000_000 }))).toBe(1_000_000);
    expect(monthlyEquivalent(item({ frequency: "quarterly", amount: 3_000_000 }))).toBe(1_000_000);
    expect(monthlyEquivalent(item({ frequency: "semiannual", amount: 6_000_000 }))).toBe(1_000_000);
    expect(monthlyEquivalent(item({ frequency: "weekly", amount: 120_000 }))).toBeCloseTo(520_000, 6);
    expect(monthlyEquivalent(item({ paused: true }))).toBe(0);
    expect(monthlyEquivalent(item({ archivedAt: "2026-05-01" }))).toBe(0);
  });

  it("is active from the month it was added until the month it was removed, unless paused", () => {
    const x = item({ createdAt: "2026-03-15", archivedAt: "2026-07-02" });
    expect(isActiveInMonth(x, "2026-02")).toBe(false);
    expect(isActiveInMonth(x, "2026-03")).toBe(true);
    expect(isActiveInMonth(x, "2026-06")).toBe(true);
    expect(isActiveInMonth(x, "2026-07")).toBe(false);
    expect(isActiveInMonth(item({ paused: true }), "2026-09")).toBe(false);
  });

  it("finds the next due date", () => {
    const today = new Date(2026, 9, 13, 9);
    expect(nextDueDate(item({ dueDay: 15 }), today)).toBe("2026-10-15");
    expect(nextDueDate(item({ dueDay: 13 }), today)).toBe("2026-10-13");
    expect(nextDueDate(item({ dueDay: 5 }), today)).toBe("2026-11-05");
    expect(nextDueDate(item({ frequency: "yearly", dueMonth: 3, dueDay: 10 }), today)).toBe("2027-03-10");
    expect(nextDueDate(item(), today)).toBeNull();
  });
});
