/**
 * Gold the way it is bought and sold in Vietnam: by product (SJC bars, plain
 * 999.9 rings, jewellery by purity) and by weight in chỉ / lượng (cây) / phân
 * or grams. Shops quote a price per chỉ for each product; a holding is worth
 * its weight in chỉ times that price.
 */

export const GOLD_PRODUCTS = [
  "sjc_bar",
  "ring_9999",
  "k24",
  "k999",
  "k99",
  "k22",
  "k18",
  "k16",
  "k15",
  "k14_6",
  "k14",
  "k10",
  "k9",
  "k8",
] as const;
export type GoldProductId = (typeof GOLD_PRODUCTS)[number];

/** Share of pure gold; used when a shop's price list lacks a product (derived from the 999.9 price). */
export const GOLD_PURITY: Record<GoldProductId, number> = {
  sjc_bar: 0.9999,
  ring_9999: 0.9999,
  k24: 0.9999,
  k999: 0.999,
  k99: 0.99,
  k22: 0.916,
  k18: 0.75,
  k16: 0.68,
  k15: 0.65,
  k14_6: 0.61,
  k14: 0.585,
  k10: 0.416,
  k9: 0.375,
  k8: 0.333,
};

/** Bars and rings trade near the pure-gold price; jewellery is valued by purity. */
export const GOLD_JEWELRY: readonly GoldProductId[] = GOLD_PRODUCTS.filter((p) => p !== "sjc_bar" && p !== "ring_9999");

export const WEIGHT_UNITS = ["chi", "luong", "phan", "gram"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/** Grams per unit: 1 lượng (cây) = 10 chỉ = 100 phân = 37,5 g. */
const GRAMS: Record<WeightUnit, number> = { luong: 37.5, chi: 3.75, phan: 0.375, gram: 1 };
export const GRAMS_PER_CHI = GRAMS.chi;
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

export function toChi(weight: number, unit: WeightUnit): number {
  if (!Number.isFinite(weight) || weight <= 0) return 0;
  return (weight * GRAMS[unit]) / GRAMS_PER_CHI;
}

export function isGoldProduct(v: unknown): v is GoldProductId {
  return typeof v === "string" && (GOLD_PRODUCTS as readonly string[]).includes(v);
}

export function isWeightUnit(v: unknown): v is WeightUnit {
  return typeof v === "string" && (WEIGHT_UNITS as readonly string[]).includes(v);
}

/** Shop price for one chỉ: what the shop pays you (`buy`) and what it charges (`sell`). */
export type GoldQuote = { buy: number; sell: number };
export type GoldPrices = Partial<Record<GoldProductId, GoldQuote>>;

/**
 * Fill products a price list lacks from its 999.9 price scaled by purity
 * (bars from rings and back). Approximate: jewellery usually trades a little
 * below its pure-gold share.
 */
export function completeGoldPrices(prices: GoldPrices): GoldPrices {
  const base = prices.ring_9999 ?? prices.k24 ?? prices.sjc_bar;
  if (!base) return prices;
  const out: GoldPrices = { ...prices };
  for (const p of GOLD_PRODUCTS) {
    if (out[p]) continue;
    const r = GOLD_PURITY[p] / 0.9999;
    out[p] = { buy: Math.round(base.buy * r), sell: Math.round(base.sell * r) };
  }
  return out;
}

/** Price per chỉ of pure gold from the world price (USD per troy ounce). */
export function worldPricePerChi(usdPerOunce: number, vndPerUsd: number): number {
  return (usdPerOunce * vndPerUsd * GRAMS_PER_CHI) / GRAMS_PER_TROY_OUNCE;
}
