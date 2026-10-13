import type { SettingsAsset } from "@/entities/settings-asset/model";
import { todayIso } from "@/shared/lib/date";

import type { LedgerTxn } from "../model";

/** The unit an account's balance is kept in, or null when it can't take postings (gold). */
export function accountUnit(asset: Pick<SettingsAsset, "holding">): "VND" | "USD" | null {
  if (!asset.holding) return "VND";
  return asset.holding.kind === "usd" ? "USD" : null;
}

/** Assets money can be taken from or paid into (not gold). */
export function isAccountAsset(asset: Pick<SettingsAsset, "holding">): boolean {
  return accountUnit(asset) !== null;
}

/**
 * Whether a transaction moves the account's balance: it must come after the
 * moment the balance was last set by hand (that value already includes
 * everything before). Older saves only know the day (`updatedAt`).
 */
export function countsForAccount(asset: Pick<SettingsAsset, "valueAsOf" | "updatedAt">, txn: Pick<LedgerTxn, "date" | "at">): boolean {
  if (asset.valueAsOf) {
    const baseDay = todayIso(new Date(asset.valueAsOf));
    return txn.date > baseDay || (txn.date === baseDay && txn.at > asset.valueAsOf);
  }
  if (asset.updatedAt) return txn.date > asset.updatedAt;
  return true;
}

/**
 * How much each account moved since its balance was last set: money out
 * subtracts, money in adds, in the account's unit (VND, or USD for an account
 * held in dollars). Only transactions dated up to `today` count.
 */
export function accountMovements(
  assets: readonly SettingsAsset[],
  txns: readonly LedgerTxn[],
  today: string,
  vndPerUsd: number | null,
): Map<string, number> {
  return new Map([...accountActivity(assets, txns, today, vndPerUsd)].map(([id, a]) => [id, a.delta]));
}

/** {@link accountMovements} with how many transactions made up each movement. */
export function accountActivity(
  assets: readonly SettingsAsset[],
  txns: readonly LedgerTxn[],
  today: string,
  vndPerUsd: number | null,
): Map<string, { delta: number; count: number }> {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const out = new Map<string, { delta: number; count: number }>();
  for (const t of txns) {
    if (!t.accountId || t.date > today) continue;
    const asset = byId.get(t.accountId);
    if (!asset) continue;
    const unit = accountUnit(asset);
    if (!unit || !countsForAccount(asset, t)) continue;
    const sign = t.kind === "expense" ? -1 : 1;
    const value = unit === "VND" ? t.amount : (t.accountUsd ?? (vndPerUsd ? t.amount / vndPerUsd : null));
    if (value === null) continue;
    const prev = out.get(asset.id) ?? { delta: 0, count: 0 };
    out.set(asset.id, { delta: prev.delta + sign * value, count: prev.count + 1 });
  }
  return out;
}

/** Dollars a VND amount moves on a USD account (fixed when recorded), if it's one. */
export function accountUsdFor(asset: Pick<SettingsAsset, "holding"> | undefined, amountVnd: number, amountUsd: number | undefined, vndPerUsd: number | null): number | undefined {
  if (!asset || accountUnit(asset) !== "USD") return undefined;
  if (amountUsd !== undefined) return amountUsd;
  return vndPerUsd ? Math.round((amountVnd / vndPerUsd) * 100) / 100 : undefined;
}
