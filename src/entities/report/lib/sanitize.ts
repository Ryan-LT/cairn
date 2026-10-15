import { EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from "@/entities/expense/model";
import { isMonthKey } from "@/shared/lib/month";

import { REPORT_MAX_MONTHS, REPORT_SECTIONS, SHARE_TITLE_MAX, type ReportSection, type SharedReport } from "../model";

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e15 ? Math.round(v) : null);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const isCategory = (v: unknown): v is ExpenseCategoryId => (EXPENSE_CATEGORY_IDS as readonly string[]).includes(v as string);

function list<T>(v: unknown, max: number, item: (r: Raw) => T | null): T[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: T[] = [];
  for (const r of v) {
    const x = isRecord(r) ? item(r) : null;
    if (x === null) return null;
    out.push(x);
  }
  return out;
}

/**
 * A report in its exact shape, or `null`. The server checks what the owner's
 * device sent before encrypting it; the viewer checks what it decrypted.
 */
export function sanitizeSharedReport(raw: unknown): SharedReport | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const title = str(raw.title, SHARE_TITLE_MAX);
  const createdAt = typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : null;
  const asOf = typeof raw.asOf === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.asOf) ? raw.asOf : null;
  const p = raw.period;
  const period = isRecord(p) && isMonthKey(p.from) && isMonthKey(p.to) && p.from <= p.to ? { from: p.from, to: p.to, all: p.all === true } : null;
  const sections = Array.isArray(raw.sections)
    ? [...new Set(raw.sections.filter((s): s is ReportSection => (REPORT_SECTIONS as readonly string[]).includes(s as string)))]
    : null;
  const months = list(raw.months, REPORT_MAX_MONTHS, (r) => {
    const income = num(r.income);
    const spending = num(r.spending);
    return isMonthKey(r.month) && income !== null && spending !== null ? { month: r.month, income, spending } : null;
  });
  if (!title || !createdAt || !asOf || !period || !sections?.includes("cashflow") || !months) return null;

  const report: SharedReport = { v: 1, title, createdAt, asOf, period, sections, months };

  if (sections.includes("categories")) {
    const categories = list(raw.categories, EXPENSE_CATEGORY_IDS.length, (r) => {
      const total = num(r.total);
      return isCategory(r.category) && total !== null ? { category: r.category, total } : null;
    });
    const topItems = list(raw.topItems, 10, (r) => {
      const name = str(r.name, 80);
      const total = num(r.total);
      const category = r.category === null ? null : isCategory(r.category) ? r.category : undefined;
      return name && total !== null && category !== undefined ? { name, category, total } : null;
    });
    if (!categories || !topItems) return null;
    report.categories = categories;
    report.topItems = topItems;
  }

  if (sections.includes("income")) {
    const inc = raw.income;
    const sources = isRecord(inc)
      ? list(inc.sources, 50, (r) => {
          const name = str(r.name, 80);
          const total = num(r.total);
          return name && total !== null ? { name, total } : null;
        })
      : null;
    const other = isRecord(inc) ? num(inc.other) : null;
    if (!sources || other === null) return null;
    report.income = { sources, other };
  }

  if (sections.includes("netWorth")) {
    const nw = raw.netWorth;
    if (!isRecord(nw)) return null;
    const history = list(nw.history, REPORT_MAX_MONTHS, (r) => {
      const value = num(r.value);
      return isMonthKey(r.month) && value !== null ? { month: r.month, value } : null;
    });
    const byCategory = list(nw.byCategory, 40, (r) => {
      const label = str(r.label, 60);
      const value = num(r.value);
      return label && value !== null ? { label, value } : null;
    });
    const assets = num(nw.assets);
    const debts = num(nw.debts);
    const netWorth = num(nw.netWorth);
    if (!history || !byCategory || assets === null || debts === null || netWorth === null) return null;
    report.netWorth = { history, assets, debts, netWorth, byCategory };
  }

  return report;
}
