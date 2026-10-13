"use client";

import { ArrowRight, CheckCheck, ChevronRight, LifeBuoy, PiggyBank, Plus, Receipt, Scale, Sunrise, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { BillLine, MonthView } from "@/entities/expense";
import type { GoalPlanWithStatus } from "@/entities/goal";
import { GoalStatusBadge } from "@/entities/goal/ui";
import type { CashflowSummary, FinancialHealth, HealthGrade } from "@/entities/portfolio";
import type { NetWorthMonthSnapshot } from "@/entities/preferences";
import { buildNetWorthTrend } from "@/entities/preferences";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatMoneyCompact, formatMonths, formatNumber, formatPercent } from "@/shared/lib/format";
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

/** How much of what you own can be used right away: shown until there's a trend line to draw. */
function AssetSplit({ instant, total }: { instant: number; total: number }) {
  const { t } = useI18n();
  const s = t.home.split;
  const now = Math.min(Math.max(0, instant), total);
  const share = total > 0 ? now / total : 0;
  return (
    <div className="grid gap-2" data-private>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-primary/15"
        role="img"
        aria-label={s.label({ instant: formatMoneyCompact(now), other: formatMoneyCompact(total - now) })}
      >
        <span className="block h-full rounded-full bg-primary motion-safe:animate-progress-grow" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          {s.instant} <Money value={now} compact interactive={false} className="font-medium text-foreground" />
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/25" />
          {s.other} <Money value={total - now} compact interactive={false} className="font-medium text-foreground" />
        </span>
      </div>
    </div>
  );
}

/** The headline: net worth, this month's change and a 12-month trend line. */
export function NetWorthHero({
  netWorth,
  grossAssets,
  liabilities,
  instantAssets,
  mtdPct,
  history,
  className,
}: {
  netWorth: number;
  grossAssets: number;
  liabilities: number;
  /** Instant-access part of `grossAssets`. */
  instantAssets: number;
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
      ) : grossAssets > 0 ? (
        <AssetSplit instant={instantAssets} total={grossAssets} />
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

/** Bills that need paying soon (or are overdue), each ticked off in place; later ones fill in when few are due. */
export function DueBills({
  lines,
  upcoming,
  billsCount,
  billsDone,
  hasBills,
  monthKey,
  actions,
  className,
}: {
  lines: BillLine[];
  /** Due later this month (after the "soon" window), earliest first. */
  upcoming: BillLine[];
  /** Bills in this month and how many are paid, autopaid or skipped. */
  billsCount: number;
  billsDone: number;
  /** Any recurring bill at all (some aren't due every month). */
  hasBills: boolean;
  monthKey: string;
  actions: RecordActions;
  className?: string;
}) {
  const { t } = useI18n();
  const h = t.home.due;
  const later = upcoming.slice(0, Math.max(0, 4 - lines.length));
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
      ) : null}
      {later.length ? (
        <section aria-label={h.upcoming} className="border-t">
          <p className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
            {lines.length ? null : <Sunrise className="size-3.5" aria-hidden />}
            {lines.length ? h.upcoming : `${h.empty} ${h.upcoming}:`}
          </p>
          <ul className="divide-y">
            {later.map((l) => (
              <BillRow key={l.item.id} line={l} monthKey={monthKey} actions={actions} />
            ))}
          </ul>
        </section>
      ) : null}
      {!lines.length && !later.length ? (
        // Icon beside the text on phones, stacked and centred where the card has room.
        <div className="flex flex-1 items-start gap-3 border-t px-4 py-4 sm:flex-col sm:items-center sm:justify-center sm:gap-2 sm:px-6 sm:py-6 sm:text-center">
          <span
            className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", hasBills ? "bg-success/12 text-success" : "bg-primary-soft text-primary")}
            aria-hidden
          >
            {hasBills ? <CheckCheck className="size-5" /> : <Receipt className="size-5" />}
          </span>
          <div className="grid min-w-0 justify-items-start gap-1 sm:justify-items-center">
            <p className="text-sm font-medium">{!hasBills ? h.noBills : billsCount ? h.allPaid({ done: billsDone, total: billsCount }) : h.empty}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{hasBills ? h.allPaidHint : h.noBillsHint}</p>
            {hasBills ? null : (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href="/cashflow/spending?new=1">
                  <Plus />
                  {h.addBill}
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

const RING: Record<StatusTone, "success" | "warning" | "danger" | "primary"> = { success: "success", warning: "warning", danger: "danger", info: "primary", neutral: "primary" };

function GoalButton({ plan: p, onOpen, size }: { plan: GoalPlanWithStatus; onOpen: (id: string) => void; size: "md" | "lg" }) {
  const { t } = useI18n();
  const pct = formatPercent(Math.min(999, p.status.progress * 100), { maximumFractionDigits: 0 });
  const lg = size === "lg";
  return (
    <button
      type="button"
      onClick={() => p.planId && onOpen(p.planId)}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <ProgressRing
        value={p.status.progress}
        size={lg ? 64 : 48}
        stroke={lg ? 6 : 5}
        tone={RING[p.status.tone]}
        complete={p.status.progress >= 1}
        label={t.goals.hero.ringLabel({ pct })}
      >
        <span className={lg ? "text-sm font-semibold" : "text-xs"}>{pct}</span>
      </ProgressRing>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className={cn("truncate font-medium", lg ? "text-base" : "text-sm")}>{p.name}</span>
        {/* Amounts and status share a line when they fit. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("truncate text-muted-foreground", lg ? "text-sm" : "text-xs")}>
            <Money value={p.saved} compact interactive={false} /> / <Money value={p.targetAmount} compact interactive={false} />
          </span>
          <GoalStatusBadge status={p.status} />
        </span>
      </span>
    </button>
  );
}

/** Goal plans with progress rings and their status; a single plan gets its numbers spelled out. */
export function GoalsGlance({ plans, onOpen, className }: { plans: GoalPlanWithStatus[]; onOpen: (id: string) => void; className?: string }) {
  const { t } = useI18n();
  const h = t.home.goals;
  const only = plans.length === 1 ? plans[0] : null;
  // Label-value rows on phones, small tiles from `sm` up.
  const stat = (label: string, value: ReactNode, sub?: ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 text-sm sm:grid sm:content-start sm:justify-normal sm:gap-0.5 sm:rounded-lg sm:bg-muted/50 sm:px-3 sm:py-2.5">
      <dt className="text-muted-foreground sm:text-xs">{label}</dt>
      <dd className="text-right font-semibold tabular-nums sm:text-left">
        {value}
        {sub ? <span className="ml-1.5 text-xs font-normal text-muted-foreground sm:ml-0 sm:block">{sub}</span> : null}
      </dd>
    </div>
  );
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
      ) : only ? (
        <div className="grid gap-3">
          <GoalButton plan={only} onOpen={onOpen} size="lg" />
          <dl className="grid gap-1.5 sm:grid-cols-3 sm:gap-2" data-private>
            {stat(h.contributing, <Money value={only.status.monthlyContribution} compact interactive={false} />)}
            {stat(h.needed, only.status.requiredMonthly === null ? "—" : <Money value={only.status.requiredMonthly} compact interactive={false} />)}
            {stat(
              h.deadline,
              only.targetDate ? formatDate(only.targetDate, "monthYear") : "—",
              only.targetDate && only.status.monthsLeft > 0 ? h.monthsLeft({ months: formatMonths(Math.max(1, Math.round(only.status.monthsLeft))) }) : null,
            )}
          </dl>
        </div>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {plans.slice(0, 4).map((p) => (
            <li key={p.key}>
              <GoalButton plan={p} onOpen={onOpen} size="md" />
            </li>
          ))}
          {plans.length === 3 ? (
            // Fills the empty fourth slot with something useful.
            <li className="max-sm:hidden">
              <Link
                href="/goals?new=1"
                className="flex h-full items-center gap-3 rounded-lg p-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed" aria-hidden>
                  <Plus className="size-4" />
                </span>
                {h.addAnother}
              </Link>
            </li>
          ) : null}
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
export function HealthTiles({
  health,
  cash,
  score,
  onDetails,
  className,
}: {
  health: FinancialHealth;
  cash: CashflowSummary;
  /** Overall score and grade, when there's enough data. */
  score?: { value: number; grade: HealthGrade } | null;
  onDetails: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const h = t.home.health;
  const rate = cash.totalIncome > 0 ? cash.monthlyNet / cash.totalIncome : null;
  const e = health.emergencyMonths;
  const d = health.debtToAssets;
  return (
    <Card className={cn("gap-3 px-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {score ? (
            <button type="button" onClick={onDetails} className="shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring" aria-label={t.health.ringLabel({ score: score.value })}>
              <ProgressRing value={score.value / 100} size={40} stroke={4} tone={score.value >= 70 ? "success" : score.value >= 45 ? "warning" : "danger"} label={t.health.ringLabel({ score: score.value })}>
                <span className="text-xs font-bold">{score.value}</span>
              </ProgressRing>
            </button>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{h.title}</h2>
            {score ? <p className="truncate text-xs text-muted-foreground">{t.health.grades[score.grade]}</p> : null}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDetails} className="shrink-0">
          <span className="max-sm:sr-only">{t.common.viewAll}</span>
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
