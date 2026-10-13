"use client";

import { useMemo } from "react";

import { DEBTS_SEED } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { useIncomeSources } from "@/entities/income";
import { PREFERENCES_SEED } from "@/entities/preferences";
import { useTable } from "@/shared/storage";

import { summarizeCashflow } from "../lib/summary";

/** Income, spending and monthly net from the stored tables: the one cash-flow number every screen uses. */
export function useHouseholdCashflow() {
  const [prefs] = useTable("preferences", PREFERENCES_SEED);
  const [sources] = useIncomeSources();
  const [debts] = useTable("debts", DEBTS_SEED);
  const { expenses } = useExpenses();
  return useMemo(() => summarizeCashflow({ prefs, sources, expenses, debts }), [prefs, sources, expenses, debts]);
}
