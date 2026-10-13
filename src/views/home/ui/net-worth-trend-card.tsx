"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { buildNetWorthTrend, type NetWorthMonthSnapshot } from "@/entities/preferences";
import { useI18n } from "@/shared/i18n";
import { formatDate, formatMoney, formatMoneyCompact, formatPercent } from "@/shared/lib/format";
import { chartAxisProps, ChartTooltipCard, ChartViewToggle, type ChartView } from "@/shared/ui/chart";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";

export function NetWorthTrendCard({ history, netWorth }: { history: NetWorthMonthSnapshot[]; netWorth: number }) {
  const [view, setView] = useState<ChartView>("chart");
  const { t } = useI18n();
  const m = t.dashboard.trend;
  const points = useMemo(() => buildNetWorthTrend(history, netWorth), [history, netWorth]);
  const data = points.map((p) => ({ x: p.date.getTime(), value: p.value, live: p.live }));
  const first = points[0]?.value ?? 0;
  const change = netWorth - first;
  const lastMonth = points.length > 1 ? points.at(-1)!.change : null;
  // At most ~6 labels on the time axis.
  const step = Math.max(1, Math.ceil(data.length / 6));
  const ticks = data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d) => d.x);

  return (
    <Section
      title={m.title}
      description={
        points.length > 1 ? (
          <>
            {m.lastMonths({ count: points.length })} · <Money value={change} signed tone="auto" compact /> {m.since}{" "}
            {formatDate(points[0]?.date, "monthYear")}
            {lastMonth !== null ? (
              <>
                {" "}· {m.thisMonth} <Money value={lastMonth} signed tone="auto" compact />
              </>
            ) : null}
          </>
        ) : (
          m.empty
        )
      }
      actions={<ChartViewToggle value={view} onChange={setView} />}
    >
      {view === "chart" ? (
        <div className="h-56 w-full" role="img" aria-label={m.chartLabel({ count: points.length, value: formatMoney(netWorth) })}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="x"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                ticks={ticks}
                tickFormatter={(x: number) => formatDate(x, "monthYear")}
                {...chartAxisProps}
                tickMargin={8}
              />
              <YAxis
                width={56}
                tickFormatter={(v: number) => formatMoneyCompact(v, { symbol: false })}
                domain={["auto", "auto"]}
                {...chartAxisProps}
              />
              <Tooltip
                cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <ChartTooltipCard
                      title={`${formatDate(Number(payload[0].payload.x), "monthYear")}${payload[0].payload.live ? ` ${m.today}` : ""}`}
                      rows={[{ key: "nw", name: m.netWorth, color: "var(--chart-1)", value: formatMoney(Number(payload[0].value)) }]}
                    />
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#nw-fill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Table containerClassName="-mx-5 w-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{m.month}</TableHead>
              <TableHead className="text-right">{m.netWorth}</TableHead>
              <TableHead className="text-right">{m.change}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((p) => (
              <TableRow key={p.monthKey}>
                <TableCell>
                  {formatDate(p.date, "monthYear")}
                  {p.live ? <span className="ml-1 text-xs text-muted-foreground">{m.today}</span> : null}
                </TableCell>
                <TableCell className="text-right">
                  <Money value={p.value} />
                </TableCell>
                <TableCell className="text-right">
                  {p.change === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span>
                      <Money value={p.change} signed tone="auto" />
                      {p.changePct !== null ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({formatPercent(p.changePct, { signDisplay: "exceptZero" })})
                        </span>
                      ) : null}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
