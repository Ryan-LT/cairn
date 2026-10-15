"use client";

import { ArrowDownLeft, ArrowUpRight, Landmark, Lock, PiggyBank, TriangleAlert, type LucideIcon } from "lucide-react";

import { reportTotals, type SharedReport } from "@/entities/report";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDate, formatMoney, formatMoneyCompact, formatPercent } from "@/shared/lib/format";
import { BarList } from "@/shared/ui/bar-list";
import { Sparkline } from "@/shared/ui/chart";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { Section } from "@/shared/ui/section";

const vnd = (v: number, signed = false) => formatMoney(v, { currency: "VND", signDisplay: signed ? "exceptZero" : "auto" });
const vndShort = (v: number) => formatMoneyCompact(v, { currency: "VND" });
const monthName = (m: string) => formatDate(`${m}-01`, "monthYear");

function Tile({ icon: Icon, tone, label, value, sub }: { icon: LucideIcon; tone: string; label: string; value: string; sub?: string }) {
  return (
    <Card className="gap-1 px-5 py-4">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon className={cn("size-4", tone)} aria-hidden />
        {label}
      </p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}

function shares<T extends { total: number }>(rows: T[]) {
  const sum = rows.reduce((s, r) => s + Math.max(0, r.total), 0);
  return (r: T) => (sum > 0 ? Math.max(0, r.total) / sum : 0);
}

/** A decrypted report: summary tiles, month by month, and whichever sections were shared. */
export function ReportView({ report, onLock, languageSwitcher }: { report: SharedReport; onLock: () => void; languageSwitcher: React.ReactNode }) {
  const { t } = useI18n();
  const v = t.connect.view;
  const totals = reportTotals(report);
  const over = totals.net < 0;
  const maxMonth = Math.max(1, ...report.months.map((m) => Math.max(m.income, m.spending)));
  const period = report.period.all ? t.connect.share.allTime : t.connect.share.range({ from: monthName(report.period.from), to: monthName(report.period.to) });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 md:gap-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{v.title}</p>
        <div className="flex items-center gap-2">
          {languageSwitcher}
          <Button variant="outline" size="sm" onClick={onLock}>
            <Lock />
            {v.lock}
          </Button>
        </div>
      </div>

      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{report.title}</h1>
        <p className="text-sm text-muted-foreground">
          {period} · {v.asOf({ date: formatDate(report.asOf) })}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile icon={ArrowDownLeft} tone="text-success" label={v.moneyIn} value={vnd(totals.income)} />
        <Tile icon={ArrowUpRight} tone="text-danger" label={v.moneyOut} value={vnd(totals.spending)} sub={v.perMonth({ amount: vndShort(totals.monthlySpending) })} />
        <Tile
          icon={over ? TriangleAlert : PiggyBank}
          tone={over ? "text-danger" : "text-primary"}
          label={v.net}
          value={vnd(totals.net, true)}
          sub={over ? v.overspent : totals.savingsRate !== null ? v.savedPct({ pct: formatPercent(totals.savingsRate * 100, { maximumFractionDigits: 0 }) }) : undefined}
        />
      </div>

      <Section title={v.monthly}>
        {totals.income === 0 && totals.spending === 0 ? (
          <p className="text-sm text-muted-foreground">{v.noData}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-1 pb-2 font-medium">{v.month}</th>
                  <th className="px-1 pb-2 text-right font-medium">{v.moneyIn}</th>
                  <th className="px-1 pb-2 text-right font-medium">{v.moneyOut}</th>
                  <th className="px-1 pb-2 text-right font-medium">{v.net}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...report.months].reverse().map((m) => {
                  const net = m.income - m.spending;
                  return (
                    <tr key={m.month}>
                      <td className="px-1 py-2 align-top">
                        <span className="whitespace-nowrap">{monthName(m.month)}</span>
                        <span className="mt-1 grid w-24 gap-0.5" aria-hidden>
                          <span className="h-1 rounded-full bg-success/70" style={{ width: `${(m.income / maxMonth) * 100}%` }} />
                          <span className="h-1 rounded-full bg-danger/70" style={{ width: `${(m.spending / maxMonth) * 100}%` }} />
                        </span>
                      </td>
                      <td className="px-1 py-2 text-right align-top tabular-nums" title={vnd(m.income)}>
                        {vndShort(m.income)}
                      </td>
                      <td className="px-1 py-2 text-right align-top tabular-nums" title={vnd(m.spending)}>
                        {vndShort(m.spending)}
                      </td>
                      <td className={cn("px-1 py-2 text-right align-top font-medium tabular-nums", net < 0 ? "text-danger" : net > 0 ? "text-success" : undefined)} title={vnd(net, true)}>
                        {formatMoneyCompact(net, { currency: "VND", signDisplay: "exceptZero" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {report.categories ? (
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          <Section title={v.categories}>
            {report.categories.length ? (
              <BarList
                items={report.categories.map((c) => ({
                  key: c.category,
                  label: t.expenses.categories[c.category],
                  value: c.total,
                  valueLabel: vndShort(c.total),
                  share: shares(report.categories!)(c),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{v.noData}</p>
            )}
          </Section>
          <Section title={v.topItems}>
            {report.topItems?.length ? (
              <ol className="divide-y text-sm">
                {report.topItems.map((i, n) => (
                  <li key={`${i.name}-${n}`} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="block truncate">{i.name}</span>
                      {i.category && t.expenses.categories[i.category] !== i.name ? <span className="text-xs text-muted-foreground">{t.expenses.categories[i.category]}</span> : null}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{vndShort(i.total)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{v.noData}</p>
            )}
          </Section>
        </div>
      ) : null}

      {report.income ? (
        <Section title={v.income}>
          {(() => {
            const rows = [...report.income.sources.map((s) => ({ key: s.name, label: s.name, total: s.total })), ...(report.income.other > 0 ? [{ key: "__other", label: v.otherIncome, total: report.income.other }] : [])];
            return rows.length ? (
              <BarList items={rows.map((r) => ({ key: r.key, label: r.label, value: r.total, valueLabel: vndShort(r.total), share: shares(rows)(r) }))} />
            ) : (
              <p className="text-sm text-muted-foreground">{v.noData}</p>
            );
          })()}
        </Section>
      ) : null}

      {report.netWorth ? (
        <Section title={v.netWorth} icon={Landmark} tone="amber">
          <div className="grid gap-5">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              {[
                { label: v.assets, value: report.netWorth.assets },
                { label: v.debts, value: report.netWorth.debts },
                { label: v.netWorth, value: report.netWorth.netWorth },
              ].map((x) => (
                <div key={x.label} className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{x.label}</dt>
                  <dd className="font-semibold tabular-nums" title={vnd(x.value)}>
                    {vndShort(x.value)}
                  </dd>
                </div>
              ))}
            </dl>
            {report.netWorth.history.length > 1 ? (
              <div className="grid gap-1 text-primary">
                <p className="text-xs text-muted-foreground">{v.trend}</p>
                <Sparkline values={report.netWorth.history.map((h) => h.value)} label={`${monthName(report.netWorth.history[0].month)} – ${monthName(report.netWorth.history.at(-1)!.month)}`} className="h-16" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{monthName(report.netWorth.history[0].month)}</span>
                  <span>{monthName(report.netWorth.history.at(-1)!.month)}</span>
                </div>
              </div>
            ) : null}
            {report.netWorth.byCategory.length ? (
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">{v.byCategory}</p>
                <BarList
                  items={report.netWorth.byCategory.map((c) => ({
                    key: c.label,
                    label: c.label,
                    value: c.value,
                    valueLabel: vndShort(c.value),
                    share: report.netWorth!.assets > 0 ? c.value / report.netWorth!.assets : 0,
                  }))}
                />
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">{v.snapshot}</p>
    </div>
  );
}
