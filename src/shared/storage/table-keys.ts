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
