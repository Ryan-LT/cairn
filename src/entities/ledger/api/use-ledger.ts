"use client";

import { useCallback, useMemo } from "react";

import { LEDGER_PREFIX, readTableFamily, useTableFamily, writeTable } from "@/shared/storage";

import type { LedgerMonth, LedgerTxn } from "../model";
import { addTxns, allTxns, putTxn, removeTxns, restoreTxns, type LedgerTables, type LedgerWrites } from "../lib/ops";
import { sanitizeLedgerMonth } from "../lib/sanitize";

/** Sanitized month per stored value, so unchanged months aren't re-read. */
const sanitized = new WeakMap<object, LedgerMonth>();

function toTables(raw: Record<string, unknown>): LedgerTables {
  const out: LedgerTables = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === "object") {
      let m = sanitized.get(value);
      if (!m) sanitized.set(value, (m = sanitizeLedgerMonth(value)));
      out[key] = m;
    } else {
      out[key] = sanitizeLedgerMonth(value);
    }
  }
  return out;
}

/** The ledger as it is right now (for operations, which must not use a stale render's copy). */
export function currentLedger(): LedgerTables {
  return toTables(readTableFamily(LEDGER_PREFIX));
}

/** Write changed month tables (each saves on its own; the debounce sends them together). */
export function writeLedger(writes: LedgerWrites): void {
  for (const [key, month] of Object.entries(writes)) writeTable(key, month);
}

/**
 * Every transaction (newest first) and the operations on them. Operations
 * read the latest ledger at call time.
 */
export function useLedger() {
  const raw = useTableFamily(LEDGER_PREFIX);
  const tables = useMemo(() => toTables(raw), [raw]);
  const txns = useMemo(() => allTxns(tables), [tables]);

  const add = useCallback((list: LedgerTxn | readonly LedgerTxn[]) => writeLedger(addTxns(currentLedger(), Array.isArray(list) ? list : [list as LedgerTxn])), []);
  const put = useCallback((txn: LedgerTxn) => writeLedger(putTxn(currentLedger(), txn)), []);
  const remove = useCallback((ids: readonly string[]) => writeLedger(removeTxns(currentLedger(), ids, { dismiss: true })), []);
  const restore = useCallback((list: readonly LedgerTxn[]) => writeLedger(restoreTxns(currentLedger(), list)), []);

  return { tables, txns, add, put, remove, restore };
}
