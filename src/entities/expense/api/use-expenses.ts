"use client";

import { useCallback, useMemo } from "react";

import { todayIso } from "@/shared/lib/date";
import { useTable } from "@/shared/storage";

import { EXPENSE_LOG_SEED, EXPENSES_SEED, type ExpenseLogDoc, type ExpensesDoc } from "../model";
import { sanitizeExpenseLog, sanitizeExpensesDoc } from "../lib/sanitize";

/**
 * The bill / budget list and the monthly check-off log, read tolerantly.
 * Updates take a function of the current (sanitized) document.
 */
export function useExpenses() {
  const [rawExpenses, setExpenses] = useTable<unknown>("expenses", EXPENSES_SEED);
  const [rawLog, setLog] = useTable<unknown>("expenseLog", EXPENSE_LOG_SEED);
  const expenses = useMemo(() => sanitizeExpensesDoc(rawExpenses, todayIso()), [rawExpenses]);
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
