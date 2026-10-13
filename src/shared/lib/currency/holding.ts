import { isGoldProduct, isWeightUnit, toChi, type GoldProductId, type WeightUnit } from "./gold";
import { usdToVnd, type EffectiveRates } from "./rates";

/**
 * What an asset is held in when it isn't plain VND. The asset's VND value is
 * worked out from it with today's rates (its stored VND value is the last
 * known one, used while rates are unavailable).
 */
export type AssetHolding = { kind: "usd"; amount: number } | { kind: "gold"; product: GoldProductId; weight: number; unit: WeightUnit };

/** A stored holding in canonical shape, or undefined. */
export function sanitizeHolding(raw: unknown): AssetHolding | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const h = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  if (h.kind === "usd") return { kind: "usd", amount: Math.round(num(h.amount) * 100) / 100 };
  if (h.kind === "gold" && isGoldProduct(h.product)) {
    return { kind: "gold", product: h.product, weight: Math.round(num(h.weight) * 10000) / 10000, unit: isWeightUnit(h.unit) ? h.unit : "chi" };
  }
  return undefined;
}

/** VND value of a holding at these rates, or null when the needed rate is unknown. */
export function holdingValueVnd(holding: AssetHolding, rates: EffectiveRates): number | null {
  if (holding.kind === "usd") return usdToVnd(holding.amount, rates);
  const price = rates.goldPerChi?.[holding.product];
  return price ? Math.round(toChi(holding.weight, holding.unit) * price) : null;
}
