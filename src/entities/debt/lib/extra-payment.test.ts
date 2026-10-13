import { describe, expect, it } from "vitest";

import type { Debt } from "@/entities/debt/model";

import { avalancheTarget, extraPaymentImpact, suggestedExtraPayment } from "./extra-payment";

const NOW = new Date(2026, 9, 13);
const car: Debt = { id: "d1", name: "Car", balance: 380_000_000, ratePct: 9.5, rateKind: "Fixed", nextPayment: "", monthlyPayment: 8_500_000 };

describe("extra debt payments", () => {
  it("pays off sooner with less interest", () => {
    const impact = extraPaymentImpact(car, 2_000_000, NOW)!;
    expect(impact.monthsSaved).toBeGreaterThan(8);
    expect(impact.monthsSaved).toBeLessThan(14);
    expect(impact.interestSaved).toBeGreaterThan(10_000_000);
  });

  it("has nothing to compare without a payoff date", () => {
    expect(extraPaymentImpact({ ...car, monthlyPayment: undefined }, 1, NOW)).toBeNull();
    expect(extraPaymentImpact({ ...car, monthlyPayment: 1_000_000 }, 1_000_000, NOW)).toBeNull(); // interest alone is ~3tr
    expect(extraPaymentImpact(car, 0, NOW)).toBeNull();
  });

  it("targets the highest rate first and suggests round amounts", () => {
    const card: Debt = { ...car, id: "d2", balance: 18_000_000, ratePct: 28, monthlyPayment: 6_000_000 };
    expect(avalancheTarget([car, card, { ...car, id: "z", balance: 0, ratePct: 40 }])?.id).toBe("d2");
    expect(suggestedExtraPayment(car)).toBe(1_000_000);
    expect(suggestedExtraPayment({ ...car, monthlyPayment: 17_000_000 })).toBe(2_000_000);
    expect(suggestedExtraPayment({ ...car, monthlyPayment: undefined })).toBe(500_000);
  });
});
