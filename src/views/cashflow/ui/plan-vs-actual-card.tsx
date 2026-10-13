"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CategoryTile, TRACKED_COVERAGE, type ItemDrift, type PlanVsActual } from "@/entities/expense";
import { useI18n } from "@/shared/i18n";
import { formatDate, formatMoney, formatMoneyCompact } from "@/shared/lib/format";
import { monthStart } from "@/shared/lib/month";
import { chartAxisProps, ChartLegendItem, ChartTooltipCard } from "@/shared/ui/chart";
import { Button } from "@/shared/ui/kit/button";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";

/** Planned vs. actually paid over recent months, and bills whose real cost has drifted from the plan. */
export function PlanVsActualCard({ data, onUpdatePlan }: { data: PlanVsActual; onUpdatePlan: (d: ItemDrift) => void }) {
  const { t } = useI18n();
  const h = t.cashflow.spending.history;
  const rows = data.months.map((m) => ({
    key: m.monthKey,
    label: formatDate(monthStart(m.monthKey), "monthYear"),
    planned: m.planned,
    actual: m.coverage >= TRACKED_COVERAGE || m.actual > 0 ? m.actual : null,
    tracked: m.coverage >= TRACKED_COVERAGE,
  }));
  const summary =
    data.drift === null
      ? h.notEnough
      : Math.abs(data.drift) < 0.03 * (data.averagePlanned ?? 0)
        ? h.onPlan
        : data.drift > 0
          ? h.driftUp({ amount: formatMoney(data.drift) })
          : h.driftDown({ amount: formatMoney(-data.drift) });

  return (
    <Section title={h.title} description={h.description}>
      <div className="grid gap-4">
        <p className="text-sm" data-private>
          {summary}
        </p>
        <div className="flex gap-4">
          <ChartLegendItem color="var(--chart-1)" label={h.planned} />
          <ChartLegendItem color="var(--chart-2)" label={h.actual} />
        </div>
        <div className="h-48 w-full" role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" {...chartAxisProps} tickMargin={8} interval={0} tickFormatter={(v: string) => v.replace(/,? ?\d{4}$/, "")} />
              <YAxis width={48} tickFormatter={(v: number) => formatMoneyCompact(v, { symbol: false })} {...chartAxisProps} />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.5 }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTooltipCard
                      title={String(payload[0].payload.label)}
                      rows={[
                        { key: "p", name: h.planned, color: "var(--chart-1)", value: formatMoney(Number(payload[0].payload.planned)) },
                        {
                          key: "a",
                          name: h.actual,
                          color: "var(--chart-2)",
                          value: payload[0].payload.actual === null ? h.untracked : formatMoney(Number(payload[0].payload.actual)),
                        },
                      ]}
                    />
                  ) : null
                }
              />
              <Bar dataKey="planned" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="actual" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data.itemDrift.length ? (
          <ul className="grid gap-2 border-t pt-4">
            {data.itemDrift.slice(0, 3).map((d) => (
              <li key={d.itemId} className="flex flex-wrap items-center gap-3">
                <CategoryTile category={d.category} size="sm" />
                <span className="min-w-0 flex-1 text-sm" data-private>
                  {h.itemDrift({ name: d.name, average: formatMoney(Math.round(d.averagePaid)), planned: formatMoney(d.planned) })}
                </span>
                <Button size="sm" variant="outline" onClick={() => onUpdatePlan(d)}>
                  {h.update} <Money value={Math.round(d.averagePaid / 1000) * 1000} compact interactive={false} />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
