"use client";

import { ChartSpline, CircleCheck, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { buildProjectionChartModel, evaluateStartingOnlyStatus, type GoalCheckpoint } from "@/entities/goal";
import { useI18n } from "@/shared/i18n";
import { formatDate, formatMoney, formatMoneyCompact, formatMonths, formatPercent } from "@/shared/lib/format";
import { chartAxisProps, ChartLegendItem, ChartTooltipCard, ChartViewToggle, type ChartView } from "@/shared/ui/chart";
import { EmptyState } from "@/shared/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";

type ProjectionCardProps = {
  targetAmount: number;
  startingAmount: number;
  monthlyNetContribution: number;
  monthsToTarget: number;
  targetDateIso: string;
  checkpoints: GoalCheckpoint[];
  /** Yearly return (fraction). */
  annualReturn: number;
};

const MAX_TICKS = 7;

export function ProjectionCard(props: ProjectionCardProps) {
  const { t } = useI18n();
  const p = t.goals.projection;
  const [view, setView] = useState<ChartView>("chart");
  const model = useMemo(
    () =>
      buildProjectionChartModel({
        targetAmount: props.targetAmount,
        startingAmount: props.startingAmount,
        monthlyNetContribution: props.monthlyNetContribution,
        monthsToTarget: props.monthsToTarget,
        targetDateIso: props.targetDateIso || undefined,
        checkpoints: props.checkpoints,
        annualReturn: props.annualReturn,
      }),
    [props.targetAmount, props.startingAmount, props.monthlyNetContribution, props.monthsToTarget, props.targetDateIso, props.checkpoints, props.annualReturn],
  );

  const ticks = useMemo(() => {
    const monthStarts = model.rows.filter((r) => new Date(r.x).getDate() === 1).map((r) => r.x);
    const step = Math.max(1, Math.ceil(monthStarts.length / MAX_TICKS));
    return monthStarts.filter((_, i) => i % step === 0);
  }, [model.rows]);

  const { meetTarget } = model;
  const firstX = model.rows[0]?.x ?? 0;
  const visibleDots = model.paidDots.filter((d) => d.x >= firstX);
  const summary =
    meetTarget.kind === "date" ? (
      <span className={model.afterGoalDate ? "text-warning" : "text-success"}>
        {p.reachesOn} <strong className="font-semibold">{formatDate(meetTarget.date)}</strong> {p.reachesIn({ months: formatMonths(meetTarget.months) })}
        {model.afterGoalDate && model.goalDate ? <span className="text-muted-foreground"> {p.afterGoalDate({ date: formatDate(model.goalDate) })}</span> : null}
      </span>
    ) : meetTarget.kind === "already" ? (
      <span className="text-success">{p.alreadyMet}</span>
    ) : meetTarget.kind === "unreachable" ? (
      <span className="text-danger">{p.unreachable}</span>
    ) : (
      <span>{p.addTarget}</span>
    );

  return (
    <Section
      help="projection" icon={ChartSpline} tone="blue"
      title={p.title}
      description={summary}
      actions={<ChartViewToggle value={view} onChange={setView} />}
    >
      {view === "chart" ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <ChartLegendItem color="var(--chart-1)" label={p.projectedBalance} />
            {model.hasSchedule ? <ChartLegendItem color="var(--chart-2)" label={p.cumulativeDue} /> : null}
            {props.targetAmount > 0 ? <ChartLegendItem color="var(--muted-foreground)" label={p.target} dashed /> : null}
          </div>
          <div className="h-72 w-full" role="img" aria-label={p.chartAria}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={model.rows} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
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
                <YAxis width={56} tickFormatter={(v: number) => formatMoneyCompact(v, { symbol: false })} {...chartAxisProps} />
                <Tooltip
                  cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof model.rows)[number];
                    return (
                      <ChartTooltipCard
                        title={formatDate(row.x)}
                        rows={[
                          { key: "p", name: p.projected, color: "var(--chart-1)", value: formatMoney(row.projected) },
                          ...(row.due !== null ? [{ key: "d", name: p.cumulativeDue, color: "var(--chart-2)", value: formatMoney(row.due) }] : []),
                          ...(props.targetAmount > 0
                            ? [{ key: "t", name: p.target, color: "var(--muted-foreground)", value: formatMoney(row.target), dashed: true }]
                            : []),
                        ]}
                      />
                    );
                  }}
                />
                {props.targetAmount > 0 ? (
                  <ReferenceLine
                    y={props.targetAmount}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                ) : null}
                {model.hasSchedule ? (
                  <Line type="stepAfter" dataKey="due" stroke="var(--chart-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
                ) : null}
                <Line
                  type="linear"
                  dataKey="projected"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                />
                {visibleDots.map((d) => (
                  <ReferenceDot key={d.id} x={d.x} y={d.cumulative} r={4} fill="var(--chart-2)" stroke="var(--card)" strokeWidth={2} ifOverflow="discard" />
                ))}
                {/* Recharts 2 ignores fragments, so each marker is its own child. */}
                {meetTarget.kind === "date" ? (
                  <ReferenceLine x={meetTarget.date.getTime()} stroke="var(--chart-1)" strokeOpacity={0.45} />
                ) : null}
                {meetTarget.kind === "date" ? (
                  <ReferenceDot
                    x={meetTarget.date.getTime()}
                    y={props.targetAmount}
                    r={5}
                    fill="var(--chart-1)"
                    stroke="var(--card)"
                    strokeWidth={2}
                    ifOverflow="discard"
                    label={{ value: p.targetMet, position: "top", fontSize: 12, fill: "var(--foreground)" }}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            {props.annualReturn > 0
              ? p.footnoteGrowing({ rate: formatPercent(props.annualReturn * 100) })
              : p.footnoteFlat}
            {visibleDots.length ? p.footnoteDots : ""}
          </p>
        </div>
      ) : (
        <Table containerClassName="-mx-5 w-auto max-h-96 overflow-y-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{p.date}</TableHead>
              <TableHead className="text-right">{p.projected}</TableHead>
              {model.hasSchedule ? <TableHead className="text-right">{p.cumulativeDue}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {model.rows.map((r) => (
              <TableRow key={r.x}>
                <TableCell>{formatDate(r.x)}</TableCell>
                <TableCell className="text-right">
                  <Money value={r.projected} />
                </TableCell>
                {model.hasSchedule ? (
                  <TableCell className="text-right">
                    <Money value={r.due ?? 0} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/** Plans that exclude monthly income: starting balance vs target only. */
export function StartingOnlyCard({ startingBalance, targetAmount }: { startingBalance: number; targetAmount: number }) {
  const { t } = useI18n();
  const m = t.goals.startingOnly;
  const s = evaluateStartingOnlyStatus(startingBalance, targetAmount);
  return (
    <Section title={m.title} description={m.description} help="projection" icon={ChartSpline} tone="blue">
      {s.kind === "no_target" ? (
        <EmptyState art="chart" title={m.empty} className="py-8" />
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          {s.kind === "met" ? <CircleCheck className="size-10 text-success" /> : <TriangleAlert className="size-10 text-danger" />}
          <p className="text-xl font-semibold">{s.kind === "met" ? m.met : m.notMet}</p>
          <p className="text-sm text-muted-foreground">
            {m.comparison.before}
            <Money value={startingBalance} />
            {m.comparison.middle}
            <Money value={targetAmount} />
            {m.comparison.after}
          </p>
          {s.kind === "met" ? (
            s.surplus > 0 ? (
              <p className="text-sm font-medium text-success">
                {m.surplus} <Money value={s.surplus} />
              </p>
            ) : null
          ) : (
            <p className="text-sm font-medium text-danger">
              {m.shortBy} <Money value={s.gap} />
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
