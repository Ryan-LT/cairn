import { describe, expect, it } from "vitest";

import { createDebtDraft, isValidDayOfMonth, sanitizeDebt, weightedAverageRate } from "@/entities/debt";
import { createIncomeSourceDraft, incomeCapitalPeers, sanitizeIncomeSource } from "@/entities/income";
import {
  createPersonalLoanDraft,
  sanitizePersonalLoan,
  sortPersonalLoans,
  toggleLoanStatus,
  totalOpenAmount,
} from "@/entities/personal-loan";
import {
  ALLOCATIONS_BAND_FILTERS,
  applyAverageMonthlySpending,
  isAllocationsBandFilter,
  registerExtraAssetCategory,
  resolveAllocationsBandFilter,
} from "@/entities/preferences";
import {
  categorySelectOptions,
  createSettingsAssetDraft,
  customCategoryToRegister,
  nextSortState,
  reorderVisible,
  sanitizeSettingsAsset,
  sortSettingsAssets,
} from "@/entities/settings-asset";
import { fixtureCatalog, fixtureDebts, fixtureIncome, fixtureLoans, fixturePrefs } from "@/test/fixtures/tables";

describe("settings assets", () => {
  it("creates and sanitizes drafts", () => {
    expect(createSettingsAssetDraft(123)).toEqual({ id: "asset-123", name: "", category: "Cash", currentValue: 0, liquidity: "instant" });
    expect(sanitizeSettingsAsset({ id: "a", name: "  Gold ", category: "  ", currentValue: -1 })).toEqual({
      id: "a",
      name: "Gold",
      category: "Cash",
      currentValue: 0,
      liquidity: "instant",
    });
    expect(customCategoryToRegister(" Cash ")).toBeNull();
    expect(customCategoryToRegister(" Art ")).toBe("Art");
    expect(customCategoryToRegister("  ")).toBeNull();
  });

  it("sorts with asc → desc → off and id tie-break", () => {
    expect(nextSortState(null, "name")).toEqual({ key: "name", dir: "asc" });
    expect(nextSortState({ key: "name", dir: "asc" }, "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSortState({ key: "name", dir: "desc" }, "name")).toBeNull();
    expect(nextSortState({ key: "name", dir: "desc" }, "value")).toEqual({ key: "value", dir: "asc" });
    expect(sortSettingsAssets(fixtureCatalog, "value", "desc").map((a) => a.id)).toEqual(["a3", "a1", "a2", "a4"]);
    expect(sortSettingsAssets(fixtureCatalog, "liquidity", "desc").map((a) => a.id)).toEqual(["a2", "a1", "a3", "a4"]);
    expect(sortSettingsAssets(fixtureCatalog, "category", "asc").map((a) => a.category)).toEqual([
      "Cash",
      "Other",
      "Precious Metals",
      "Stocks & ETFs",
    ]);
  });

  it("reorders the visible list and builds category options", () => {
    expect(reorderVisible(fixtureCatalog, "a4", "a1")!.map((a) => a.id)).toEqual(["a4", "a1", "a2", "a3"]);
    expect(reorderVisible(fixtureCatalog, "a1", "a1")).toBeNull();
    expect(reorderVisible(fixtureCatalog, "x", "a1")).toBeNull();
    expect(categorySelectOptions(["Cash", "bonds"], "Zebra")).toEqual(["bonds", "Cash", "Zebra"]);
    expect(categorySelectOptions(["Cash"], " Cash ")).toEqual(["Cash"]);
  });
});

describe("preferences mutations", () => {
  it("sets spending and clears legacy outflow", () => {
    expect(applyAverageMonthlySpending({ ...fixturePrefs, monthOutflow: 99 }, 12)).toMatchObject({ averageMonthlySpending: 12, monthOutflow: 0 });
    expect(applyAverageMonthlySpending(fixturePrefs, -5).averageMonthlySpending).toBe(0);
    expect(applyAverageMonthlySpending(fixturePrefs, Number.NaN).averageMonthlySpending).toBe(0);
  });

  it("registers extra categories once", () => {
    const p1 = registerExtraAssetCategory(fixturePrefs, " Art ");
    expect(p1.extraAssetCategories).toEqual(["Art"]);
    expect(registerExtraAssetCategory(p1, "Art").extraAssetCategories).toEqual(["Art"]);
  });

  it("resolves the band filter", () => {
    expect(ALLOCATIONS_BAND_FILTERS.map((o) => o.value)).toEqual(["both", "instant", "not_instant"]);
    expect(isAllocationsBandFilter("instant")).toBe(true);
    expect(isAllocationsBandFilter("x")).toBe(false);
    expect(resolveAllocationsBandFilter({})).toBe("both");
    expect(resolveAllocationsBandFilter({ allocationsBandFilter: "not_instant" })).toBe("not_instant");
  });
});

describe("income sources", () => {
  it("creates and sanitizes drafts", () => {
    expect(createIncomeSourceDraft(7)).toEqual({ id: "income-7", kind: "active", name: "", details: "", icon: "work", monthly: 0, capitalLines: [] });
    const clean = sanitizeIncomeSource({
      ...createIncomeSourceDraft(7),
      name: " Rent ",
      details: " flat ",
      monthly: -3,
      paymentEntity: "  ",
      paymentDay: 32,
      capitalLines: [
        { id: "x", sourceKey: "catalog:a1", amount: 0 },
        { id: "y", sourceKey: "custom", amount: Number.NaN },
      ],
    });
    expect(clean).toMatchObject({ name: "Rent", details: "flat", monthly: 0 });
    expect(JSON.parse(JSON.stringify(clean))).toEqual({ id: "income-7", kind: "active", name: "Rent", details: "flat", icon: "work", monthly: 0 });
    expect(sanitizeIncomeSource({ ...fixtureIncome[0], paymentEntity: " Acme ", paymentDay: 31 })).toMatchObject({
      paymentEntity: "Acme",
      paymentDay: 31,
    });
    expect(sanitizeIncomeSource(fixtureIncome[1]).capitalLines).toEqual(fixtureIncome[1].capitalLines);
  });

  it("wraps peers for capital caps", () => {
    expect(incomeCapitalPeers(fixtureIncome, "inc1").map((p) => p.id)).toEqual(["income:inc2"]);
  });
});

describe("debts", () => {
  it("creates, validates and sanitizes", () => {
    expect(createDebtDraft(5)).toEqual({ id: "debt-5", name: "", balance: 0, ratePct: 0, rateKind: "Fixed", nextPayment: "" });
    expect(isValidDayOfMonth(0)).toBe(false);
    expect(isValidDayOfMonth(31)).toBe(true);
    const clean = sanitizeDebt({ id: "d", name: " ", balance: -1, ratePct: 140, rateKind: "Variable", paymentDayOfMonth: 15.7, nextPayment: " hi " });
    expect(clean).toEqual({ id: "d", name: "Debt", balance: 0, ratePct: 100, rateKind: "Variable", paymentDayOfMonth: 15, nextPayment: "hi" });
    expect(JSON.parse(JSON.stringify(sanitizeDebt({ ...clean, paymentDayOfMonth: 40 })))).not.toHaveProperty("paymentDayOfMonth");
  });

  it("describes payments and weights rates", () => {
    expect(weightedAverageRate(fixtureDebts)).toBeCloseTo((250 * 9.5 + 20 * 24) / 270, 6);
    expect(weightedAverageRate([])).toBe(0);
  });
});

describe("personal loans", () => {
  it("creates drafts with direction and id format", () => {
    const d = createPersonalLoanDraft("borrowed", new Date("2026-05-01T10:00:00+07:00"));
    expect(d.id).toMatch(/^loan-\d+-[a-z0-9]{1,5}$/);
    expect(d).toMatchObject({ person: "", amount: 0, direction: "borrowed", status: "open", note: "" });
    expect(d.date).toBe("2026-05-01");
    // 06:30 local is still the previous day in UTC; the draft uses the local day.
    expect(createPersonalLoanDraft("lent_out", new Date("2026-05-02T06:30:00+07:00")).date).toBe("2026-05-02");
  });

  it("sorts, totals and toggles", () => {
    expect(sortPersonalLoans(fixtureLoans).map((l) => l.id)).toEqual(["loan-2-b", "loan-1-a", "loan-3-c"]);
    expect(totalOpenAmount(fixtureLoans, "lent_out")).toBe(5_000_000);
    expect(totalOpenAmount(fixtureLoans, "borrowed")).toBe(2_000_000);
    expect(totalOpenAmount(fixtureLoans)).toBe(7_000_000);
    expect(toggleLoanStatus(fixtureLoans[2]).status).toBe("open");
    expect(toggleLoanStatus(fixtureLoans[0]).status).toBe("settled");
  });

  it("sanitizes", () => {
    expect(
      JSON.parse(JSON.stringify(sanitizePersonalLoan({ id: "l", person: " ", amount: -2, direction: "lent_out", date: " ", status: "open", note: "  " }))),
    ).toEqual({ id: "l", person: "Someone", amount: 0, direction: "lent_out", status: "open" });
  });
});
