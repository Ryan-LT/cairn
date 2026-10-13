import { describe, expect, it } from "vitest";

import {
  addMonths,
  dayInMonthIso,
  daysInMonth,
  daysUntilIso,
  isMonthKey,
  monthKeyOf,
  monthsBetween,
  monthsEndingAt,
  monthStart,
  parseMonthKey,
} from "./month";

describe("month helpers", () => {
  it("formats and parses keys", () => {
    expect(monthKeyOf(new Date(2026, 0, 31))).toBe("2026-01");
    expect(parseMonthKey("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(monthStart("2026-03").getDate()).toBe(1);
  });

  it("adds months across years", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2025-11", "2026-02")).toBe(3);
    expect(monthsBetween("2026-02", "2025-11")).toBe(-3);
    expect(monthsEndingAt("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("knows month lengths and clamps days", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-04")).toBe(30);
    expect(dayInMonthIso("2026-02", 31)).toBe("2026-02-28");
    expect(dayInMonthIso("2028-02", 31)).toBe("2028-02-29");
    expect(dayInMonthIso("2026-10", 5)).toBe("2026-10-05");
  });

  it("counts days until an ISO day", () => {
    const today = new Date(2026, 9, 13, 23, 30);
    expect(daysUntilIso("2026-10-13", today)).toBe(0);
    expect(daysUntilIso("2026-10-15", today)).toBe(2);
    expect(daysUntilIso("2026-10-05", today)).toBe(-8);
    expect(daysUntilIso("2026-11-01", today)).toBe(19);
  });
});
