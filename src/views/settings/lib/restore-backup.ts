import { sanitizeExpenseLog, sanitizeExpensesDoc } from "@/entities/expense";
import { sanitizeLedgerMonth } from "@/entities/ledger/lib/sanitize";
import { flushTablesNow, readTable, writeTable } from "@/shared/storage/store";
import { isLedgerKey, TABLE_KEYS, type StoredKey, type TableKey } from "@/shared/storage/table-keys";

import { TABLE_SEEDS } from "./table-seeds";

/** Biggest backup file accepted (real ones are a few hundred KB). */
export const MAX_BACKUP_CHARS = 5_000_000;
/** Same cap the server enforces per table. */
const MAX_TABLE_CHARS = 1_000_000;

/** The monthly ledger tables count as one entry ("ledger") in the summary. */
export type BackupPart = TableKey | "ledger";

export type BackupSummary = {
  exportedAt: string | null;
  /** Tables in the file with how many records each holds. */
  tables: { key: BackupPart; count: number }[];
  /** Tables the file doesn't have: left as they are on restore. */
  missing: BackupPart[];
};

export type ParsedBackup =
  | { ok: true; tables: Partial<Record<StoredKey, unknown>>; summary: BackupSummary }
  | { ok: false; code: "invalid_json" | "not_backup" | "too_large" | "invalid_table"; table?: TableKey };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Rows with a string id (anything else is dropped). */
function rows(v: unknown): Record<string, unknown>[] | null {
  return Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => isRecord(r) && typeof r.id === "string" && r.id.length > 0) : null;
}

/** Check one table's shape; `null` when it isn't what that table holds. Values are kept as stored (the app reads them tolerantly). */
function validate(key: TableKey, value: unknown, today: string): { value: unknown; count: number } | null {
  switch (key) {
    case "debts":
    case "settingsAssets":
    case "incomeSources":
    case "personalLoans": {
      const list = rows(value);
      return list ? { value: list, count: list.length } : null;
    }
    case "assets": {
      if (!isRecord(value)) return null;
      const re = rows(value.realEstate) ?? [];
      const cash = rows(value.cashAccounts) ?? [];
      const inv = rows(value.investments) ?? [];
      return { value: { realEstate: re, cashAccounts: cash, investments: inv }, count: re.length + cash.length + inv.length };
    }
    case "goals": {
      if (!isRecord(value)) return null;
      const profiles = rows(value.profiles);
      if (!profiles) return null;
      const primary = isRecord(value.primary) ? value.primary : { name: "", targetAmount: 0, saved: 0 };
      const activeProfileId = typeof value.activeProfileId === "string" ? value.activeProfileId : (profiles[0]?.id ?? "");
      return { value: { primary, profiles, activeProfileId }, count: profiles.length };
    }
    case "preferences":
      return isRecord(value) ? { value, count: 1 } : null;
    case "expenses": {
      if (!isRecord(value) || !Array.isArray(value.items)) return null;
      const doc = sanitizeExpensesDoc(value, today);
      return { value: doc, count: doc.items.length };
    }
    case "expenseLog": {
      if (!isRecord(value) || !isRecord(value.months)) return null;
      const log = sanitizeExpenseLog(value);
      return { value: log, count: Object.keys(log.months).length };
    }
  }
}

/**
 * Read a backup file made by "Export JSON" (`{ exportedAt, tables }`).
 * Every table in it is checked; tables it doesn't have are reported so the
 * restore can leave them alone (an older backup must never wipe newer data).
 */
export function parseBackup(text: string, today: string): ParsedBackup {
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, code: "too_large" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, code: "invalid_json" };
  }
  if (!isRecord(raw) || !isRecord(raw.tables)) return { ok: false, code: "not_backup" };
  const source = raw.tables;
  const tables: Partial<Record<StoredKey, unknown>> = {};
  const summary: BackupSummary = { exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : null, tables: [], missing: [] };
  for (const key of TABLE_KEYS) {
    if (!(key in source) || source[key] === undefined || source[key] === null) {
      summary.missing.push(key);
      continue;
    }
    const checked = validate(key, source[key], today);
    if (!checked) return { ok: false, code: "invalid_table", table: key };
    if (JSON.stringify(checked.value).length > MAX_TABLE_CHARS) return { ok: false, code: "too_large", table: key };
    tables[key] = checked.value;
    summary.tables.push({ key, count: checked.count });
  }
  // Money in and out, one table per month.
  let ledgerCount = 0;
  let ledgerMonths = 0;
  for (const key of Object.keys(source).filter(isLedgerKey).sort()) {
    const value = source[key];
    if (!isRecord(value) || !Array.isArray(value.txns)) return { ok: false, code: "invalid_table" };
    const month = sanitizeLedgerMonth(value);
    if (JSON.stringify(month).length > MAX_TABLE_CHARS) return { ok: false, code: "too_large" };
    tables[key] = month;
    ledgerCount += month.txns.length;
    ledgerMonths += 1;
  }
  if (ledgerMonths) summary.tables.push({ key: "ledger", count: ledgerCount });
  else summary.missing.push("ledger");
  if (summary.tables.length === 0) return { ok: false, code: "not_backup" };
  return { ok: true, tables, summary };
}

/**
 * Replace the tables found in the backup (others stay as they are) and push
 * them to the server. Returns the previous values, for undo.
 */
export async function applyBackup(tables: Partial<Record<StoredKey, unknown>>): Promise<{ previous: Partial<Record<StoredKey, unknown>>; synced: boolean }> {
  const previous: Partial<Record<StoredKey, unknown>> = {};
  for (const key of Object.keys(tables) as StoredKey[]) {
    previous[key] = readTable(key, isLedgerKey(key) ? { txns: [] } : TABLE_SEEDS[key as TableKey]);
    writeTable(key, tables[key]);
  }
  const synced = await flushTablesNow();
  return { previous, synced };
}
