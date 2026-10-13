"use client";

import {
  CalendarClock,
  Coins,
  Flame,
  Gauge,
  HandCoins,
  Info,
  LifeBuoy,
  ListChecks,
  Percent,
  PieChart,
  PiggyBank,
  Receipt,
  Scale,
  Shield,
  ShoppingBasket,
  Sprout,
  Target,
  TrendingUp,
  Waves,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { assetCategoryLabel } from "@/entities/settings-asset";
import type { HealthArea, HealthMetric, HealthMetricId, HealthReport } from "@/entities/portfolio";
import { useI18n, type Messages } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatMoneyCompact, formatNumber, formatPercent } from "@/shared/lib/format";
import type { StatusTone } from "@/shared/lib/tone";
import { ProgressRing } from "@/shared/ui/progress-ring";
import { StatusBadge } from "@/shared/ui/status-badge";

const AREA_ICON: Record<HealthArea, LucideIcon> = { safety: Shield, cashflow: Wallet, debt: Scale, growth: Sprout, spread: PieChart };

const METRIC_ICON: Record<HealthMetricId, LucideIcon> = {
  emergency: LifeBuoy,
  runway: CalendarClock,
  liquid: Waves,
  savingsRate: PiggyBank,
  fixedCosts: Receipt,
  needs: ShoppingBasket,
  planDrift: ListChecks,
  debtToAssets: Scale,
  debtService: Gauge,
  interestCost: Percent,
  debtFree: CalendarClock,
  fi: Flame,
  passive: HandCoins,
  trend: TrendingUp,
  goals: Target,
  concentration: PieChart,
  hedge: Coins,
};

const AREAS: HealthArea[] = ["safety", "cashflow", "debt", "growth", "spread"];

const TONE_TEXT: Record<StatusTone, string> = { neutral: "", success: "text-success", warning: "text-warning", danger: "text-danger", info: "text-info" };
const BAR: Record<"success" | "warning" | "danger", string> = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" };
const scoreTone = (score: number): "success" | "warning" | "danger" => (score >= 70 ? "success" : score >= 45 ? "warning" : "danger");

function valueText(t: Messages, m: HealthMetric): string {
  const v = m.value;
  switch (v.kind) {
    case "months":
      // Two years and more read better in years (157 months → 13,1 years).
      return v.value >= 24
        ? t.health.years({ value: formatNumber(v.value / 12, { maximumFractionDigits: 1 }) })
        : t.health.months({ value: formatNumber(v.value, { maximumFractionDigits: v.value < 10 ? 1 : 0 }), count: v.value });
    case "unlimited":
      return t.health.unlimited;
    case "percent":
      return formatPercent(v.value * 100, { maximumFractionDigits: 0 });
    case "signedPercent":
      return formatPercent(v.value * 100, { maximumFractionDigits: 1, signDisplay: "exceptZero" });
    case "money":
      return formatMoneyCompact(v.value);
    case "ratio":
      return t.health.ratio({ done: v.done, total: v.total });
    case "none":
      return "—";
  }
}

function whyText(t: Messages, m: HealthMetric): string {
  const x = t.health.metrics;
  const d = m.detail ?? {};
  const money = (k: string) => formatMoneyCompact(Number(d[k] ?? 0));
  switch (m.id) {
    case "emergency":
      return m.value.kind === "none" ? t.dashboard.health.needSpending : x.emergency.why({ amount: money("instant") });
    case "runway":
      return m.value.kind === "none" ? t.dashboard.health.needSpending : x.runway.why({ amount: money("passive") });
    case "savingsRate":
      return m.value.kind === "none" ? t.health.noData : x.savingsRate.why({ amount: formatMoneyCompact(Number(d.net ?? 0), { signDisplay: "auto" }) });
    case "fixedCosts":
      return x.fixedCosts.why({ amount: money("bills") });
    case "debtService":
      return x.debtService.why({ amount: money("payments") });
    case "interestCost":
      return Number(m.value.kind === "money" ? m.value.value : 0) > 0
        ? x.interestCost.why({ share: typeof d.share === "number" ? formatPercent(d.share * 100, { maximumFractionDigits: 1 }) : null })
        : t.dashboard.health.interest.none;
    case "debtFree":
      return x.debtFree.why({ state: !d.open ? "none" : d.never ? "never" : "date" });
    case "fi":
      return d.fiNumber === null || d.fiNumber === undefined
        ? t.dashboard.health.needSpending
        : x.fi.why({ amount: formatMoneyCompact(Number(d.fiNumber)), years: typeof d.years === "number" ? formatNumber(d.years, { maximumFractionDigits: 1 }) : null });
    case "trend":
      return x.trend.why({ months: Number(d.months ?? 0) });
    case "concentration":
      return x.concentration.why({ category: typeof d.category === "string" ? assetCategoryLabel(d.category) : null, count: Number(d.categories ?? 0) });
    case "hedge":
      return x.hedge.why({ amount: money("hedged") });
    default:
      return (x[m.id].why as () => string)();
  }
}

function MetricTile({ m }: { m: HealthMetric }) {
  const { t } = useI18n();
  const Icon = METRIC_ICON[m.id];
  const copy = t.health.metrics[m.id];
  const verdict = m.tone === "success" || m.tone === "warning" || m.tone === "danger" ? t.health.verdicts[m.tone] : null;
  const showTip = (m.tone === "warning" || m.tone === "danger") && m.value.kind !== "none";
  return (
    <div className="grid content-start gap-1.5 rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-start gap-2 text-sm leading-snug font-medium text-muted-foreground">
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{copy.label}</span>
        </p>
        {verdict ? (
          <StatusBadge tone={m.tone} dot className="shrink-0">
            {verdict}
          </StatusBadge>
        ) : null}
      </div>
      <p className={cn("text-xl font-semibold tracking-tight tabular-nums", TONE_TEXT[m.tone])} data-private={m.value.kind === "money" || undefined}>
        {valueText(t, m)}
      </p>
      <p className="text-xs text-muted-foreground" data-private>
        {whyText(t, m)}
      </p>
      {showTip ? <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">{copy.tip}</p> : null}
      <details className="group text-xs text-muted-foreground">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Info className="size-3.5" aria-hidden />
          {t.health.how}
        </summary>
        <p className="mt-1 pl-4.5">{copy.how}</p>
      </details>
    </div>
  );
}

/** The full health check: score, areas, what to improve first, then every metric by area. */
export function HealthReportView({ report }: { report: HealthReport }) {
  const { t } = useI18n();
  const h = t.health;
  const scored = AREAS.filter((a) => report.areaScores[a] !== null);
  const strongest = scored.length ? scored.reduce((a, b) => (report.areaScores[b]! > report.areaScores[a]! ? b : a)) : null;
  const weakest = scored.length > 1 ? scored.reduce((a, b) => (report.areaScores[b]! < report.areaScores[a]! ? b : a)) : null;
  const byId = new Map(report.metrics.map((m) => [m.id, m]));

  return (
    <div className="grid gap-6">
      <div className="grid gap-5 rounded-2xl border bg-hero p-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-8">
        <div className="flex items-center gap-4">
          {report.score !== null ? (
            <ProgressRing value={report.score / 100} size={104} stroke={10} tone={scoreTone(report.score)} label={h.ringLabel({ score: report.score })}>
              <span className="flex flex-col items-center leading-none">
                <span className="text-3xl font-bold tabular-nums">{report.score}</span>
                <span className="mt-1 text-xs font-medium text-muted-foreground">/100</span>
              </span>
            </ProgressRing>
          ) : (
            <div className="flex size-[104px] items-center justify-center rounded-full border-[10px] border-muted text-2xl font-semibold text-muted-foreground">—</div>
          )}
          <div className="grid gap-1">
            <p className="text-sm text-muted-foreground">{h.scoreTitle}</p>
            {report.grade ? (
              <p className={cn("text-2xl font-semibold tracking-tight", TONE_TEXT[scoreTone(report.score!)])}>
                {report.grade} · {h.grades[report.grade]}
              </p>
            ) : (
              <p className="max-w-56 text-sm">{h.noScore}</p>
            )}
            {strongest ? <p className="text-xs text-muted-foreground">{h.strongest({ area: h.areas[strongest].label })}</p> : null}
            {weakest && weakest !== strongest ? <p className="text-xs text-muted-foreground">{h.weakest({ area: h.areas[weakest].label })}</p> : null}
          </div>
        </div>
        <ul className="grid gap-2.5">
          {AREAS.map((a) => {
            const s = report.areaScores[a];
            const Icon = AREA_ICON[a];
            return (
              <li key={a} className="grid grid-cols-[auto_10.5rem_minmax(0,1fr)_2.5rem] items-center gap-2.5 text-sm max-sm:grid-cols-[auto_minmax(0,1fr)_2.5rem]">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="truncate max-sm:col-span-1">{h.areas[a].label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted max-sm:col-span-2 max-sm:col-start-2 max-sm:row-start-2" aria-hidden>
                  {s !== null ? <span className={cn("block h-full rounded-full motion-safe:animate-progress-grow", BAR[scoreTone(s)])} style={{ width: `${s}%` }} /> : null}
                </span>
                <span className="text-right font-medium tabular-nums max-sm:col-start-3 max-sm:row-start-1" aria-label={s !== null ? h.areaScore({ area: h.areas[a].label, score: s }) : undefined}>
                  {s ?? "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <section className="grid gap-2" aria-labelledby="health-focus">
        <h3 id="health-focus" className="text-sm font-semibold">
          {h.focusTitle}
        </h3>
        {report.focus.length ? (
          <ol className="grid gap-2 md:grid-cols-3">
            {report.focus.map((id, i) => {
              const m = byId.get(id)!;
              const Icon = METRIC_ICON[id];
              return (
                <li key={id} className="flex gap-3 rounded-xl border bg-card p-3.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{i + 1}</span>
                  <span className="grid gap-0.5 text-sm">
                    <span className="flex items-start gap-1.5 leading-snug font-medium">
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span>
                        {h.metrics[id].label} <span className={cn("whitespace-nowrap tabular-nums", TONE_TEXT[m.tone])}>· {valueText(t, m)}</span>
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{h.metrics[id].tip}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-xl border bg-card p-3.5 text-sm text-muted-foreground">{report.score !== null ? h.focusEmpty : h.noScore}</p>
        )}
      </section>

      {AREAS.map((a) => {
        const Icon = AREA_ICON[a];
        const list = report.metrics.filter((m) => m.area === a);
        return (
          <section key={a} className="grid gap-3" aria-labelledby={`health-${a}`}>
            <header className="flex items-end justify-between gap-3">
              <div>
                <h3 id={`health-${a}`} className="flex items-center gap-2 font-semibold">
                  <Icon className="size-4 text-primary" aria-hidden />
                  {h.areas[a].label}
                </h3>
                <p className="text-xs text-muted-foreground">{h.areas[a].hint}</p>
              </div>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((m) => (
                <MetricTile key={m.id} m={m} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
