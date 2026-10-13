import { describe, expect, it } from "vitest";

import { parseExchangeRateApi, parseGoldApi, parseLooseNumber, parsePnj, parseVangToday, parseVietcombank, parseVnDateTime } from "./rates";

// Shapes as returned by the live sources (trimmed).
const VCB = {
  Count: 20,
  Date: "2026-10-13T00:00:00",
  UpdatedDate: "2026-10-13T16:32:01+07:00",
  Data: [
    { currencyName: "US DOLLAR", currencyCode: "USD", cash: "25690.00", transfer: "25720.00", sell: "26100.00" },
    { currencyName: "EURO", currencyCode: "EUR", cash: "28225.74", transfer: "28510.84", sell: "29714.48" },
  ],
};
const PNJ = {
  data: [
    { masp: "SJC", tensp: "Vàng miếng SJC 999.9", giaban: 14430, giamua: 14130 },
    { masp: "N24K", tensp: "Nhẫn Trơn PNJ 999.9", giaban: 14380, giamua: 14080 },
    { masp: "24K", tensp: "Vàng nữ trang 999.9", giaban: 14250, giamua: 13800 },
    { masp: "75", tensp: "Vàng 750 (18K)", giaban: 10688, giamua: 9698 },
    { masp: "58.5", tensp: "Vàng 585 (14K)", giaban: 8336, giamua: 7346 },
    { masp: "RAW_9999", tensp: "Vàng nguyên liệu", giaban: "", giamua: 13200 },
  ],
  chinhanh: "hochiminh",
  updateDate: "13/10/2026 13:54:19",
};
const VANG_TODAY = {
  success: true,
  timestamp: 1791887403,
  prices: {
    XAUUSD: { name: "World Gold (XAU/USD)", buy: 4181.9, sell: 0, currency: "USD" },
    SJL1L10: { name: "SJC 9999", buy: 141300000, sell: 144300000, currency: "VND" },
    SJ9999: { name: "SJC Ring", buy: 140800000, sell: 143800000, currency: "VND" },
  },
};

describe("rate parsers", () => {
  it("reads loose numbers", () => {
    expect(parseLooseNumber("25,720.00")).toBe(25720);
    expect(parseLooseNumber(14130)).toBe(14130);
    expect(parseLooseNumber("")).toBeNaN();
    expect(parseLooseNumber(null)).toBeNaN();
  });

  it("takes Vietcombank's USD transfer rate", () => {
    expect(parseVietcombank(VCB)).toEqual({ rate: 25720, buy: 25690, sell: 26100, at: "2026-10-13T09:32:01.000Z" });
    expect(parseVietcombank({ Data: [] })).toBeNull();
    expect(parseVietcombank({ Data: [{ currencyCode: "USD", transfer: "0" }] })).toBeNull();
    expect(parseVietcombank(null)).toBeNull();
  });

  it("reads both ExchangeRate-API shapes", () => {
    expect(parseExchangeRateApi({ result: "success", base_code: "USD", rates: { VND: 25897.06 }, time_last_update_unix: 1791849451 })).toEqual({
      rate: 25897.06,
      at: "2026-10-12T23:57:31.000Z",
    });
    expect(parseExchangeRateApi({ result: "success", conversion_rates: { VND: 25800 } })?.rate).toBe(25800);
    expect(parseExchangeRateApi({ result: "error" })).toBeNull();
    expect(parseExchangeRateApi({ result: "success", base_code: "EUR", rates: { VND: 28000 } })).toBeNull();
  });

  it("reads PNJ prices per chỉ (thousand đồng) by purity", () => {
    const r = parsePnj(PNJ)!;
    expect(r.prices.sjc_bar).toEqual({ buy: 14_130_000, sell: 14_430_000 });
    expect(r.prices.ring_9999).toEqual({ buy: 14_080_000, sell: 14_380_000 });
    expect(r.prices.k18).toEqual({ buy: 9_698_000, sell: 10_688_000 });
    expect(r.prices.k14).toEqual({ buy: 7_346_000, sell: 8_336_000 });
    expect(r.at).toBe("2026-10-13T06:54:19.000Z");
    expect(parsePnj({ data: [{ masp: "75", giamua: 9698, giaban: 10688 }] })).toBeNull();
  });

  it("reads vang.today prices per lượng as per chỉ", () => {
    const r = parseVangToday(VANG_TODAY)!;
    expect(r.prices.sjc_bar).toEqual({ buy: 14_130_000, sell: 14_430_000 });
    expect(r.prices.ring_9999).toEqual({ buy: 14_080_000, sell: 14_380_000 });
    expect(r.worldUsdPerOunce).toBe(4181.9);
    expect(parseVangToday({ success: false })).toBeNull();
  });

  it("reads the world price and Vietnam times", () => {
    expect(parseGoldApi({ price: 4181.799805, symbol: "XAU" })).toBeCloseTo(4181.8, 1);
    expect(parseGoldApi({ price: 0 })).toBeNull();
    expect(parseVnDateTime("1/2/2026 7:05")).toBe("2026-02-01T00:05:00.000Z");
    expect(parseVnDateTime("2026-10-13")).toBeUndefined();
  });
});
