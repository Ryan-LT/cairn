import { afterEach, describe, expect, it } from "vitest";

import { formatMoney, formatMoneyCompact } from "@/shared/lib/format";

import { setDisplayCurrency } from "./display";
import { completeGoldPrices, toChi, worldPricePerChi } from "./gold";
import { holdingValueVnd, sanitizeHolding } from "./holding";
import { effectiveRates, usdToVnd, vndToUsd, type RatesSnapshot } from "./rates";

const SNAPSHOT: RatesSnapshot = {
  usd: { rate: 25_720, source: "vietcombank", at: "2026-10-13T09:32:01.000Z" },
  gold: {
    prices: { sjc_bar: { buy: 14_130_000, sell: 14_430_000 }, ring_9999: { buy: 14_080_000, sell: 14_380_000 }, k18: { buy: 9_698_000, sell: 10_688_000 } },
    source: "pnj",
    at: "2026-10-13T06:54:19.000Z",
  },
  fetchedAt: "2026-10-13T10:00:00.000Z",
};

describe("gold", () => {
  it("converts weights to chỉ", () => {
    expect(toChi(1, "luong")).toBe(10);
    expect(toChi(3.75, "gram")).toBe(1);
    expect(toChi(5, "phan")).toBeCloseTo(0.5, 10);
    expect(toChi(2, "chi")).toBe(2);
    expect(toChi(-1, "chi")).toBe(0);
    expect(toChi(Number.NaN, "chi")).toBe(0);
  });

  it("derives missing purities from the 999.9 price", () => {
    const all = completeGoldPrices({ ring_9999: { buy: 10_000_000, sell: 11_000_000 } });
    expect(all.k18).toEqual({ buy: Math.round((10_000_000 * 0.75) / 0.9999), sell: Math.round((11_000_000 * 0.75) / 0.9999) });
    expect(all.sjc_bar).toEqual({ buy: 10_000_000, sell: 11_000_000 });
    expect(completeGoldPrices({})).toEqual({});
  });

  it("converts the world price per ounce to per chỉ", () => {
    // 1 oz = 31,1034768 g; 1 chỉ = 3,75 g.
    expect(worldPricePerChi(4000, 25_000)).toBeCloseTo((4000 * 25_000 * 3.75) / 31.1034768, 6);
  });
});

describe("effective rates", () => {
  it("uses live rates on the buy basis by default", () => {
    const r = effectiveRates(SNAPSHOT, undefined);
    expect(r.vndPerUsd).toBe(25_720);
    expect(r.goldBasis).toBe("buy");
    expect(r.goldPerChi?.sjc_bar).toBe(14_130_000);
    expect(r.goldPerChi?.k18).toBe(9_698_000);
    // Filled from the ring price.
    expect(r.goldPerChi?.k14).toBe(Math.round((14_080_000 * 0.585) / 0.9999));
  });

  it("applies the sell basis and the person's own prices", () => {
    const r = effectiveRates(SNAPSHOT, { goldBasis: "sell", usdRate: 26_000, goldPrices: { k18: 9_500_000 } });
    expect(r.vndPerUsd).toBe(26_000);
    expect(r.usdOverridden).toBe(true);
    expect(r.goldPerChi?.sjc_bar).toBe(14_430_000);
    expect(r.goldPerChi?.k18).toBe(9_500_000);
    expect(r.goldOverridden).toEqual(["k18"]);
  });

  it("is empty without data and ignores bad overrides", () => {
    const r = effectiveRates(null, { usdRate: -5, goldPrices: { k18: 0 } });
    expect(r.vndPerUsd).toBeNull();
    expect(r.goldPerChi).toBeNull();
    expect(usdToVnd(10, r)).toBeNull();
    expect(vndToUsd(10, r)).toBeNull();
  });
});

describe("holdings", () => {
  const rates = effectiveRates(SNAPSHOT, undefined);
  it("values USD and gold", () => {
    expect(holdingValueVnd({ kind: "usd", amount: 1000 }, rates)).toBe(25_720_000);
    expect(holdingValueVnd({ kind: "usd", amount: 12.34 }, rates)).toBe(Math.round(12.34 * 25_720));
    expect(holdingValueVnd({ kind: "gold", product: "sjc_bar", weight: 1, unit: "luong" }, rates)).toBe(141_300_000);
    expect(holdingValueVnd({ kind: "gold", product: "k18", weight: 2, unit: "chi" }, rates)).toBe(19_396_000);
    expect(holdingValueVnd({ kind: "gold", product: "ring_9999", weight: 7.5, unit: "gram" }, rates)).toBe(28_160_000);
    expect(holdingValueVnd({ kind: "usd", amount: 5 }, effectiveRates(null, undefined))).toBeNull();
  });

  it("sanitizes stored holdings", () => {
    expect(sanitizeHolding({ kind: "usd", amount: 10.555 })).toEqual({ kind: "usd", amount: 10.56 });
    expect(sanitizeHolding({ kind: "gold", product: "k18", weight: 2, unit: "oz" })).toEqual({ kind: "gold", product: "k18", weight: 2, unit: "chi" });
    expect(sanitizeHolding({ kind: "gold", product: "silver", weight: 2 })).toBeUndefined();
    expect(sanitizeHolding({ kind: "usd", amount: -3 })).toEqual({ kind: "usd", amount: 0 });
    expect(sanitizeHolding(null)).toBeUndefined();
  });
});

describe("display currency", () => {
  afterEach(() => setDisplayCurrency({ currency: "VND", vndPerUsd: null }));

  it("shows VND by default and USD when chosen", () => {
    expect(formatMoney(25_000_000)).toBe("25.000.000 ₫");
    setDisplayCurrency({ currency: "USD", vndPerUsd: 25_000 });
    expect(formatMoney(25_000_000)).toBe("$1.000");
    expect(formatMoney(312_500)).toBe("$12,50");
    expect(formatMoney(-25_000_000, { signDisplay: "auto" })).toBe("−$1.000");
    expect(formatMoney(25_000_000, { signDisplay: "exceptZero" })).toBe("+$1.000");
    expect(formatMoneyCompact(2_500_000_000)).toBe("$100K");
    expect(formatMoneyCompact(120_500_000_000)).toBe("$4,82M");
    expect(formatMoneyCompact(25_000_000_000_000)).toBe("$1B");
    expect(formatMoneyCompact(5_000_000)).toBe("$200");
    expect(formatMoneyCompact(2_500_000_000, { symbol: false })).toBe("$100K");
    // Inputs and exports keep đồng.
    expect(formatMoney(25_000_000, { currency: "VND" })).toBe("25.000.000 ₫");
  });

  it("falls back to VND without a rate", () => {
    setDisplayCurrency({ currency: "USD", vndPerUsd: null });
    expect(formatMoney(1_000)).toBe("1.000 ₫");
  });
});
