"use client";

import { ArrowRight, ChevronRight, LifeBuoy, PiggyBank, Scale, Sunrise, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { BillLine, MonthView } from "@/entities/expense";
import type { GoalPlanWithStatus } from "@/entities/goal";
import { GoalStatusBadge } from "@/entities/goal/ui";
import type { CashflowSummary, FinancialHealth } from "@/entities/portfolio";
import type { NetWorthMonthSnapshot } from "@/entities/preferences";
import { buildNetWorthTrend } from "@/entities/preferences";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatMoneyCompact, formatNumber, formatPercent } from "@/shared/lib/format";
import type { StatusTone } from "@/shared/lib/tone";
import { AnimatedMoney } from "@/shared/ui/animated-money";
import { Sparkline } from "@/shared/ui/chart";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { Money } from "@/shared/ui/money";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { StatusBadge } from "@/shared/ui/status-badge";
import { BillRow, type RecordActions } from "@/widgets/bill-list";

function CardHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {href ? (
        <Link href={href} className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground" aria-label={linkLabel ?? title}>
          {linkLabel ? <span className="max-sm:hidden">{linkLabel}</span> : null}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

/** The headline: net worth, this month's change and a 12-month trend line. */
export function NetWorthHero({
  netWorth,
  grossAssets,
  liabilities,
  mtdPct,
  history,
  className,
}: {
  netWorth: number;
  grossAssets: number;
  liabilities: number;
  mtdPct: number;
  history: NetWorthMonthSnapshot[];
  className?: string;
}) {
  const { t } = useI18n();
  const h = t.home;
  const trend = buildNetWorthTrend(history, netWorth);
  const values = trend.map((p) => p.value);
  const change = values.length > 1 ? values[values.length - 1] - values[0] : 0;
  return (
    <Card className={cn("bg-hero gap-4 px-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{h.netWorth}</p>
        {Math.abs(mtdPct) >= 0.05 ? (
          <StatusBadge tone={mtdPct >= 0 ? "success" : "danger"}>
            {formatPercent(mtdPct, { signDisplay: "exceptZero", maximumFractionDigits: 1 })} {h.thisMonthChange}
          </StatusBadge>
        ) : null}
      </div>
      <p className="text-hero font-semibold **:normal-nums">
        <AnimatedMoney value={netWorth} id="home-net-worth" />
      </p>
      {values.length > 1 ? (
        <div className="text-primary" data-private>
          <Sparkline values={values} label={h.trendLabel({ change: formatMoneyCompact(change, { signDisplay: "exceptZero" }), months: values.length })} />
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-3 text-sm">
        <span className="text-muted-foreground">
          {h.assets} <Money value={grossAssets} compact className="font-medium text-foreground" />
        </span>
        <span className="text-muted-foreground">
          {h.debts} <Money value={liabilities} compact className="font-medium text-foreground" />
        </span>
        <Link href="/wealth" className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground" aria-label={t.nav.hubs.wealth.label}>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

/** This month at a glance: in, paid so far, planned out, left at the end. */
export function MonthGlance({ month, cash, className }: { month: MonthView; cash: CashflowSummary; className?: string }) {
  const { t } = useI18n();
  const h = t.home.month;
  const hasPlan = month.totals.planned > 0;
  const share = hasPlan ? month.totals.settled / month.totals.planned : 0;
  const left = cash.totalIncome - (hasPlan ? month.totals.projected : cash.averageSpending);
  const row = (label: string, value: ReactNode) => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
  return (
    <Card className={cn("gap-4 px-5", className)}>
      <CardHeading title={h.title} href="/cashflow" linkLabel={h.open} />
      <div className="flex items-center gap-4">
        <ProgressRing value={share} size={64} stroke={7} label={t.cashflow.month.ringLabel({ pct: formatPercent(share * 100, { maximumFractionDigits: 0 }) })}>
          {formatPercent(Math.min(999, share * 100), { maximumFractionDigits: 0 })}
        </ProgressRing>
        <dl className="grid flex-1 gap-1.5">
          {row(h.income, <Money value={cash.totalIncome} compact interactive={false} />)}
          {row(h.spent, <Money value={month.totals.settled} compact interactive={false} />)}
          {row(h.planned, <Money value={hasPlan ? month.totals.planned : cash.averageSpending} compact interactive={false} />)}
        </dl>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm">
          <PiggyBank className="size-4 text-primary" aria-hidden />
          {h.left}
        </span>
        <Money value={left} compact signed tone="auto" className="font-semibold" />
      </div>
    </Card>
  );
}

/** Bills that need paying soon (or are overdue), each ticked off in place. */
export function DueBills({ lines, monthKey, actions, className }: { lines: BillLine[]; monthKey: string; actions: RecordActions; className?: string }) {
  const { t } = useI18n();
  const h = t.home.due;
  // A card like its neighbours (title inside), so a row of cards shares one top and bottom edge.
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <div className="px-4 pt-4 pb-2">
        <CardHeading title={h.title} href="/cashflow" linkLabel={h.viewAll} />
      </div>
      {lines.length ? (
        <ul className="divide-y border-t">
          {lines.map((l) => (
            <BillRow key={l.item.id} line={l} monthKey={monthKey} actions={actions} />
          ))}
        </ul>
      ) : (
        <p className="flex flex-1 items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
          <Sunrise className="size-4" aria-hidden />
          {h.empty}
        </p>
      )}
    </Card>
  );
}

const RING: Record<StatusTone, "success" | "warning" | "danger" | "primary"> = { success: "success", warning: "warning", danger: "danger", info: "primary", neutral: "primary" };

/** Goal plans with progress rings and their status. */
export function GoalsGlance({ plans, onOpen, className }: { plans: GoalPlanWithStatus[]; onOpen: (id: string) => void; className?: string }) {
  const { t } = useI18n();
  const h = t.home.goals;
  return (
    <Card className={cn("gap-3 px-5", className)}>
      <CardHeading title={h.title} href="/goals" linkLabel={h.viewAll} />
      {plans.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{h.empty}</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/goals?new=1">{h.create}</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {plans.slice(0, 4).map((p) => {
            const pct = formatPercent(Math.min(999, p.status.progress * 100), { maximumFractionDigits: 0 });
            return (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => p.planId && onOpen(p.planId)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  <ProgressRing value={p.status.progress} size={48} stroke={5} tone={RING[p.status.tone]} complete={p.status.progress >= 1} label={t.goals.hero.ringLabel({ pct })}>
                    <span className="text-xs">{pct}</span>
                  </ProgressRing>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      <Money value={p.saved} compact interactive={false} /> / <Money value={p.targetAmount} compact interactive={false} />
                    </span>
                    <GoalStatusBadge status={p.status} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Tile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: ReactNode; tone: StatusTone }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className={cn("text-lg font-semibold", color)}>{value}</p>
    </div>
  );
}

/** Four health numbers; the full breakdown opens on demand. */
export function HealthTiles({ health, cash, onDetails, className }: { health: FinancialHealth; cash: CashflowSummary; onDetails: () => void; className?: string }) {
  const { t } = useI18n();
  const h = t.home.health;
  const rate = cash.totalIncome > 0 ? cash.monthlyNet / cash.totalIncome : null;
  const e = health.emergencyMonths;
  const d = health.debtToAssets;
  return (
    <Card className={cn("gap-3 px-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{h.title}</h2>
        <Button variant="ghost" size="sm" onClick={onDetails}>
          {t.common.viewAll}
          <ChevronRight />
        </Button>
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2">
        <Tile icon={LifeBuoy} label={h.emergency} value={e === null ? "—" : h.months({ value: formatNumber(e, { maximumFractionDigits: 1 }) })} tone={e === null ? "neutral" : e >= 6 ? "success" : e >= 3 ? "warning" : "danger"} />
        <Tile icon={Scale} label={h.debtRatio} value={d === null ? "—" : formatPercent(d * 100, { maximumFractionDigits: 0 })} tone={d === null ? "neutral" : d <= 0.3 ? "success" : d <= 0.5 ? "warning" : "danger"} />
        <Tile icon={PiggyBank} label={h.savingsRate} value={rate === null ? "—" : formatPercent(rate * 100, { maximumFractionDigits: 0 })} tone={rate === null ? "neutral" : rate >= 0.2 ? "success" : rate >= 0.1 ? "warning" : "danger"} />
        <Tile icon={Sunrise} label={h.fi} value={health.fiProgress === null ? "—" : formatPercent(health.fiProgress * 100, { maximumFractionDigits: 0 })} tone="neutral" />
      </div>
    </Card>
  );
}
