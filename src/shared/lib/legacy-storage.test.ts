import { describe, expect, it } from "vitest";

import { migrateLegacyStorageKeys } from "@/shared/lib/legacy-storage";

function fakeStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("migrateLegacyStorageKeys", () => {
  it("moves every wealthtracker: key to cairn: and leaves other keys alone", () => {
    const s = fakeStorage({
      "wealthtracker:tables:v1:user-a": '{"dirty":["debts"]}',
      "wealthtracker:help-seen": "1",
      theme: "dark",
    });
    migrateLegacyStorageKeys(s);
    expect([...s.map.keys()].sort()).toEqual(["cairn:help-seen", "cairn:tables:v1:user-a", "theme"]);
    expect(s.map.get("cairn:tables:v1:user-a")).toBe('{"dirty":["debts"]}');
  });

  it("keeps the value already under the new name", () => {
    const s = fakeStorage({ "wealthtracker:rates:v1": "old", "cairn:rates:v1": "new" });
    migrateLegacyStorageKeys(s);
    expect(s.map.get("cairn:rates:v1")).toBe("new");
    expect(s.map.has("wealthtracker:rates:v1")).toBe(false);
  });

  it("keeps the old key when the new one cannot be written", () => {
    const s = fakeStorage({ "wealthtracker:tables:v1:local": "x" });
    s.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    migrateLegacyStorageKeys(s);
    expect(s.map.get("wealthtracker:tables:v1:local")).toBe("x");
  });
});
