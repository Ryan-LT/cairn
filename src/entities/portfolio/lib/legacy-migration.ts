import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import type { GoalSeedLine, GoalsState } from "@/entities/goal";
import type { IncomeSource } from "@/entities/income";
import type { SettingsAsset } from "@/entities/settings-asset";
import { activeMessages } from "@/shared/i18n/active";

export type LegacyMigration = {
  catalog: SettingsAsset[];
  goals: GoalsState;
  incomeSources: IncomeSource[];
  assets: AssetsState;
  /** Old source key (`re:…`, `cash:…`, `inv:…`) → new `catalog:…` key. */
  keyMap: Record<string, string>;
};

/** Number of holdings still in the old read-only document. */
export function legacyHoldingsCount(assets: AssetsState): number {
  return assets.realEstate.length + assets.cashAccounts.length + assets.investments.length;
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

/**
 * Move the old "imported holdings" (read-only) into the editable asset list.
 * Goal starting balances and income capital that pointed at them are re-pointed,
 * so net worth and every plan's funding stay exactly the same.
 */
export function migrateLegacyHoldings(input: {
  assets: AssetsState;
  catalog: SettingsAsset[];
  goals: GoalsState;
  incomeSources: IncomeSource[];
}): LegacyMigration {
  const taken = new Set(input.catalog.map((a) => a.id));
  const keyMap: Record<string, string> = {};
  const added: SettingsAsset[] = [];
  const fallback = activeMessages().domain.startingOptions.cashFallback;

  for (const p of input.assets.realEstate) {
    const id = uniqueId(`asset-re-${p.id}`, taken);
    keyMap[`re:${p.id}`] = `catalog:${id}`;
    added.push({ id, name: p.name.trim() || p.address.trim() || fallback, category: "Real Estate", currentValue: Math.max(0, p.estValue), liquidity: "not_instant" });
  }
  for (const c of input.assets.cashAccounts) {
    const id = uniqueId(`asset-cash-${c.id}`, taken);
    keyMap[`cash:${c.id}`] = `catalog:${id}`;
    added.push({ id, name: c.details?.trim() || c.category?.trim() || fallback, category: "Cash", currentValue: Math.max(0, c.balance), liquidity: "instant" });
  }
  for (const i of input.assets.investments) {
    const id = uniqueId(`asset-inv-${i.id}`, taken);
    keyMap[`inv:${i.id}`] = `catalog:${id}`;
    added.push({ id, name: i.name.trim() || fallback, category: "Stocks & ETFs", currentValue: Math.max(0, i.value), liquidity: "not_instant" });
  }

  const remapLines = (lines: GoalSeedLine[] | undefined) =>
    lines?.map((l) => (keyMap[l.sourceKey] ? { ...l, sourceKey: keyMap[l.sourceKey] } : l));

  return {
    catalog: [...input.catalog, ...added],
    goals: {
      ...input.goals,
      profiles: input.goals.profiles.map((p) => ({
        ...p,
        seedLines: remapLines(p.seedLines),
        seedSourceKey: p.seedSourceKey && keyMap[p.seedSourceKey] ? keyMap[p.seedSourceKey] : p.seedSourceKey,
      })),
    },
    incomeSources: input.incomeSources.map((s) => (s.capitalLines ? { ...s, capitalLines: remapLines(s.capitalLines) } : s)),
    assets: ASSETS_SEED,
    keyMap,
  };
}
