/**
 * Persisted table names for `useTable` / `/api/tables`.
 * Keep in sync with app usage; the API only accepts these keys.
 */
export const TABLE_KEYS = [
  "assets",
  "debts",
  "settingsAssets",
  "incomeSources",
  "goals",
  "preferences",
  "personalLoans",
  "expenses",
  "expenseLog",
] as const;

export type TableKey = (typeof TABLE_KEYS)[number];

export function isTableKey(key: string): key is TableKey {
  return (TABLE_KEYS as readonly string[]).includes(key);
}

/**
 * Money actually in and out, one table per calendar month (`ledger:2026-10`),
 * so a long history never makes any single save large.
 */
export type LedgerKey = `ledger:${string}`;
export const LEDGER_PREFIX = "ledger:";
const LEDGER_KEY = /^ledger:\d{4}-(0[1-9]|1[0-2])$/;

export function isLedgerKey(key: string): key is LedgerKey {
  return LEDGER_KEY.test(key);
}

export function ledgerKey(month: string): LedgerKey {
  return `${LEDGER_PREFIX}${month}` as LedgerKey;
}

/** Any key the store and the API accept: the fixed tables and the monthly ledger tables. */
export type StoredKey = TableKey | LedgerKey;

export function isStoredKey(key: string): key is StoredKey {
  return isTableKey(key) || isLedgerKey(key);
}
