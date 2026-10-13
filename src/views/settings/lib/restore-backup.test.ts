import { describe, expect, it } from "vitest";

import { fixtureDebts, fixtureExpenseLog, fixtureExpenses, fixtureGoals, fixturePrefs } from "@/test/fixtures/tables";

import { MAX_BACKUP_CHARS, parseBackup } from "./restore-backup";

const TODAY = "2026-10-13";

describe("parseBackup", () => {
  it("reads an exported backup and lists what's in it", () => {
    const text = JSON.stringify({ exportedAt: "2026-10-01T10:00:00Z", tables: { debts: fixtureDebts, goals: fixtureGoals, preferences: fixturePrefs, expenses: fixtureExpenses, expenseLog: fixtureExpenseLog } });
    const out = parseBackup(text, TODAY);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.summary.exportedAt).toBe("2026-10-01T10:00:00Z");
    expect(out.summary.tables).toEqual([
      { key: "debts", count: 2 },
      { key: "goals", count: 2 },
      { key: "preferences", count: 1 },
      { key: "expenses", count: 7 },
      { key: "expenseLog", count: 2 },
    ]);
    // Older backups don't have every table: those are left alone, not emptied.
    expect(out.summary.missing).toEqual(["assets", "settingsAssets", "incomeSources", "personalLoans"]);
    expect(out.tables.assets).toBeUndefined();
  });

  it("drops rows without an id and fills a missing goals header", () => {
    const out = parseBackup(JSON.stringify({ tables: { debts: [{ id: "a", name: "A" }, { name: "no id" }, 5], goals: { profiles: [{ id: "g" }] } } }), TODAY);
    expect(out.ok && out.tables.debts).toEqual([{ id: "a", name: "A" }]);
    expect(out.ok && out.tables.goals).toMatchObject({ activeProfileId: "g", profiles: [{ id: "g" }] });
  });

  it("rejects things that aren't backups", () => {
    expect(parseBackup("{nope", TODAY)).toEqual({ ok: false, code: "invalid_json" });
    expect(parseBackup(JSON.stringify({ hello: 1 }), TODAY)).toEqual({ ok: false, code: "not_backup" });
    expect(parseBackup(JSON.stringify({ tables: {} }), TODAY)).toEqual({ ok: false, code: "not_backup" });
    expect(parseBackup(JSON.stringify({ tables: { debts: { not: "a list" } } }), TODAY)).toEqual({ ok: false, code: "invalid_table", table: "debts" });
    expect(parseBackup("x".repeat(MAX_BACKUP_CHARS + 1), TODAY)).toEqual({ ok: false, code: "too_large" });
  });
});
