"use client";

import type { LucideIcon } from "lucide-react";
import { Flame, HandCoins, LifeBuoy, Percent, Scale, Waves } from "lucide-react";
import type { ReactNode } from "react";

import type { FinancialHealth } from "@/entities/portfolio";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatNumber, formatPercent } from "@/shared/lib/format";
import type { StatusTone } from "@/shared/lib/tone";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { StatusBadge } from "@/shared/ui/status-badge";

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

function Metric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  verdict,
  explain,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: StatusTone;
  verdict?: string;
  explain: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5 rounded-md border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" aria-hidden />
          {label}
        </p>
        {verdict ? (
          <StatusBadge tone={tone} dot>
            {verdict}
          </StatusBadge>
        ) : null}
      </div>
      <p className={cn("text-xl font-semibold tracking-tight normal-nums", TONE_TEXT[tone])}>{value}</p>
      <p className="text-xs text-muted-foreground">{explain}</p>
    </div>
  );
}

const pct = (fraction: number) => formatPercent(fraction * 100, { maximumFractionDigits: 0 });

/** Six plain-language health checks computed from the user's tables. */
export function FinancialHealthCard({ health, annualRealRate, bare }: { health: FinancialHealth; annualRealRate: number; /** Content only (inside a dialog). */ bare?: boolean }) {
  const h = health;
  const { t } = useI18n();
  const m = t.dashboard.health;
  const months = (n: number) => m.months({ value: formatNumber(n, { maximumFractionDigits: 1 }), count: n });
  const emergencyTone: StatusTone =
    h.emergencyMonths === null ? "neutral" : h.emergencyMonths >= 6 ? "success" : h.emergencyMonths >= 3 ? "warning" : "danger";
  const debtTone: StatusTone =
    h.debtToAssets === null ? "neutral" : h.debtToAssets <= 0.3 ? "success" : h.debtToAssets <= 0.5 ? "warning" : "danger";
  const liquidTone: StatusTone = h.liquidShare === null ? "neutral" : h.liquidShare >= 0.1 ? "success" : "warning";

  const body = (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          icon={LifeBuoy}
          label={m.emergency.label}
          value={h.emergencyMonths === null ? "—" : months(h.emergencyMonths)}
          tone={emergencyTone}
          verdict={h.emergencyMonths === null ? undefined : h.emergencyMonths >= 6 ? m.emergency.healthy : h.emergencyMonths >= 3 ? m.emergency.okay : m.emergency.low}
          explain={
            h.emergencyMonths === null ? (
              m.needSpending
            ) : (
              <>
                <Money value={h.instantAssets} compact /> {m.emergency.explain}
              </>
            )
          }
        />
        <Metric
          icon={Flame}
          label={m.fi.label}
          value={h.fiProgress === null ? "—" : pct(h.fiProgress)}
          tone={h.fiProgress !== null && h.fiProgress >= 1 ? "success" : "neutral"}
          verdict={h.fiProgress !== null && h.fiProgress >= 1 ? m.fi.reached : undefined}
          explain={
            h.fiNumber === null ? (
              m.needSpending
            ) : (
              <>
                {m.fi.ofPrefix} <Money value={h.fiNumber} compact /> {m.fi.ofSuffix}{" "}
                {h.fiProgress !== null && h.fiProgress >= 1
                  ? m.fi.reachedExplain
                  : h.yearsToFi === null
                    ? m.fi.unreachable
                    : m.fi.years({
                        years: formatNumber(h.yearsToFi, { maximumFractionDigits: 1 }),
                        growth: annualRealRate > 0 ? formatPercent(annualRealRate * 100) : undefined,
                      })}
              </>
            )
          }
        />
        <Metric
          icon={HandCoins}
          label={m.passive.label}
          value={h.passiveCoverage === null ? "—" : pct(h.passiveCoverage)}
          tone={h.passiveCoverage !== null && h.passiveCoverage >= 1 ? "success" : "neutral"}
          explain={h.passiveCoverage === null ? m.needSpending : m.passive.explain}
        />
        <Metric
          icon={Scale}
          label={m.debt.label}
          value={h.debtToAssets === null ? "—" : pct(h.debtToAssets)}
          tone={debtTone}
          verdict={h.debtToAssets === null ? undefined : h.debtToAssets <= 0.3 ? m.debt.low : h.debtToAssets <= 0.5 ? m.debt.moderate : m.debt.high}
          explain={m.debt.explain}
        />
        <Metric
          icon={Waves}
          label={m.liquid.label}
          value={h.liquidShare === null ? "—" : pct(h.liquidShare)}
          tone={liquidTone}
          explain={m.liquid.explain}
        />
        <Metric
          icon={Percent}
          label={m.interest.label}
          value={<Money value={h.monthlyInterest} compact />}
          tone={h.monthlyInterest > 0 ? "danger" : "neutral"}
          explain={h.monthlyInterest > 0 ? m.interest.explain : m.interest.none}
        />
      </div>
  );
  return bare ? body : (
    <Section title={m.title} description={m.description}>
      {body}
    </Section>
  );
}
