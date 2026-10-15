import type { ExpenseCategoryId, ExpenseItem } from "@/entities/expense/model";
import type { IncomeSource } from "@/entities/income/model";
import type { LedgerTxn } from "@/entities/ledger/model";
import type { NetWorthMonthSnapshot } from "@/entities/preferences/model";
import { addMonths, isMonthKey } from "@/shared/lib/month";

import { REPORT_MAX_MONTHS, type ReportPeriod, type ReportSection, type SharedReport } from "../model";

const TOP_ITEMS = 10;

export type ReportInput = {
  title: string;
  /** `all`, or a from–to month range (clamped to this month). */
  period: { all: true } | { all: false; from: string; to: string };
  sections: readonly ReportSection[];
  /** `YYYY-MM-DD`. */
  today: string;
  now: string;
  txns: readonly LedgerTxn[];
  items: readonly ExpenseItem[];
  sources: readonly IncomeSource[];
  netWorth: {
    history: readonly NetWorthMonthSnapshot[];
    assets: number;
    debts: number;
    netWorth: number;
    byCategory: readonly { label: string; value: number }[];
  };
};

/** The months a report covers: a range clamped to this month and at most 10 years, or everything recorded. */
export function resolvePeriod(input: Pick<ReportInput, "period" | "today" | "txns" | "netWorth" | "sections">): ReportPeriod {
  const current = input.today.slice(0, 7);
  let from: string;
  let to: string;
  if (input.period.all) {
    const firsts = input.txns.map((t) => t.date.slice(0, 7));
    if (input.sections.includes("netWorth")) firsts.push(...input.netWorth.history.map((h) => h.monthKey).filter(isMonthKey));
    from = firsts.reduce((a, b) => (b < a ? b : a), current);
    to = current;
  } else {
    to = isMonthKey(input.period.to) && input.period.to < current ? input.period.to : current;
    from = isMonthKey(input.period.from) && input.period.from <= to ? input.period.from : to;
  }
  const earliest = addMonths(to, -(REPORT_MAX_MONTHS - 1));
  if (from < earliest) from = earliest;
  return { from, to, all: input.period.all };
}

function monthList(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < REPORT_MAX_MONTHS; m = addMonths(m, 1)) out.push(m);
  return out;
}

const byTotalDesc = <T extends { total: number }>(a: T, b: T) => b.total - a.total;

/** A frozen report from the owner's data. Pure: only the chosen sections are filled in. */
export function buildSharedReport(input: ReportInput): SharedReport {
  const sections: ReportSection[] = ["cashflow", ...input.sections.filter((s) => s !== "cashflow")];
  const period = resolvePeriod({ ...input, sections });
  const months = monthList(period.from, period.to);
  const inRange = (date: string) => date.slice(0, 7) >= period.from && date.slice(0, 7) <= period.to && date <= input.today;
  const txns = input.txns.filter((t) => inRange(t.date));
  const itemById = new Map(input.items.map((i) => [i.id, i]));

  const perMonth = new Map(months.map((m) => [m, { month: m, income: 0, spending: 0 }]));
  const categories = new Map<ExpenseCategoryId, number>();
  const named = new Map<string, { name: string; category: ExpenseCategoryId | null; total: number }>();
  const bySource = new Map<string, number>();
  let otherIncome = 0;

  for (const t of txns) {
    const row = perMonth.get(t.date.slice(0, 7));
    if (!row) continue;
    if (t.kind === "income") {
      row.income += t.amount;
      if (t.source.type === "income") bySource.set(t.source.sourceId, (bySource.get(t.source.sourceId) ?? 0) + t.amount);
      else otherIncome += t.amount;
      continue;
    }
    row.spending += t.amount;
    const src = t.source;
    const item = src.type === "bill" || src.type === "budget" ? itemById.get(src.itemId) : undefined;
    const category: ExpenseCategoryId = t.category ?? item?.category ?? "other";
    categories.set(category, (categories.get(category) ?? 0) + t.amount);
    // Bills and budgets add up under their own name; other spending under its label.
    const name = (item?.name ?? t.name)?.trim();
    if (name) {
      const key = `${category}:${name.toLowerCase()}`;
      const entry = named.get(key) ?? { name, category, total: 0 };
      entry.total += t.amount;
      named.set(key, entry);
    }
  }

  const report: SharedReport = {
    v: 1,
    title: input.title.trim(),
    createdAt: input.now,
    asOf: input.today,
    period,
    sections,
    months: [...perMonth.values()],
  };

  if (sections.includes("categories")) {
    report.categories = [...categories].map(([category, total]) => ({ category, total })).filter((c) => c.total > 0).sort(byTotalDesc);
    report.topItems = [...named.values()].filter((n) => n.total > 0).sort(byTotalDesc).slice(0, TOP_ITEMS);
  }

  if (sections.includes("income")) {
    const sourceById = new Map(input.sources.map((s) => [s.id, s]));
    const list: { name: string; total: number }[] = [];
    for (const [id, total] of bySource) {
      const source = sourceById.get(id);
      if (source?.name.trim()) list.push({ name: source.name.trim(), total });
      else otherIncome += total;
    }
    report.income = { sources: list.filter((s) => s.total > 0).sort(byTotalDesc), other: otherIncome };
  }

  if (sections.includes("netWorth")) {
    const nw = input.netWorth;
    const current = input.today.slice(0, 7);
    const history = nw.history
      .filter((h) => isMonthKey(h.monthKey) && h.monthKey >= period.from && h.monthKey <= period.to && h.monthKey !== current && Number.isFinite(h.value))
      .map((h) => ({ month: h.monthKey, value: Math.round(h.value) }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));
    if (period.to === current) history.push({ month: current, value: Math.round(nw.netWorth) });
    report.netWorth = {
      history,
      assets: Math.round(nw.assets),
      debts: Math.round(nw.debts),
      netWorth: Math.round(nw.netWorth),
      byCategory: nw.byCategory.filter((c) => c.value > 0).map((c) => ({ label: c.label, value: Math.round(c.value) })).sort((a, b) => b.value - a.value),
    };
  }

  return report;
}

/** Totals over the report's months. */
export function reportTotals(report: Pick<SharedReport, "months">): { income: number; spending: number; net: number; savingsRate: number | null; monthlySpending: number } {
  const income = report.months.reduce((s, m) => s + m.income, 0);
  const spending = report.months.reduce((s, m) => s + m.spending, 0);
  const net = income - spending;
  return {
    income,
    spending,
    net,
    savingsRate: income > 0 ? net / income : null,
    monthlySpending: report.months.length ? spending / report.months.length : 0,
  };
}
