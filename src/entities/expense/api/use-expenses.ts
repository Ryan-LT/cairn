"use client";

import { useCallback, useMemo } from "react";

import { mergeLedgerIntoLog } from "@/entities/ledger/lib/merge";
import { useLedger } from "@/entities/ledger/api/use-ledger";
import { useCurrency } from "@/shared/lib/currency/provider";
import { todayIso } from "@/shared/lib/date";
import { useTable } from "@/shared/storage";

import { EXPENSE_LOG_SEED, EXPENSES_SEED, type ExpenseLogDoc, type ExpensesDoc } from "../model";
import { sanitizeExpenseLog, sanitizeExpensesDoc } from "../lib/sanitize";
import { resolveExpenseValues } from "../lib/valuation";

/**
 * The bill / budget list and the monthly log, read tolerantly. `log` has the
 * payments and spending from the ledger merged in (what the views read);
 * `storedLog` is the stored plan log (skips, planned amounts). Updates take a
 * function of the current (sanitized, stored) document.
 */
export function useExpenses() {
  const [rawExpenses, setExpenses] = useTable<unknown>("expenses", EXPENSES_SEED);
  const [rawLog, setLog] = useTable<unknown>("expenseLog", EXPENSE_LOG_SEED);
  const rates = useCurrency()?.rates;
  // Items charged in USD show today's VND amount; writes keep the stored document's shape.
  const expenses = useMemo(() => {
    const doc = sanitizeExpensesDoc(rawExpenses, todayIso());
    return rates ? resolveExpenseValues(doc, rates) : doc;
  }, [rawExpenses, rates]);
  const storedLog = useMemo(() => sanitizeExpenseLog(rawLog), [rawLog]);
  // What was actually paid and spent comes from the ledger.
  const { txns } = useLedger();
  const log = useMemo(() => mergeLedgerIntoLog(storedLog, txns), [storedLog, txns]);

  const updateExpenses = useCallback(
    (fn: (doc: ExpensesDoc) => ExpensesDoc) => setExpenses((prev: unknown) => fn(sanitizeExpensesDoc(prev, todayIso()))),
    [setExpenses],
  );
  const updateLog = useCallback(
    (fn: (doc: ExpenseLogDoc) => ExpenseLogDoc) => setLog((prev: unknown) => fn(sanitizeExpenseLog(prev))),
    [setLog],
  );

  return { expenses, log, storedLog, updateExpenses, updateLog };
}
