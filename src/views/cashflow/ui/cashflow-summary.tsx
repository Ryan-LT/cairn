"use client";

import { ArrowDownLeft, ArrowUpRight, PiggyBank, TriangleAlert } from "lucide-react";

import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import { useI18n } from "@/shared/i18n";
import { formatPercent } from "@/shared/lib/format";
import { AnimatedMoney } from "@/shared/ui/animated-money";
import { SummaryStrip } from "@/shared/ui/summary-strip";

/** Money in − money out = what's left, above the Cash flow tabs. */
export function CashflowHubSummary() {
  const { t } = useI18n();
  const s = t.cashflow.summary;
  const cash = useHouseholdCashflow();
  const rate = cash.totalIncome > 0 ? (cash.monthlyNet / cash.totalIncome) * 100 : null;
  const over = cash.monthlyNet < 0;
  return (
    <SummaryStrip
      items={[
        { key: "in", help: "cashIn", icon: ArrowDownLeft, tone: "text-success", label: s.moneyIn, value: <AnimatedMoney value={cash.totalIncome} id="cashflow-in" />, sub: s.perMonth },
        { key: "out", help: "cashOut", icon: ArrowUpRight, tone: "text-danger", label: s.moneyOut, value: <AnimatedMoney value={cash.averageSpending} id="cashflow-out" />, sub: s.perMonth },
        {
          key: "left",
          help: "cashLeft",
          icon: over ? TriangleAlert : PiggyBank,
          tone: over ? "text-danger" : "text-primary",
          label: s.left,
          value: <AnimatedMoney value={cash.monthlyNet} id="cashflow-left" signed tone="auto" />,
          sub: over ? s.overspending : rate === null ? s.noIncome : s.savingsRate({ pct: formatPercent(rate, { maximumFractionDigits: 0 }) }),
        },
      ]}
    />
  );
}
