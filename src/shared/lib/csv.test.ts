import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("escapes delimiters, quotes and new lines, with a BOM for Excel", () => {
    const out = toCsv([
      ["Tháng", "Khoản chi", "Số tiền"],
      ["2026-10", 'Tiền "điện", nước', 1200000],
      ["2026-10", "Dòng\nhai", null],
    ]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out.slice(1).split("\r\n")).toEqual(["Tháng,Khoản chi,Số tiền", '2026-10,"Tiền ""điện"", nước",1200000', '2026-10,"Dòng\nhai",']);
  });

  it("uses semicolons and neutralises formulas", () => {
    expect(toCsv([["a;b", "=SUM(A1)", -5, " x"]], { delimiter: ";", bom: false })).toBe('"a;b";\'=SUM(A1);-5;" x"');
  });
});
