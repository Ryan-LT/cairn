import { todayIso } from "@/shared/lib/date";
import { downloadText } from "@/shared/lib/download";
import { readTable, readTableFamily } from "@/shared/storage/store";
import { LEDGER_PREFIX, type StoredKey, type TableKey } from "@/shared/storage/table-keys";

import { TABLE_SEEDS as SEEDS } from "./table-seeds";

/** Same shape as `GET /api/tables`, so a backup can be restored with one PUT. */
export function buildBackup(): { exportedAt: string; tables: Partial<Record<StoredKey, unknown>> } {
  const tables: Partial<Record<StoredKey, unknown>> = {};
  for (const key of Object.keys(SEEDS) as TableKey[]) {
    tables[key] = readTable(key, SEEDS[key]);
  }
  // Every month of money in and out.
  Object.assign(tables, readTableFamily(LEDGER_PREFIX));
  return { exportedAt: new Date().toISOString(), tables };
}

export function downloadBackup(): void {
  downloadText(`cairn-backup-${todayIso()}.json`, JSON.stringify(buildBackup(), null, 2), "application/json");
}
