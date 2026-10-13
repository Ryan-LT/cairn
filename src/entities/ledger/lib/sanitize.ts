import { EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from "@/entities/expense/model";
import { isMonthKey } from "@/shared/lib/month";

import type { LedgerMonth, LedgerTxn, TxnSource } from "../model";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function text(v: unknown, max: number): string | undefined {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || undefined;
}

function finite(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function source(v: unknown): TxnSource | null {
  if (!isRecord(v)) return null;
  const id = (k: string) => (typeof v[k] === "string" && v[k] ? (v[k] as string) : null);
  const month = typeof v.month === "string" && isMonthKey(v.month) ? v.month : null;
  switch (v.type) {
    case "bill":
    case "budget": {
      const itemId = id("itemId");
      return itemId && month ? { type: v.type, itemId, month } : null;
    }
    case "income": {
      const sourceId = id("sourceId");
      return sourceId && month ? { type: "income", sourceId, month } : null;
    }
    case "instant":
      return { type: "instant" };
    case "extra":
      return { type: "extra" };
    default:
      return null;
  }
}

/** A stored or drafted transaction in canonical shape, or `null` if it isn't one. */
export function sanitizeTxn(raw: unknown): LedgerTxn | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const src = source(raw.source);
  const date = typeof raw.date === "string" && ISO_DAY.test(raw.date) ? raw.date : null;
  const amount = finite(raw.amount);
  if (!src || !date || amount === undefined) return null;
  const kind = src.type === "income" || src.type === "extra" ? "income" : "expense";
  const correction = raw.correction === true && src.type === "budget";
  // Only a budget correction may be negative; nothing is ever zero.
  const value = Math.round(correction ? amount : Math.max(0, amount));
  if (value === 0 && !correction) return null;
  const txn: LedgerTxn = {
    id: raw.id,
    kind,
    date,
    at: typeof raw.at === "string" && !Number.isNaN(Date.parse(raw.at)) ? raw.at : `${date}T12:00:00.000Z`,
    amount: value,
    source: src,
  };
  const usd = finite(raw.amountUsd);
  if (usd !== undefined && usd > 0) txn.amountUsd = Math.round(usd * 100) / 100;
  const name = text(raw.name, 80);
  if (name) txn.name = name;
  if ((EXPENSE_CATEGORY_IDS as readonly string[]).includes(raw.category as string) && kind === "expense") txn.category = raw.category as ExpenseCategoryId;
  const note = text(raw.note, 200);
  if (note) txn.note = note;
  if (typeof raw.accountId === "string" && raw.accountId) txn.accountId = raw.accountId;
  const accountUsd = finite(raw.accountUsd);
  if (txn.accountId && accountUsd !== undefined) txn.accountUsd = Math.round(accountUsd * 100) / 100;
  if (raw.auto === true) txn.auto = true;
  if (raw.legacy === true) txn.legacy = true;
  if (correction) txn.correction = true;
  const original = finite(raw.originalAmount);
  if (original !== undefined) txn.originalAmount = Math.round(original);
  if (typeof raw.editedAt === "string" && !Number.isNaN(Date.parse(raw.editedAt))) txn.editedAt = raw.editedAt;
  return txn;
}

/** Tolerant read of one month table (bad rows dropped, duplicate ids keep the first). */
export function sanitizeLedgerMonth(raw: unknown): LedgerMonth {
  if (!isRecord(raw) || !Array.isArray(raw.txns)) return { txns: [] };
  const seen = new Set<string>();
  const txns: LedgerTxn[] = [];
  for (const r of raw.txns) {
    const t = sanitizeTxn(r);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    txns.push(t);
  }
  const dismissed = Array.isArray(raw.dismissed) ? [...new Set(raw.dismissed.filter((d): d is string => typeof d === "string" && d.length > 0))] : [];
  return dismissed.length ? { txns, dismissed } : { txns };
}
