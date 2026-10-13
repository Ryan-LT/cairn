import type { BillPayment, ExpenseLogDoc, ExpenseMonthEntry } from "@/entities/expense/model";

import type { LedgerTxn } from "../model";

type Recorded = { payments: (BillPayment & { at: string })[]; spent: number; hasBudget: boolean };

/**
 * The month log the plan views read, with what was actually paid and spent
 * taken from the ledger: a bill's payments and a budget's spending in a month
 * are its ledger entries for that month. Months or items the ledger has
 * nothing for keep what the old log says (not carried over yet). Spending
 * outside the plan is summed per month into `unplanned`.
 */
export function mergeLedgerIntoLog(log: ExpenseLogDoc, txns: readonly LedgerTxn[]): ExpenseLogDoc {
  const recorded = new Map<string, Map<string, Recorded>>();
  const unplanned: Record<string, number> = {};
  for (const t of txns) {
    if (t.kind !== "expense") continue;
    if (t.source.type === "instant") {
      const month = t.date.slice(0, 7);
      unplanned[month] = (unplanned[month] ?? 0) + t.amount;
      continue;
    }
    if (t.source.type !== "bill" && t.source.type !== "budget") continue;
    const { month, itemId } = t.source;
    let items = recorded.get(month);
    if (!items) recorded.set(month, (items = new Map()));
    let r = items.get(itemId);
    if (!r) items.set(itemId, (r = { payments: [], spent: 0, hasBudget: false }));
    if (t.source.type === "bill") r.payments.push({ amount: t.amount, date: t.date, txnId: t.id, at: t.at, ...(t.auto ? { auto: true } : {}) });
    else {
      r.spent += t.amount;
      r.hasBudget = true;
    }
  }

  if (recorded.size === 0 && Object.keys(unplanned).length === 0) return log;
  const months: ExpenseLogDoc["months"] = {};
  const keys = new Set([...Object.keys(log.months), ...recorded.keys()]);
  for (const month of [...keys].sort()) {
    const stored = log.months[month] ?? {};
    const fromLedger = recorded.get(month);
    const out: Record<string, ExpenseMonthEntry> = {};
    for (const itemId of new Set([...Object.keys(stored), ...(fromLedger?.keys() ?? [])])) {
      const entry: ExpenseMonthEntry = { ...stored[itemId] };
      const r = fromLedger?.get(itemId);
      if (r?.payments.length) {
        entry.payments = r.payments
          // Oldest first; same moment: by id, so the order is the same everywhere.
          .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.at !== b.at ? (a.at < b.at ? -1 : 1) : (a.txnId ?? "") < (b.txnId ?? "") ? -1 : 1))
          .map(({ at: _at, ...p }) => {
            void _at;
            return p;
          });
      }
      if (r?.hasBudget) entry.spent = Math.max(0, r.spent);
      out[itemId] = entry;
    }
    months[month] = out;
  }
  return { months, ...(Object.keys(unplanned).length ? { unplanned } : {}) };
}
