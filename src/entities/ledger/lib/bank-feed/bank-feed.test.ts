import { describe, expect, it } from "vitest";

import type { ExpenseItem } from "@/entities/expense/model";
import type { SettingsAsset } from "@/entities/settings-asset/model";

import { removeTxns, type LedgerTables } from "../ops";
import { sanitizeTxn } from "../sanitize";
import { guessCategory } from "./guess-category";
import { hookTxnId, inboxToTxn, planInboxTxns, resolveAccount, sourceForCategory, type InboxItem } from "./inbox";
import { parseAmount, parseWebhookBody } from "./parse";

// 2026-10-15 10:00 in Vietnam.
const NOW = new Date("2026-10-15T03:00:00.000Z");

describe("parseAmount", () => {
  it("reads numbers and Vietnamese / English formatted strings", () => {
    expect(parseAmount(50000)).toBe(50000);
    expect(parseAmount(-1250.4)).toBe(-1250);
    expect(parseAmount("50.000")).toBe(50000);
    expect(parseAmount("1,250,000")).toBe(1250000);
    expect(parseAmount("-75000")).toBe(-75000);
    expect(parseAmount("50.000 đ")).toBe(50000);
    expect(parseAmount("1,250,000.50")).toBe(1250001);
    expect(parseAmount("1.250.000,50")).toBe(1250001);
    expect(parseAmount("12.5")).toBe(13);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(1e14)).toBeNull();
  });
});

describe("parseWebhookBody: generic", () => {
  it("reads one transaction; sign or type decides the direction", () => {
    const r = parseWebhookBody({ title: "Phở Thìn", amount: -65000, date: "2026-10-15 07:45", id: "abc" }, NOW);
    expect(r).toEqual({
      ok: true,
      provider: "generic",
      items: [{ ref: "abc", txn: { kind: "expense", amount: 65000, date: "2026-10-15", at: "2026-10-15T00:45:00.000Z", title: "Phở Thìn", category: "food" } }],
    });
    const typed = parseWebhookBody({ title: "Lương", amount: 30000000, type: "in" }, NOW);
    expect(typed.ok && typed.items[0].txn).toMatchObject({ kind: "income", amount: 30000000, date: "2026-10-15", at: NOW.toISOString() });
    const out = parseWebhookBody({ title: "Grab", amount: "45.000", type: "out" }, NOW);
    expect(out.ok && out.items[0].txn).toMatchObject({ kind: "expense", amount: 45000, category: "transport" });
  });

  it("reads dates as Vietnam time and keeps the Vietnamese day", () => {
    // 06:30 on the 15th in Vietnam is still the 14th in UTC.
    const r = parseWebhookBody({ title: "Bánh mì", amount: -20000, date: "2026-10-15T06:30:00" }, NOW);
    expect(r.ok && r.items[0].txn).toMatchObject({ date: "2026-10-15", at: "2026-10-14T23:30:00.000Z" });
    const z = parseWebhookBody({ title: "x", amount: -1, date: "2026-10-14T23:30:00Z" }, NOW);
    expect(z.ok && z.items[0].txn.date).toBe("2026-10-15");
    const dmy = parseWebhookBody({ title: "x", amount: -1, date: "01/10/2026" }, NOW);
    expect(dmy.ok && dmy.items[0].txn).toMatchObject({ date: "2026-10-01", at: "2026-10-01T05:00:00.000Z" });
    const epoch = parseWebhookBody({ title: "x", amount: -1, date: NOW.getTime() / 1000 - 3600 }, NOW);
    expect(epoch.ok && epoch.items[0].txn.date).toBe("2026-10-15");
  });

  it("accepts a batch and a bare array", () => {
    const r = parseWebhookBody({ transactions: [{ title: "a", amount: -1 }, { title: "b", amount: 2 }] }, NOW);
    expect(r.ok && r.items.map((i) => i.txn.kind)).toEqual(["expense", "income"]);
    const arr = parseWebhookBody([{ title: "a", amount: -1 }], NOW);
    expect(arr.ok && arr.items).toHaveLength(1);
  });

  it("keeps an explicit category, ignores an unknown one, and drops the note when it repeats the title", () => {
    const r = parseWebhookBody({ title: "Siêu thị", amount: -1, category: "family", note: "Siêu thị" }, NOW);
    expect(r.ok && r.items[0].txn).toEqual(expect.objectContaining({ category: "family" }));
    expect(r.ok && r.items[0].txn.note).toBeUndefined();
    const unknown = parseWebhookBody({ title: "Netflix", amount: -1, category: "nope" }, NOW);
    expect(unknown.ok && unknown.items[0].txn.category).toBe("subscriptions");
    const income = parseWebhookBody({ title: "Grab hoàn tiền", amount: 5, category: "transport" }, NOW);
    expect(income.ok && income.items[0].txn.category).toBeUndefined();
  });

  it("refuses bad input with the failing index", () => {
    expect(parseWebhookBody("hello", NOW)).toMatchObject({ ok: false, code: "invalid_body" });
    expect(parseWebhookBody({ foo: 1 }, NOW)).toMatchObject({ ok: false, code: "invalid_body" });
    expect(parseWebhookBody({ transactions: [{ amount: -1 }, { amount: 0 }] }, NOW)).toMatchObject({ ok: false, code: "invalid_item", index: 1 });
    expect(parseWebhookBody({ amount: -1, type: "sideways" }, NOW)).toMatchObject({ ok: false, code: "invalid_item" });
    expect(parseWebhookBody({ amount: -1, date: "2026-13-40" }, NOW)).toMatchObject({ ok: false, code: "invalid_item" });
    expect(parseWebhookBody({ amount: -1, date: "2026-10-20" }, NOW)).toMatchObject({ ok: false, code: "invalid_item" }); // future
    expect(parseWebhookBody({ amount: -1, date: "2024-01-01" }, NOW)).toMatchObject({ ok: false, code: "invalid_item" }); // too old
    expect(parseWebhookBody({ transactions: Array.from({ length: 101 }, () => ({ amount: -1 })) }, NOW)).toMatchObject({ ok: false, code: "too_many" });
  });
});

describe("parseWebhookBody: SePay", () => {
  const sepay = {
    id: 92704,
    gateway: "Vietcombank",
    transactionDate: "2026-10-15 09:12:30",
    accountNumber: "0123499999",
    code: null,
    content: "HIGHLANDS COFFEE VINCOM",
    transferType: "out",
    transferAmount: 59000,
    accumulated: 19077000,
    subAccount: null,
    referenceCode: "MBVCB.3278907687",
    description: "",
  };

  it("maps a transfer out", () => {
    const r = parseWebhookBody(sepay, NOW);
    expect(r).toEqual({
      ok: true,
      provider: "sepay",
      items: [
        {
          ref: "92704",
          txn: {
            kind: "expense",
            amount: 59000,
            date: "2026-10-15",
            at: "2026-10-15T02:12:30.000Z",
            title: "HIGHLANDS COFFEE VINCOM",
            note: "Vietcombank · MBVCB.3278907687",
            category: "food",
            account: "0123499999",
          },
        },
      ],
    });
  });

  it("maps a transfer in", () => {
    const r = parseWebhookBody({ ...sepay, transferType: "in", content: "LUONG THANG 10" }, NOW);
    expect(r.ok && r.items[0].txn).toMatchObject({ kind: "income", amount: 59000 });
    expect(r.ok && r.items[0].txn.category).toBeUndefined();
  });
});

describe("parseWebhookBody: Casso", () => {
  it("reads v1 (array, signed amount, tid)", () => {
    const r = parseWebhookBody(
      {
        error: 0,
        data: [
          { id: 1, tid: "TF1", description: "GRAB*TRIP HCM", amount: -38000, cusum_balance: 1, when: "2026-10-14 18:20:00", bank_sub_acc_id: "123456789" },
          { id: 2, tid: "TF2", description: "CK tu NGUYEN VAN A", amount: 500000, when: "2026-10-14 19:00:00", bank_sub_acc_id: "123456789" },
        ],
      },
      NOW,
    );
    expect(r.ok && r.provider).toBe("casso");
    expect(r.ok && r.items.map((i) => [i.ref, i.txn.kind, i.txn.amount, i.txn.category ?? null])).toEqual([
      ["TF1", "expense", 38000, "transport"],
      ["TF2", "income", 500000, null],
    ]);
  });

  it("reads v2 (one object, transactionDateTime, reference)", () => {
    const r = parseWebhookBody(
      {
        error: 0,
        data: { id: 9, reference: "FT2610", description: "EVN HCMC tien dien T10", amount: -820000, transactionDateTime: "2026-10-10 08:00:00", accountNumber: "8888", bankName: "ACB" },
      },
      NOW,
    );
    expect(r.ok && r.items[0]).toEqual({
      ref: "FT2610",
      txn: { kind: "expense", amount: 820000, date: "2026-10-10", at: "2026-10-10T01:00:00.000Z", title: "EVN HCMC tien dien T10", note: "ACB", category: "utilities", account: "8888" },
    });
  });

  it("accepts Casso's empty test call", () => {
    expect(parseWebhookBody({ error: 0, data: [] }, NOW)).toEqual({ ok: true, provider: "casso", items: [] });
  });
});

describe("guessCategory", () => {
  it("matches whole words without accents, food before transport", () => {
    expect(guessCategory("Thanh toán GrabFood đơn 123")).toBe("food");
    expect(guessCategory("GRAB*TRIP")).toBe("transport");
    expect(guessCategory("Đổ xăng Petrolimex")).toBe("transport");
    expect(guessCategory("Tiền điện tháng 10")).toBe("utilities");
    expect(guessCategory("SHOPEE PAY")).toBe("shopping");
    expect(guessCategory("Nhà thuốc Long Châu")).toBe("health");
    expect(guessCategory("chuyen tien")).toBeNull();
    expect(guessCategory("company.com")).toBeNull();
    expect(guessCategory("")).toBeNull();
  });
});

const item = (p: Partial<ExpenseItem> & Pick<ExpenseItem, "id" | "category">): ExpenseItem => ({
  name: p.id,
  kind: "budget",
  amount: 3_000_000,
  frequency: "monthly",
  createdAt: "2026-01-01",
  ...p,
});

const asset = (p: Partial<SettingsAsset> & Pick<SettingsAsset, "id" | "name">): SettingsAsset => ({ category: "cash", currentValue: 0, ...p });

const inbox = (p: Partial<InboxItem> & { txn: InboxItem["txn"] }): InboxItem => ({
  id: "11111111-1111-1111-1111-111111111111",
  provider: "sepay",
  receivedAt: "2026-10-15T03:00:00.000Z",
  defaultAccountId: null,
  acked: false,
  ...p,
});

describe("inbox → ledger", () => {
  const items = [
    item({ id: "food", category: "food" }),
    item({ id: "fuel", category: "transport" }),
    item({ id: "taxi", category: "transport" }),
    item({ id: "rent", category: "housing", kind: "bill" }),
    item({ id: "old", category: "health", archivedAt: "2026-09-01" }),
  ];

  it("counts money out toward the one budget of that category", () => {
    expect(sourceForCategory("food", "2026-10", items)).toEqual({ type: "budget", itemId: "food", month: "2026-10" });
    expect(sourceForCategory("transport", "2026-10", items)).toEqual({ type: "instant" }); // two budgets
    expect(sourceForCategory("housing", "2026-10", items)).toEqual({ type: "instant" }); // a bill, not a budget
    expect(sourceForCategory("health", "2026-10", items)).toEqual({ type: "instant" }); // archived
    expect(sourceForCategory(undefined, "2026-10", items)).toEqual({ type: "instant" });
  });

  it("resolves the account by id, name, bank number, else the key's default", () => {
    const assets = [asset({ id: "a1", name: "VCB 0123499999" }), asset({ id: "a2", name: "Ví" }), asset({ id: "g", name: "Vàng", holding: { kind: "gold", product: "sjc_bar", weight: 1, unit: "chi" } })];
    expect(resolveAccount("a2", assets)?.id).toBe("a2");
    expect(resolveAccount("ví", assets)?.id).toBe("a2");
    expect(resolveAccount("0123499999", assets)?.id).toBe("a1");
    expect(resolveAccount("Vàng", assets)).toBeUndefined(); // gold can't take postings
    expect(resolveAccount(undefined, assets)).toBeUndefined();

    const t = inboxToTxn(inbox({ defaultAccountId: "a2", txn: { kind: "expense", amount: 59000, date: "2026-10-15", at: "2026-10-15T02:00:00.000Z", title: "Highlands", category: "food" } }), {
      items,
      assets,
      vndPerUsd: 25000,
    });
    expect(t).toEqual({
      id: "hook-11111111-1111-1111-1111-111111111111",
      kind: "expense",
      date: "2026-10-15",
      at: "2026-10-15T02:00:00.000Z",
      amount: 59000,
      source: { type: "budget", itemId: "food", month: "2026-10" },
      via: { kind: "webhook", provider: "sepay" },
      name: "Highlands",
      accountId: "a2",
    });
  });

  it("files money in as other income and unplanned spending under its category", () => {
    const ctx = { items, assets: [], vndPerUsd: null };
    expect(inboxToTxn(inbox({ txn: { kind: "income", amount: 5, date: "2026-10-15", at: "x" } }), ctx).source).toEqual({ type: "extra" });
    const out = inboxToTxn(inbox({ txn: { kind: "expense", amount: 5, date: "2026-10-15", at: "x", category: "transport" } }), ctx);
    expect(out).toMatchObject({ source: { type: "instant" }, category: "transport" });
    expect(inboxToTxn(inbox({ txn: { kind: "expense", amount: 5, date: "2026-10-15", at: "x" } }), ctx).category).toBe("other");
  });

  it("skips entries already in the ledger or deleted by hand", () => {
    const rows = ["a", "b", "c"].map((id) => inbox({ id, txn: { kind: "expense", amount: 1, date: "2026-10-15", at: "x" } }));
    const planned = planInboxTxns(rows, { items, assets: [], vndPerUsd: null, has: (id) => id === hookTxnId("a"), isDismissed: (id) => id === hookTxnId("b") });
    expect(planned.map((t) => t.id)).toEqual(["hook-c"]);
  });

  it("keeps `via` through sanitize, and deleting dismisses it", () => {
    const raw = { id: "hook-x", date: "2026-10-15", at: "2026-10-15T02:00:00.000Z", amount: 5, source: { type: "instant" }, via: { kind: "webhook", provider: "casso" } };
    const t = sanitizeTxn(raw)!;
    expect(t.via).toEqual({ kind: "webhook", provider: "casso" });
    expect(sanitizeTxn({ ...raw, via: { kind: "webhook", provider: "evil" } })?.via).toBeUndefined();
    const tables: LedgerTables = { "ledger:2026-10": { txns: [t] } };
    expect(removeTxns(tables, ["hook-x"], { dismiss: true })["ledger:2026-10"]).toEqual({ txns: [], dismissed: ["hook-x"] });
  });
});
