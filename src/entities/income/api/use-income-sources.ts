"use client";

import { useMemo } from "react";

import { useCurrency } from "@/shared/lib/currency/provider";
import { useTable } from "@/shared/storage";

import { resolveIncomeValues } from "../lib/valuation";
import { INCOME_SOURCES_SEED, type IncomeSource } from "../model";

/** Income sources with today's VND amounts (USD salaries follow the live rate). */
export function useIncomeSources() {
  const [stored, setSources, loaded] = useTable<IncomeSource[]>("incomeSources", INCOME_SOURCES_SEED);
  const rates = useCurrency()?.rates;
  const sources = useMemo(() => (rates ? resolveIncomeValues(stored, rates) : stored), [stored, rates]);
  return [sources, setSources, loaded] as const;
}
