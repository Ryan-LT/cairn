import type { ExpenseLogDoc, ExpenseMonthEntry } from "@/entities/expense/model";
import { dayInMonthIso, daysInMonth, isMonthKey } from "@/shared/lib/month";

import type { LedgerTxn } from "../model";
import { addTxns, findTxn, isDismissed, type LedgerTables, type LedgerWrites } from "./ops";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Move what the old month log recorded (bill payments, budget totals) into the
 * ledger, then strip it from the log (skips and planned amounts stay there).
 * Ids come from the content, so running it again — on another device, or after
 * an older app version wrote the log again — never duplicates anything, and an
 * entry removed by hand stays removed. `null` when there's nothing to move.
 */
export function planLegacyMigration(log: ExpenseLogDoc, tables: LedgerTables, today: string): { writes: LedgerWrites; log: ExpenseLogDoc } | null {
  const txns: LedgerTxn[] = [];
  let touched = false;
  const months: ExpenseLogDoc["months"] = {};
  for (const month of Object.keys(log.months).sort()) {
    const entries = log.months[month];
    const out: Record<string, ExpenseMonthEntry> = {};
    for (const itemId of Object.keys(entries).sort()) {
      const e = entries[itemId];
      const rest: ExpenseMonthEntry = {};
      if (e.skipped) rest.skipped = true;
      if (typeof e.planned === "number") rest.planned = e.planned;
      if (isMonthKey(month) && (e.payments?.length || (e.spent ?? 0) > 0)) {
        touched = true;
        const seen = new Map<string, number>();
        for (const p of e.payments ?? []) {
          if (!(p.amount > 0)) continue;
          const date = typeof p.date === "string" && ISO_DAY.test(p.date) ? p.date : dayInMonthIso(month, daysInMonth(month));
          const sig = `${date}-${Math.round(p.amount)}`;
          const n = (seen.get(sig) ?? 0) + 1;
          seen.set(sig, n);
          const id = `mig-${month}-${itemId}-${sig}-${n}`;
          if (findTxn(tables, id) || isDismissed(tables, id)) continue;
          txns.push({ id, kind: "expense", date, at: `${date}T12:00:00.000Z`, amount: Math.round(p.amount), source: { type: "bill", itemId, month }, legacy: true });
        }
        if ((e.spent ?? 0) > 0) {
          const id = `mig-${month}-${itemId}-spent`;
          // The month's total, dated today in the current month, else on its last day.
          const date = today.slice(0, 7) === month ? today : dayInMonthIso(month, daysInMonth(month));
          if (!findTxn(tables, id) && !isDismissed(tables, id)) {
            txns.push({ id, kind: "expense", date, at: `${date}T12:00:00.000Z`, amount: Math.round(e.spent!), source: { type: "budget", itemId, month }, legacy: true });
          }
        }
      }
      if (rest.skipped || rest.planned !== undefined) out[itemId] = rest;
    }
    if (Object.keys(out).length) months[month] = out;
  }
  if (!touched) return null;
  return { writes: addTxns(tables, txns), log: { months } };
}
