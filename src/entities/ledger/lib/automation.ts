import type { Debt } from "@/entities/debt";
import { linkedDebt, plannedForMonth } from "@/entities/expense/lib/amounts";
import { dueDatesInMonth, isActiveInMonth } from "@/entities/expense/lib/schedule";
import type { ExpenseItem, ExpenseLogDoc } from "@/entities/expense/model";
import type { IncomeSource } from "@/entities/income/model";
import { addMonths, dayInMonthIso, daysInMonth } from "@/shared/lib/month";

import type { LedgerTxn } from "../model";

/** Ledger ids for automatic entries: one per bill due date, one per income month. */
export const autoBillId = (itemId: string, date: string) => `auto-bill-${itemId}-${date}`;
export const autoIncomeId = (sourceId: string, month: string) => `auto-inc-${sourceId}-${month}`;

/** Months from `from` to `to` inclusive (`YYYY-MM`), capped so a bad date can't loop for ever. */
function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 240; m = addMonths(m, 1)) out.push(m);
  return out;
}

/**
 * What the schedule should have recorded by `today` and hasn't: autopay bills
 * on each due date (from the item's `autoSince`), income set to arrive by
 * itself on its payment day (from the source's `autoSince`). An occurrence
 * already paid by hand, skipped, or removed by hand (`isDismissed`) is left
 * alone. Pure; ids are deterministic so two devices agree.
 */
export function planAutomaticTxns(input: {
  items: readonly ExpenseItem[];
  sources: readonly IncomeSource[];
  /** The plan log (for skipped months). */
  log: ExpenseLogDoc;
  txns: readonly LedgerTxn[];
  isDismissed: (id: string) => boolean;
  debts: readonly Debt[];
  today: string;
  /** Recorded-at stamp for new entries (ISO). */
  now: string;
}): LedgerTxn[] {
  const { today, now } = input;
  const thisMonth = today.slice(0, 7);
  const ids = new Set(input.txns.map((t) => t.id));
  const out: LedgerTxn[] = [];
  const add = (t: LedgerTxn) => {
    ids.add(t.id);
    out.push(t);
  };

  // Payments already recorded per bill and month (by hand or automatically).
  const billCount = new Map<string, number>();
  const incomeMonths = new Set<string>();
  for (const t of input.txns) {
    if (t.source.type === "bill") billCount.set(`${t.source.itemId}:${t.source.month}`, (billCount.get(`${t.source.itemId}:${t.source.month}`) ?? 0) + 1);
    if (t.source.type === "income") incomeMonths.add(`${t.source.sourceId}:${t.source.month}`);
  }

  for (const item of input.items) {
    if (item.kind !== "bill" || !item.autopay || !item.autoSince || item.paused) continue;
    const debt = linkedDebt(item, input.debts);
    for (const month of monthRange(item.autoSince.slice(0, 7), thisMonth)) {
      if (!isActiveInMonth(item, month) || input.log.months[month]?.[item.id]?.skipped) continue;
      let dates = dueDatesInMonth(item, month, debt);
      // No due day: settled once the month is over, on its last day.
      if (!dates.length) dates = month < thisMonth ? [dayInMonthIso(month, daysInMonth(month))] : [];
      const planned = plannedForMonth(item, month, debt);
      const per = Math.round(planned / Math.max(1, dates.length));
      if (per <= 0) continue;
      dates.forEach((date, k) => {
        if (date < item.autoSince! || date > today) return;
        if (item.archivedAt && date > item.archivedAt) return;
        const id = autoBillId(item.id, date);
        const key = `${item.id}:${month}`;
        if (ids.has(id) || input.isDismissed(id) || (billCount.get(key) ?? 0) > k) return;
        billCount.set(key, (billCount.get(key) ?? 0) + 1);
        add({
          id,
          kind: "expense",
          date,
          at: now,
          amount: per,
          // Charged in dollars: each occurrence is the item's dollar amount.
          ...(item.amountUsd && !debt ? { amountUsd: item.amountUsd } : {}),
          source: { type: "bill", itemId: item.id, month },
          ...(item.accountId ? { accountId: item.accountId } : {}),
          auto: true,
        });
      });
    }
  }

  for (const s of input.sources) {
    if (!s.autoReceive || !s.autoSince || !s.paymentDay || !(s.monthly > 0)) continue;
    for (const month of monthRange(s.autoSince.slice(0, 7), thisMonth)) {
      const date = dayInMonthIso(month, Math.min(s.paymentDay, daysInMonth(month)));
      if (date < s.autoSince || date > today) continue;
      const id = autoIncomeId(s.id, month);
      if (ids.has(id) || input.isDismissed(id) || incomeMonths.has(`${s.id}:${month}`)) continue;
      incomeMonths.add(`${s.id}:${month}`);
      add({
        id,
        kind: "income",
        date,
        at: now,
        amount: Math.round(s.monthly),
        ...(s.amountUsd ? { amountUsd: s.amountUsd } : {}),
        source: { type: "income", sourceId: s.id, month },
        ...(s.accountId ? { accountId: s.accountId } : {}),
        auto: true,
      });
    }
  }
  return out;
}
