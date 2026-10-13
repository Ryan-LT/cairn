import { describe, expect, it } from "vitest";

import { fixtureAssets, fixtureCatalog, fixtureDebts, fixtureGoals, fixtureIncome } from "@/test/fixtures/tables";

import { buildAllocationReportForTables } from "./allocation-report";
import { legacyHoldingsCount, migrateLegacyHoldings } from "./legacy-migration";
import { computeNetWorth } from "./net-worth";

describe("migrateLegacyHoldings", () => {
  const goals = {
    ...fixtureGoals,
    profiles: [
      ...fixtureGoals.profiles,
      { id: "g-re", name: "Uses property", targetAmount: 1, targetDate: "", monthlyContribution: 0, seedLines: [{ id: "x", sourceKey: "re:re1", amount: 1_000_000_000 }] },
    ],
  };
  const income = [...fixtureIncome, { id: "inc3", kind: "passive" as const, name: "Interest", details: "", icon: "savings", monthly: 1, capitalLines: [{ id: "c", sourceKey: "cash:c1", amount: 50_000_000 }] }];
  const out = migrateLegacyHoldings({ assets: fixtureAssets, catalog: fixtureCatalog, goals, incomeSources: income });

  it("moves every holding into the catalog and empties the old document", () => {
    expect(legacyHoldingsCount(fixtureAssets)).toBe(4);
    expect(legacyHoldingsCount(out.assets)).toBe(0);
    expect(out.catalog).toHaveLength(fixtureCatalog.length + 4);
    expect(out.catalog.find((a) => a.id === "asset-re-re1")).toMatchObject({ name: "Apartment", category: "Real Estate", currentValue: 3_000_000_000, liquidity: "not_instant" });
    // A cash account without details is named after its category.
    expect(out.catalog.find((a) => a.id === "asset-cash-c2")).toMatchObject({ name: "Checking", liquidity: "instant" });
    expect(out.keyMap["inv:i1"]).toBe("catalog:asset-inv-i1");
  });

  it("keeps net worth and every plan's funding unchanged", () => {
    expect(computeNetWorth({ assets: out.assets, settingsAssets: out.catalog, debts: fixtureDebts })).toBe(
      computeNetWorth({ assets: fixtureAssets, settingsAssets: fixtureCatalog, debts: fixtureDebts }),
    );
    const before = buildAllocationReportForTables({ goals, assets: fixtureAssets, settingsAssets: fixtureCatalog, incomeSources: income });
    const after = buildAllocationReportForTables({ goals: out.goals, assets: out.assets, settingsAssets: out.catalog, incomeSources: out.incomeSources });
    expect(after.plans.map((p) => [p.id, p.effectiveStartingTotal])).toEqual(before.plans.map((p) => [p.id, p.effectiveStartingTotal]));
    expect(out.goals.profiles.find((p) => p.id === "g-re")!.seedLines![0].sourceKey).toBe("catalog:asset-re-re1");
    expect(out.incomeSources.find((s) => s.id === "inc3")!.capitalLines![0].sourceKey).toBe("catalog:asset-cash-c1");
  });
});
