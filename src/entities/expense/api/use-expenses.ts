"use client";

import { useCallback, useMemo } from "react";

import { useCurrency } from "@/shared/lib/currency/provider";
import { todayIso } from "@/shared/lib/date";
import { useTable } from "@/shared/storage";

import { EXPENSE_LOG_SEED, EXPENSES_SEED, type ExpenseLogDoc, type ExpensesDoc } from "../model";
import { sanitizeExpenseLog, sanitizeExpensesDoc } from "../lib/sanitize";
import { resolveExpenseValues } from "../lib/valuation";

/**
 * The bill / budget list and the monthly check-off log, read tolerantly.
 * Updates take a function of the current (sanitized) document.
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
  const log = useMemo(() => sanitizeExpenseLog(rawLog), [rawLog]);

  const updateExpenses = useCallback(
    (fn: (doc: ExpensesDoc) => ExpensesDoc) => setExpenses((prev: unknown) => fn(sanitizeExpensesDoc(prev, todayIso()))),
    [setExpenses],
  );
  const updateLog = useCallback(
    (fn: (doc: ExpenseLogDoc) => ExpenseLogDoc) => setLog((prev: unknown) => fn(sanitizeExpenseLog(prev))),
    [setLog],
  );

  return { expenses, log, updateExpenses, updateLog };
}
