import { ledgerKey, type LedgerKey } from "@/shared/storage/table-keys";

import type { LedgerMonth, LedgerTxn } from "../model";

/** Sanitized month tables keyed `ledger:YYYY-MM`. */
export type LedgerTables = Record<string, LedgerMonth>;
/** Month tables an operation changed, to write back. */
export type LedgerWrites = Record<LedgerKey, LedgerMonth>;

export function shardOf(date: string): LedgerKey {
  return ledgerKey(date.slice(0, 7));
}

export function newTxnId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `txn-${Date.now().toString(36)}-${random}`;
}

/** Newest first: by date, then when recorded, then id (stable). */
export function compareTxnsDesc(a: LedgerTxn, b: LedgerTxn): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.at !== b.at) return a.at < b.at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Every transaction, newest first. */
export function allTxns(tables: LedgerTables): LedgerTxn[] {
  return Object.values(tables)
    .flatMap((m) => m.txns)
    .sort(compareTxnsDesc);
}

export function findTxn(tables: LedgerTables, id: string): { key: LedgerKey; txn: LedgerTxn } | null {
  for (const [key, month] of Object.entries(tables)) {
    const txn = month.txns.find((t) => t.id === id);
    if (txn) return { key: key as LedgerKey, txn };
  }
  return null;
}

export function isDismissed(tables: LedgerTables, id: string): boolean {
  return Object.values(tables).some((m) => m.dismissed?.includes(id));
}

/** Apply writes to tables (for chaining operations). */
export function applyWrites(tables: LedgerTables, writes: LedgerWrites): LedgerTables {
  return { ...tables, ...writes };
}

function monthOf(tables: LedgerTables, writes: LedgerWrites, key: LedgerKey): LedgerMonth {
  return writes[key] ?? tables[key] ?? { txns: [] };
}

/** Add transactions whose id isn't in the ledger yet (ids already there are left alone). */
export function addTxns(tables: LedgerTables, txns: readonly LedgerTxn[]): LedgerWrites {
  const writes: LedgerWrites = {};
  const known = new Set(Object.values(tables).flatMap((m) => m.txns.map((t) => t.id)));
  for (const t of txns) {
    if (known.has(t.id)) continue;
    known.add(t.id);
    const key = shardOf(t.date);
    const m = monthOf(tables, writes, key);
    writes[key] = { ...m, txns: [...m.txns, t] };
  }
  return writes;
}

/** Insert or replace one transaction; a new date in another month moves it there. */
export function putTxn(tables: LedgerTables, txn: LedgerTxn): LedgerWrites {
  const writes: LedgerWrites = {};
  const found = findTxn(tables, txn.id);
  const key = shardOf(txn.date);
  if (found && found.key !== key) {
    const from = monthOf(tables, writes, found.key);
    writes[found.key] = { ...from, txns: from.txns.filter((t) => t.id !== txn.id) };
  }
  const m = monthOf(tables, writes, key);
  const exists = m.txns.some((t) => t.id === txn.id);
  writes[key] = { ...m, txns: exists ? m.txns.map((t) => (t.id === txn.id ? txn : t)) : [...m.txns, txn] };
  return writes;
}

/**
 * Remove transactions. `dismiss`: also remember the ids so the schedule, the
 * carry-over or the bank inbox never recreates them (automatic, carried and webhook entries).
 */
export function removeTxns(tables: LedgerTables, ids: readonly string[], opts: { dismiss?: boolean } = {}): LedgerWrites {
  const writes: LedgerWrites = {};
  const drop = new Set(ids);
  for (const [k, month] of Object.entries(tables)) {
    const key = k as LedgerKey;
    const removed = month.txns.filter((t) => drop.has(t.id));
    if (!removed.length) continue;
    const m = monthOf(tables, writes, key);
    const dismissed = opts.dismiss ? [...new Set([...(m.dismissed ?? []), ...removed.filter((t) => t.auto || t.legacy || t.via).map((t) => t.id)])] : m.dismissed;
    writes[key] = { txns: m.txns.filter((t) => !drop.has(t.id)), ...(dismissed?.length ? { dismissed } : {}) };
  }
  return writes;
}

/** Undo of {@link removeTxns}: put the transactions back and forget their dismissal. */
export function restoreTxns(tables: LedgerTables, txns: readonly LedgerTxn[]): LedgerWrites {
  const writes: LedgerWrites = {};
  const ids = new Set(txns.map((t) => t.id));
  for (const [k, month] of Object.entries(tables)) {
    if (!month.dismissed?.some((d) => ids.has(d))) continue;
    const key = k as LedgerKey;
    const m = monthOf(tables, writes, key);
    const dismissed = (m.dismissed ?? []).filter((d) => !ids.has(d));
    writes[key] = { txns: m.txns, ...(dismissed.length ? { dismissed } : {}) };
  }
  return { ...writes, ...addTxns(applyWrites(tables, writes), txns) };
}
