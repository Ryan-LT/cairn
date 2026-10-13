import { describe, expect, it } from "vitest";

import type { ExpenseItem, ExpenseLogDoc } from "@/entities/expense/model";
import type { IncomeSource } from "@/entities/income/model";
import type { SettingsAsset } from "@/entities/settings-asset/model";

import type { LedgerTxn } from "../model";
import { autoBillId, autoIncomeId, planAutomaticTxns } from "./automation";
import { accountMovements, accountUsdFor, countsForAccount } from "./balances";
import { mergeLedgerIntoLog } from "./merge";
import { planLegacyMigration } from "./migrate";
import { addTxns, allTxns, applyWrites, findTxn, isDismissed, putTxn, removeTxns, restoreTxns, type LedgerTables } from "./ops";
import { sanitizeLedgerMonth, sanitizeTxn } from "./sanitize";

const txn = (p: Partial<LedgerTxn> & Pick<LedgerTxn, "id" | "date" | "amount">): LedgerTxn => ({
  kind: "expense",
  at: `${p.date}T05:00:00.000Z`,
  source: { type: "instant" },
  ...p,
});

describe("sanitize", () => {
  it("keeps valid transactions and derives the kind from the source", () => {
    const t = sanitizeTxn({ id: "a", kind: "expense", date: "2026-10-05", amount: 120000.4, source: { type: "income", sourceId: "s1", month: "2026-10" } });
    expect(t).toMatchObject({ id: "a", kind: "income", amount: 120000 });
    expect(sanitizeTxn({ id: "b", date: "2026-10-05", amount: 5, source: { type: "bill", itemId: "i" } })).toBeNull(); // no month
    expect(sanitizeTxn({ id: "c", date: "5/10/2026", amount: 5, source: { type: "instant" } })).toBeNull();
    expect(sanitizeTxn({ id: "d", date: "2026-10-05", amount: 0, source: { type: "instant" } })).toBeNull();
  });

  it("allows negative amounts only for budget corrections", () => {
    expect(sanitizeTxn({ id: "a", date: "2026-10-05", amount: -500, source: { type: "instant" } })).toBeNull();
    expect(sanitizeTxn({ id: "b", date: "2026-10-05", amount: -500, correction: true, source: { type: "budget", itemId: "i", month: "2026-10" } })?.amount).toBe(-500);
  });

  it("drops duplicates and bad rows in a month", () => {
    const m = sanitizeLedgerMonth({ txns: [{ id: "a", date: "2026-10-01", amount: 1, source: { type: "instant" } }, { id: "a", date: "2026-10-02", amount: 2, source: { type: "instant" } }, null], dismissed: ["x", "x", 3] });
    expect(m.txns.map((t) => t.amount)).toEqual([1]);
    expect(m.dismissed).toEqual(["x"]);
    expect(sanitizeLedgerMonth("nope")).toEqual({ txns: [] });
  });
});

describe("ledger tables", () => {
  const empty: LedgerTables = {};

  it("adds into the month of the date and never twice", () => {
    let t = applyWrites(empty, addTxns(empty, [txn({ id: "a", date: "2026-10-05", amount: 10 }), txn({ id: "b", date: "2026-11-01", amount: 20 })]));
    expect(Object.keys(t).sort()).toEqual(["ledger:2026-10", "ledger:2026-11"]);
    expect(addTxns(t, [txn({ id: "a", date: "2026-12-01", amount: 99 })])).toEqual({});
    t = applyWrites(t, addTxns(t, [txn({ id: "c", date: "2026-10-09", amount: 5 })]));
    expect(allTxns(t).map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("moves a transaction when its date changes month", () => {
    let t = applyWrites(empty, addTxns(empty, [txn({ id: "a", date: "2026-10-31", amount: 10 })]));
    t = applyWrites(t, putTxn(t, txn({ id: "a", date: "2026-11-01", amount: 12 })));
    expect(t["ledger:2026-10"].txns).toEqual([]);
    expect(findTxn(t, "a")).toMatchObject({ key: "ledger:2026-11", txn: { amount: 12 } });
  });

  it("dismisses only automatic and carried entries, and undo brings them back", () => {
    let t = applyWrites(empty, addTxns(empty, [txn({ id: "auto", date: "2026-10-05", amount: 10, auto: true }), txn({ id: "hand", date: "2026-10-06", amount: 5 })]));
    const removed = allTxns(t);
    t = applyWrites(t, removeTxns(t, ["auto", "hand"], { dismiss: true }));
    expect(allTxns(t)).toEqual([]);
    expect(isDismissed(t, "auto")).toBe(true);
    expect(isDismissed(t, "hand")).toBe(false);
    t = applyWrites(t, restoreTxns(t, removed));
    expect(allTxns(t).map((x) => x.id).sort()).toEqual(["auto", "hand"]);
    expect(isDismissed(t, "auto")).toBe(false);
  });
});

describe("merge into the month log", () => {
  const log: ExpenseLogDoc = {
    months: {
      "2026-09": { bill1: { payments: [{ amount: 900, date: "2026-09-05" }] } },
      "2026-10": { bill1: { planned: 1000, payments: [{ amount: 1, date: "2026-10-01" }] }, bud: { spent: 77 }, bill2: { skipped: true } },
    },
  };
  const txns = [
    txn({ id: "p1", date: "2026-09-29", amount: 1000, source: { type: "bill", itemId: "bill1", month: "2026-10" } }),
    txn({ id: "p2", date: "2026-10-15", amount: 200, source: { type: "bill", itemId: "bill1", month: "2026-10" }, auto: true }),
    txn({ id: "s1", date: "2026-10-03", amount: 300, source: { type: "budget", itemId: "bud", month: "2026-10" } }),
    txn({ id: "s2", date: "2026-10-04", amount: -100, correction: true, source: { type: "budget", itemId: "bud", month: "2026-10" } }),
    txn({ id: "i1", date: "2026-10-04", amount: 50 }),
    txn({ id: "i2", date: "2026-11-01", amount: 25 }),
    txn({ id: "in", date: "2026-10-05", amount: 9000, kind: "income", source: { type: "income", sourceId: "s", month: "2026-10" } }),
  ];
  const merged = mergeLedgerIntoLog(log, txns);

  it("takes payments and spending from the ledger for the month they belong to", () => {
    expect(merged.months["2026-10"].bill1.payments).toEqual([
      { amount: 1000, date: "2026-09-29", txnId: "p1" },
      { amount: 200, date: "2026-10-15", txnId: "p2", auto: true },
    ]);
    expect(merged.months["2026-10"].bill1.planned).toBe(1000);
    expect(merged.months["2026-10"].bud.spent).toBe(200);
    expect(merged.months["2026-10"].bill2.skipped).toBe(true);
  });

  it("keeps the old log where the ledger has nothing, and sums unplanned spending", () => {
    expect(merged.months["2026-09"].bill1.payments).toEqual([{ amount: 900, date: "2026-09-05" }]);
    expect(merged.unplanned).toEqual({ "2026-10": 50, "2026-11": 25 });
    expect(mergeLedgerIntoLog(log, [])).toBe(log);
  });

  it("never lets corrections take a budget below zero", () => {
    const m = mergeLedgerIntoLog({ months: {} }, [txn({ id: "c", date: "2026-10-01", amount: -50, correction: true, source: { type: "budget", itemId: "b", month: "2026-10" } })]);
    expect(m.months["2026-10"].b.spent).toBe(0);
  });
});

describe("account balances", () => {
  const cash: SettingsAsset = { id: "cash", name: "Ví", category: "Cash", currentValue: 1_000_000, valueAsOf: "2026-10-10T08:00:00.000Z" };
  const usd: SettingsAsset = { id: "usd", name: "USD", category: "Cash", currentValue: 0, holding: { kind: "usd", amount: 100 }, updatedAt: "2026-10-01" };
  const gold: SettingsAsset = { id: "gold", name: "Vàng", category: "Precious Metals", currentValue: 0, holding: { kind: "gold", product: "k18", weight: 1, unit: "chi" } };

  it("counts only what came after the balance was set", () => {
    // valueAsOf 2026-10-10 08:00Z is 15:00 in Vietnam.
    expect(countsForAccount(cash, { date: "2026-10-11", at: "2026-10-11T01:00:00.000Z" })).toBe(true);
    expect(countsForAccount(cash, { date: "2026-10-09", at: "2026-10-12T01:00:00.000Z" })).toBe(false);
    expect(countsForAccount(cash, { date: "2026-10-10", at: "2026-10-10T09:00:00.000Z" })).toBe(true);
    expect(countsForAccount(cash, { date: "2026-10-10", at: "2026-10-10T07:00:00.000Z" })).toBe(false);
    expect(countsForAccount(usd, { date: "2026-10-01", at: "2026-10-01T23:00:00.000Z" })).toBe(false);
    expect(countsForAccount({}, { date: "2000-01-01", at: "2000-01-01T00:00:00.000Z" })).toBe(true);
  });

  it("moves VND and USD accounts, never gold, a deleted one or a future date", () => {
    const txns = [
      txn({ id: "a", date: "2026-10-11", amount: 200_000, accountId: "cash" }),
      txn({ id: "b", date: "2026-10-12", amount: 50_000, kind: "income", source: { type: "extra" }, accountId: "cash" }),
      txn({ id: "c", date: "2026-10-30", amount: 999, accountId: "cash" }),
      txn({ id: "d", date: "2026-10-11", amount: 260_000, accountId: "usd", accountUsd: 10 }),
      txn({ id: "e", date: "2026-10-11", amount: 26_000, accountId: "usd" }),
      txn({ id: "f", date: "2026-10-11", amount: 1, accountId: "gold" }),
      txn({ id: "g", date: "2026-10-11", amount: 1, accountId: "gone" }),
    ];
    const m = accountMovements([cash, usd, gold], txns, "2026-10-13", 26_000);
    expect(m.get("cash")).toBe(-150_000);
    expect(m.get("usd")).toBeCloseTo(-11, 10);
    expect(m.has("gold")).toBe(false);
    expect(m.has("gone")).toBe(false);
    expect(accountUsdFor(usd, 52_000, undefined, 26_000)).toBe(2);
    expect(accountUsdFor(usd, 52_000, 1.95, 26_000)).toBe(1.95);
    expect(accountUsdFor(cash, 52_000, undefined, 26_000)).toBeUndefined();
  });
});

describe("carrying the old log over", () => {
  const log: ExpenseLogDoc = {
    months: {
      "2026-09": {
        rent: { planned: 5, payments: [{ amount: 5_000_000, date: "2026-09-05" }, { amount: 100, date: "2026-09-05" }, { amount: 100, date: "2026-09-05" }] },
        food: { spent: 3_000_000 },
        gym: { skipped: true },
      },
      "2026-10": { food: { spent: 200_000, planned: 1 } },
    },
  };

  it("creates ledger entries with stable ids and strips the log", () => {
    const plan = planLegacyMigration(log, {}, "2026-10-13")!;
    const t = applyWrites({}, plan.writes);
    const ids = allTxns(t).map((x) => x.id).sort();
    expect(ids).toEqual([
      "mig-2026-09-food-spent",
      "mig-2026-09-rent-2026-09-05-100-1",
      "mig-2026-09-rent-2026-09-05-100-2",
      "mig-2026-09-rent-2026-09-05-5000000-1",
      "mig-2026-10-food-spent",
    ]);
    expect(findTxn(t, "mig-2026-09-food-spent")?.txn).toMatchObject({ date: "2026-09-30", amount: 3_000_000, legacy: true, source: { type: "budget", itemId: "food", month: "2026-09" } });
    expect(findTxn(t, "mig-2026-10-food-spent")?.txn.date).toBe("2026-10-13");
    expect(plan.log).toEqual({ months: { "2026-09": { rent: { planned: 5 }, gym: { skipped: true } }, "2026-10": { food: { planned: 1 } } } });
    // The merged view is the same before and after.
    expect(mergeLedgerIntoLog(plan.log, allTxns(t)).months["2026-09"].rent.payments?.map((p) => p.amount)).toEqual([100, 100, 5_000_000]);
  });

  it("is idempotent and respects removals", () => {
    const first = planLegacyMigration(log, {}, "2026-10-13")!;
    let t = applyWrites({}, first.writes);
    // An older app wrote the old log again: nothing new.
    expect(planLegacyMigration(log, t, "2026-10-13")!.writes).toEqual({});
    t = applyWrites(t, removeTxns(t, ["mig-2026-09-food-spent"], { dismiss: true }));
    expect(planLegacyMigration(log, t, "2026-10-13")!.writes).toEqual({});
    expect(planLegacyMigration(first.log, t, "2026-10-13")).toBeNull();
  });
});

describe("automatic entries", () => {
  const base = { log: { months: {} } as ExpenseLogDoc, debts: [], now: "2026-10-13T03:00:00.000Z", isDismissed: () => false };
  const bill = (p: Partial<ExpenseItem>): ExpenseItem => ({ id: "rent", name: "Thuê nhà", category: "housing", kind: "bill", amount: 9_000_000, frequency: "monthly", dueDay: 5, autopay: true, autoSince: "2026-09-01", createdAt: "2026-01-01", accountId: "bank", ...p });
  const salary = (p: Partial<IncomeSource>): IncomeSource => ({ id: "sal", kind: "active", name: "Lương", details: "", icon: "work", monthly: 30_000_000, paymentDay: 10, autoReceive: true, autoSince: "2026-09-01", accountId: "bank", ...p });

  it("records autopay bills on each due date since autoSince, up to today", () => {
    const out = planAutomaticTxns({ ...base, items: [bill({})], sources: [], txns: [], today: "2026-10-04" });
    expect(out.map((t) => [t.id, t.date, t.amount, t.accountId, t.source])).toEqual([[autoBillId("rent", "2026-09-05"), "2026-09-05", 9_000_000, "bank", { type: "bill", itemId: "rent", month: "2026-09" }]]);
    expect(planAutomaticTxns({ ...base, items: [bill({})], sources: [], txns: [], today: "2026-10-05" })).toHaveLength(2);
  });

  it("leaves paid, skipped, dismissed, paused and pre-autoSince occurrences alone", () => {
    const paid = txn({ id: "hand", date: "2026-09-03", amount: 9_000_000, source: { type: "bill", itemId: "rent", month: "2026-09" } });
    const skipped: ExpenseLogDoc = { months: { "2026-10": { rent: { skipped: true } } } };
    expect(planAutomaticTxns({ ...base, items: [bill({})], sources: [], txns: [paid], today: "2026-10-13", log: skipped })).toEqual([]);
    expect(planAutomaticTxns({ ...base, items: [bill({})], sources: [], txns: [], today: "2026-10-13", isDismissed: (id) => id.endsWith("09-05") }).map((t) => t.date)).toEqual(["2026-10-05"]);
    expect(planAutomaticTxns({ ...base, items: [bill({ paused: true })], sources: [], txns: [], today: "2026-10-13" })).toEqual([]);
    expect(planAutomaticTxns({ ...base, items: [bill({ autoSince: "2026-10-06" })], sources: [], txns: [], today: "2026-10-13" })).toEqual([]);
    expect(planAutomaticTxns({ ...base, items: [bill({ autoSince: undefined })], sources: [], txns: [], today: "2026-10-13" })).toEqual([]);
    // Removed in October: not planned in October (as in the month view).
    expect(planAutomaticTxns({ ...base, items: [bill({ archivedAt: "2026-10-01" })], sources: [], txns: [], today: "2026-10-13" }).map((t) => t.date)).toEqual(["2026-09-05"]);
  });

  it("handles weekly bills, undated bills and dollars", () => {
    const weekly = bill({ id: "w", frequency: "weekly", dueDay: undefined, dueWeekday: 1, amount: 100_000, autoSince: "2026-10-01" });
    expect(planAutomaticTxns({ ...base, items: [weekly], sources: [], txns: [], today: "2026-10-13" }).map((t) => t.date)).toEqual(["2026-10-05", "2026-10-12"]);
    const undated = bill({ id: "u", dueDay: undefined, autoSince: "2026-09-01" });
    expect(planAutomaticTxns({ ...base, items: [undated], sources: [], txns: [], today: "2026-10-13" }).map((t) => t.date)).toEqual(["2026-09-30"]);
    const usd = bill({ id: "n", amount: 390_000, amountUsd: 15, autoSince: "2026-10-01" });
    expect(planAutomaticTxns({ ...base, items: [usd], sources: [], txns: [], today: "2026-10-13" })[0]).toMatchObject({ amount: 390_000, amountUsd: 15 });
  });

  it("records income on its payment day, clamped to short months", () => {
    const out = planAutomaticTxns({ ...base, items: [], sources: [salary({ paymentDay: 31, autoSince: "2027-02-01" })], txns: [], today: "2027-03-01" });
    expect(out.map((t) => [t.id, t.date, t.kind])).toEqual([[autoIncomeId("sal", "2027-02"), "2027-02-28", "income"]]);
    const confirmed = txn({ id: "c", kind: "income", date: "2026-10-09", amount: 1, source: { type: "income", sourceId: "sal", month: "2026-10" } });
    expect(planAutomaticTxns({ ...base, items: [], sources: [salary({})], txns: [confirmed], today: "2026-10-13" }).map((t) => t.date)).toEqual(["2026-09-10"]);
    expect(planAutomaticTxns({ ...base, items: [], sources: [salary({ autoReceive: false })], txns: [], today: "2026-10-13" })).toEqual([]);
    // Running again with what it made adds nothing.
    const first = planAutomaticTxns({ ...base, items: [bill({})], sources: [salary({})], txns: [], today: "2026-10-13" });
    expect(planAutomaticTxns({ ...base, items: [bill({})], sources: [salary({})], txns: first, today: "2026-10-13" })).toEqual([]);
  });
});
