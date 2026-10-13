"use client";

import { ArrowDownLeft, ArrowUpRight, PiggyBank, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatPercent } from "@/shared/lib/format";
import { Card } from "@/shared/ui/kit/card";
import { Money } from "@/shared/ui/money";

function Figure({ icon: Icon, tone, label, value, sub }: { icon: LucideIcon; tone: string; label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1 px-3 first:pl-4 last:pr-4 md:px-5 md:first:pl-5 md:last:pr-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground md:text-sm">
        <Icon className={cn("size-3.5 shrink-0 md:size-4", tone)} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <p className="truncate text-lg font-semibold tracking-tight md:text-2xl">{value}</p>
      {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Money in − money out = what's left, above the Cash flow tabs. */
export function CashflowHubSummary() {
  const { t } = useI18n();
  const s = t.cashflow.summary;
  const cash = useHouseholdCashflow();
  const rate = cash.totalIncome > 0 ? (cash.monthlyNet / cash.totalIncome) * 100 : null;
  const over = cash.monthlyNet < 0;
  return (
    <Card className="grid grid-cols-3 gap-0 divide-x py-4">
      <Figure icon={ArrowDownLeft} tone="text-success" label={s.moneyIn} value={<Money value={cash.totalIncome} compact />} sub={s.perMonth} />
      <Figure icon={ArrowUpRight} tone="text-danger" label={s.moneyOut} value={<Money value={cash.averageSpending} compact />} sub={s.perMonth} />
      <Figure
        icon={over ? TriangleAlert : PiggyBank}
        tone={over ? "text-danger" : "text-primary"}
        label={s.left}
        value={<Money value={cash.monthlyNet} compact signed tone="auto" />}
        sub={over ? s.overspending : rate === null ? s.noIncome : s.savingsRate({ pct: formatPercent(rate, { maximumFractionDigits: 0 }) })}
      />
    </Card>
  );
}
