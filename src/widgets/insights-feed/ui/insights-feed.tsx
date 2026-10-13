"use client";

import { ChevronRight, CircleAlert, Lightbulb, Sparkles, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { Insight, InsightSeverity } from "@/entities/portfolio";
import { useI18n, type Messages } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatMoneyCompact, formatNumber, formatPercent } from "@/shared/lib/format";
import { Button } from "@/shared/ui/kit/button";
import { HelpHint } from "@/shared/ui/help-hint";
import { IconTile } from "@/shared/ui/icon-tile";
import { Card } from "@/shared/ui/kit/card";

const LOOK: Record<InsightSeverity, { icon: LucideIcon; tile: string }> = {
  critical: { icon: CircleAlert, tile: "bg-danger-muted text-danger" },
  warning: { icon: TriangleAlert, tile: "bg-warning-muted text-warning" },
  info: { icon: Lightbulb, tile: "bg-info-muted text-info" },
  positive: { icon: Sparkles, tile: "bg-success-muted text-success" },
};

function months(t: Messages, value: number): string {
  return t.home.health.months({ value: formatNumber(value, { maximumFractionDigits: 1 }) });
}

/** One sentence per insight, in the page's language. */
export function insightText(t: Messages, i: Insight): string {
  const m = t.insights;
  const money = (n: number) => formatMoneyCompact(n);
  switch (i.code) {
    case "bills_overdue":
      return m.bills_overdue({ count: i.count, total: money(i.total) });
    case "bills_due_week":
      return m.bills_due_week({
        name: i.nextName,
        when: i.days <= 0 ? m.when.today : i.days === 1 ? m.when.tomorrow : m.when.inDays({ count: i.days }),
        more: i.count > 1 ? m.more({ count: i.count - 1 }) : "",
      });
    case "negative_net":
      return m.negative_net({ amount: money(-i.monthlyNet) });
    case "emergency_low":
      return m.emergency_low({ months: months(t, i.months) });
    case "emergency_ok":
      return m.emergency_ok({ months: months(t, i.months) });
    case "costly_debt_first":
      return m.costly_debt_first({ name: i.debtName, rate: formatPercent(i.ratePct), interest: money(i.monthlyInterest) });
    case "budget_over":
      return m.budget_over({ name: i.name, amount: money(i.over) });
    case "plan_drift":
      return m.plan_drift({ amount: money(i.averageActual - i.averagePlanned) });
    case "goal_off_track":
      return m.goal_off_track({ name: i.name, amount: money(i.extraNeeded) });
    case "shares_over_allocated":
      return m.shares_over_allocated;
    case "unlinked_debt_payment":
      return m.unlinked_debt_payment({ count: i.count, amount: money(i.total) });
    case "unitemized_estimate":
      return m.unitemized_estimate({ amount: money(i.amount) });
    case "yearly_bill_ahead":
      return m.yearly_bill_ahead({ name: i.name, amount: money(i.amount), date: formatDate(i.date, "dayMonth"), perMonth: money(i.perMonth) });
    case "assets_stale":
      return m.assets_stale({ count: i.count });
    case "savings_rate_good":
      return m.savings_rate_good({ pct: formatPercent(i.pct, { maximumFractionDigits: 0 }) });
  }
}

/** The overview's "worth a look" list: each nudge links to where you'd act on it. */
export function InsightsFeed({ insights, limit = 4, className }: { insights: Insight[]; limit?: number; className?: string }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const shown = all ? insights : insights.slice(0, limit);
  return (
    <Card className={cn("gap-0 py-0", className)} data-help="insights">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
        <div className="flex items-center gap-1">
          <IconTile icon={Sparkles} tone="violet" size="sm" className="mr-1.5" />
          <h2 className="text-base font-semibold">{t.insights.title}</h2>
          <HelpHint topic="insights" />
        </div>
      </div>
      {insights.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{t.insights.empty}</p>
      ) : (
        <ul className="divide-y">
          {shown.map((i) => {
            const look = LOOK[i.severity];
            return (
              <li key={i.id}>
                <Link href={i.href} className="flex items-start gap-3 px-5 py-3 transition-colors outline-none hover:bg-accent/40 focus-visible:bg-accent/40">
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", look.tile)} aria-hidden>
                    <look.icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug" data-private>
                    {insightText(t, i)}
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {insights.length > limit ? (
        <div className="mt-auto border-t px-3 py-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setAll((v) => !v)}>
            {all ? t.insights.showLess : t.insights.viewAll({ count: insights.length })}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
