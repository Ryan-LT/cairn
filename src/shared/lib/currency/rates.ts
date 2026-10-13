import { completeGoldPrices, type GoldPrices, type GoldProductId } from "./gold";

export const CURRENCIES = ["VND", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type UsdRateSource = "vietcombank" | "exchangerate-api" | "open-er-api" | "env" | "cache";
export type GoldSource = "pnj" | "vang-today" | "world" | "cache";

/** What `GET /api/rates` returns. Times are ISO instants. */
export type RatesSnapshot = {
  usd: {
    /** VND for 1 USD used for conversions (Vietcombank: the transfer rate). */
    rate: number;
    /** Bank cash-buy and sell rates when the source has them. */
    buy?: number;
    sell?: number;
    source: UsdRateSource;
    at: string;
  } | null;
  gold: {
    /** VND per chỉ, by product. */
    prices: GoldPrices;
    source: GoldSource;
    at: string;
    /** World price (USD / troy ounce) when known. */
    worldUsdPerOunce?: number;
  } | null;
  fetchedAt: string;
};

/** Which shop price values gold: what you'd get selling it (`buy`, default) or what it costs (`sell`). */
export type GoldBasis = "buy" | "sell";

/** The person's choices (stored in preferences). */
export type CurrencyPrefs = {
  display?: Currency;
  /** Own VND per USD instead of the live rate. */
  usdRate?: number;
  /** Own price per chỉ (VND) by product, instead of the live one. */
  goldPrices?: Partial<Record<GoldProductId, number>>;
  goldBasis?: GoldBasis;
};

/** Rates as the app uses them: live values with the person's overrides applied. */
export type EffectiveRates = {
  /** VND per USD, or null while unknown. */
  vndPerUsd: number | null;
  usdOverridden: boolean;
  /** VND per chỉ by product on the chosen basis, or null while unknown. */
  goldPerChi: Partial<Record<GoldProductId, number>> | null;
  goldOverridden: readonly GoldProductId[];
  goldBasis: GoldBasis;
};

const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export function effectiveRates(snapshot: RatesSnapshot | null, prefs: CurrencyPrefs | undefined): EffectiveRates {
  const basis: GoldBasis = prefs?.goldBasis === "sell" ? "sell" : "buy";
  const usdOverride = positive(prefs?.usdRate) ? prefs.usdRate : null;
  const vndPerUsd = usdOverride ?? (positive(snapshot?.usd?.rate) ? snapshot.usd.rate : null);

  const live = snapshot?.gold ? completeGoldPrices(snapshot.gold.prices) : {};
  const gold: Partial<Record<GoldProductId, number>> = {};
  for (const [id, q] of Object.entries(live) as [GoldProductId, { buy: number; sell: number }][]) {
    const v = basis === "sell" ? q.sell || q.buy : q.buy;
    if (positive(v)) gold[id] = v;
  }
  const overridden: GoldProductId[] = [];
  for (const [id, v] of Object.entries(prefs?.goldPrices ?? {}) as [GoldProductId, number][]) {
    if (positive(v)) {
      gold[id] = v;
      overridden.push(id);
    }
  }
  return {
    vndPerUsd,
    usdOverridden: usdOverride !== null,
    goldPerChi: Object.keys(gold).length ? gold : null,
    goldOverridden: overridden,
    goldBasis: basis,
  };
}

/** VND for a USD amount, or null while the rate is unknown. */
export function usdToVnd(usd: number, rates: Pick<EffectiveRates, "vndPerUsd">): number | null {
  return rates.vndPerUsd && Number.isFinite(usd) ? Math.round(usd * rates.vndPerUsd) : null;
}

/** USD for a VND amount (cents), or null while the rate is unknown. */
export function vndToUsd(vnd: number, rates: Pick<EffectiveRates, "vndPerUsd">): number | null {
  return rates.vndPerUsd && Number.isFinite(vnd) ? Math.round((vnd / rates.vndPerUsd) * 100) / 100 : null;
}
