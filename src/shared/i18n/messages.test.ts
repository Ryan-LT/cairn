import { describe, expect, it } from "vitest";

import { en } from "@/shared/i18n/messages/en";
import { vi } from "@/shared/i18n/messages/vi";

type Tree = { [k: string]: unknown };

/** Leaves as [path, value] (functions are called with sample params). */
function leaves(node: unknown, path = ""): [string, unknown][] {
  if (node && typeof node === "object") {
    return Object.entries(node as Tree).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [[path, node]];
}

const SAMPLE = new Proxy(
  {},
  { get: (_t, key) => (key === "count" || key === "age" || key === "min" || key === "max" || key === "minutes" || key === "status" || key === "year" || key === "day" ? 2 : `‹${String(key)}›`) },
);

function render(v: unknown): string {
  return typeof v === "function" ? String((v as (p: unknown) => unknown)(SAMPLE)) : String(v);
}

/** Words that are the same in both languages (brand, units, codes). */
const SAME_OK = /^(Cairn|English|Tiếng Việt|ETF|Crypto|Email|Email \(optional\)|OK|—|%|K|\$|₫|USD|VND|FX|PWA|PNJ|vang\.today|ExchangeRate-API)$/i;

describe("message dictionaries", () => {
  const enLeaves = new Map(leaves(en));
  const viLeaves = new Map(leaves(vi));

  it("Vietnamese has exactly the English keys", () => {
    expect([...viLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
  });

  it("every message is a non-empty string or a function of the same arity", () => {
    for (const [key, value] of enLeaves) {
      const other = viLeaves.get(key);
      expect(typeof other, key).toBe(typeof value);
      if (typeof value === "function") expect((other as () => unknown).length, key).toBe(value.length);
      // Pieces of a sentence split around an amount may be empty in one language.
      if (/\.(before|middle|after|prefix|suffix)$/.test(key)) continue;
      expect(render(value).trim(), key).not.toBe("");
      expect(render(other).trim(), key).not.toBe("");
    }
  });

  it("Vietnamese text is actually translated", () => {
    const untranslated = [...enLeaves]
      .filter(([key]) => !key.startsWith("domain.categories.") && !key.endsWith(".keywords"))
      .filter(([key, value]) => {
        const a = render(value);
        const b = render(viLeaves.get(key));
        // Currency codes inside a sentence ("1 USD = ‹rate› ₫") read the same in both languages.
        return a === b && !SAME_OK.test(a) && /[A-Za-z]{3,}/.test(a.replace(/‹\w+›/g, "").replace(/\b(USD|VND)\b/g, ""));
      })
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });

  /** English-only grammar helpers that Vietnamese doesn't need (e.g. "35th"). */
  const ENGLISH_ONLY = new Set(["‹ordinal›"]);

  it("placeholders survive translation", () => {
    for (const [key, value] of enLeaves) {
      if (typeof value !== "function") continue;
      const a = new Set(render(value).match(/‹\w+›/g) ?? []);
      const b = new Set(render(viLeaves.get(key)).match(/‹\w+›/g) ?? []);
      for (const p of a) if (!ENGLISH_ONLY.has(p)) expect(b.has(p), `${key} lost ${p}`).toBe(true);
      for (const p of b) expect(a.has(p), `${key} invents ${p}`).toBe(true);
    }
  });
});
