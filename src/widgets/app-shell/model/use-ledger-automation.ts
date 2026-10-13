"use client";

import { useEffect, useState } from "react";

import { DEBTS_SEED } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { useIncomeSources } from "@/entities/income";
import { accountUsdFor, addTxns, allTxns, currentLedger, isDismissed, planAutomaticTxns, planLegacyMigration, useLedger, writeLedger } from "@/entities/ledger";
import { useSettingsAssets } from "@/entities/settings-asset";
import { onAppForeground } from "@/shared/lib/app-foreground";
import { useCurrency } from "@/shared/lib/currency/provider";
import { todayIso } from "@/shared/lib/date";
import { useInitialLoadDone, useTable } from "@/shared/storage";

/**
 * Keeps the ledger current from any page, once real data has loaded:
 * 1. carries over what the old month log recorded (once, idempotent);
 * 2. gives autopay bills from before the ledger a start date (this month);
 * 3. records autopay bills and automatic income that have come due.
 * Each step writes only when there is something to do, so it settles.
 */
export function useLedgerAutomation(): void {
  const loaded = useInitialLoadDone();
  const { expenses, storedLog, updateLog, updateExpenses } = useExpenses();
  const [sources] = useIncomeSources();
  const [debts] = useTable("debts", DEBTS_SEED);
  const [, , , storedAssets] = useSettingsAssets();
  const rate = useCurrency()?.rates.vndPerUsd ?? null;
  const { txns } = useLedger();
  const [today, setToday] = useState(todayIso);

  // A new day while the app stays open (or comes back): check the schedule again.
  useEffect(() => onAppForeground(() => setToday(todayIso())), []);

  useEffect(() => {
    if (!loaded) return;
    // 1. Carry the old log over, from the latest stored copy.
    if (planLegacyMigration(storedLog, currentLedger(), today)) {
      updateLog((log) => {
        const plan = planLegacyMigration(log, currentLedger(), today);
        if (!plan) return log;
        writeLedger(plan.writes);
        return plan.log;
      });
      return;
    }
    // 2. Autopay bills from before the ledger start recording this month.
    if (expenses.items.some((i) => i.kind === "bill" && i.autopay && !i.autoSince)) {
      const start = `${today.slice(0, 7)}-01`;
      updateExpenses((doc) => ({ ...doc, items: doc.items.map((i) => (i.kind === "bill" && i.autopay && !i.autoSince ? { ...i, autoSince: start } : i)) }));
      return;
    }
    // 3. What the schedule says is due by today.
    const tables = currentLedger();
    const due = planAutomaticTxns({
      items: expenses.items,
      sources,
      log: storedLog,
      txns: allTxns(tables),
      isDismissed: (id) => isDismissed(tables, id),
      debts,
      today,
      now: new Date().toISOString(),
    });
    if (!due.length) return;
    const byId = new Map(storedAssets.map((a) => [a.id, a]));
    writeLedger(
      addTxns(
        tables,
        due.map((t) => {
          const accountUsd = t.accountId ? accountUsdFor(byId.get(t.accountId), t.amount, t.amountUsd, rate) : undefined;
          return accountUsd !== undefined ? { ...t, accountUsd } : t;
        }),
      ),
    );
  }, [loaded, today, storedLog, expenses.items, sources, debts, storedAssets, rate, txns, updateLog, updateExpenses]);
}
