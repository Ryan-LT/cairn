import type { AuditAction, AuditEntityType, AuditFieldChange } from "@/shared/lib/audit-diff";

/** One change-log row as `GET /api/activity` returns it. */
export type ActivityEntry = {
  id: string;
  /** ISO timestamp of the save. */
  at: string;
  batchId: string;
  table: string;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string | null;
  action: AuditAction;
  changes: AuditFieldChange[] | null;
  before: unknown;
  after: unknown;
};

/** Filter chips → the record kinds each one shows (empty: everything). */
export const ACTIVITY_FILTERS = {
  all: [],
  spending: ["expense", "expense_month", "spending_estimate"],
  income: ["income_source"],
  assets: ["asset", "legacy_real_estate", "legacy_cash", "legacy_investment"],
  debts: ["debt"],
  loans: ["personal_loan"],
  goals: ["goal_plan", "goal_primary"],
  settings: ["settings"],
} as const satisfies Record<string, readonly AuditEntityType[]>;
export type ActivityFilter = keyof typeof ACTIVITY_FILTERS;

const MONEY_FIELDS = new Set([
  "amount",
  "balance",
  "monthlyPayment",
  "currentValue",
  "monthly",
  "targetAmount",
  "spent",
  "planned",
  "averageMonthlySpending",
  "monthOutflow",
  "monthInflow",
  "netMonthIncome",
  "estValue",
  "value",
  "saved",
]);
const PERCENT_FIELDS = new Set(["ratePct", "yieldPct", "monthlySharePct", "expectedReturnPct"]);
/** Lists of `{ amount }` lines shown as their total. */
const MONEY_LIST_FIELDS = new Set(["seedLines", "capitalLines"]);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}(T|$)/;

/** How to show one field value; the page turns it into text with the active language. */
export type ValueView =
  | { kind: "empty" }
  | { kind: "money"; amount: number }
  | { kind: "usd"; amount: number }
  | { kind: "percent"; value: number }
  | { kind: "number"; value: number }
  | { kind: "date"; iso: string }
  | { kind: "bool"; value: boolean }
  | { kind: "payments"; total: number; count: number }
  | { kind: "moneyList"; total: number; count: number }
  | { kind: "count"; count: number }
  | { kind: "category"; id: string }
  | { kind: "frequency"; id: string }
  | { kind: "expenseKind"; id: string }
  | { kind: "rateKind"; id: string }
  | { kind: "goldProduct"; id: string }
  | { kind: "weightUnit"; id: string }
  | { kind: "holdingKind"; id: string }
  | { kind: "goldBasis"; id: string }
  | { kind: "text"; text: string };

const sumAmounts = (list: unknown[]) =>
  list.reduce<number>((s, r) => s + (r && typeof r === "object" && typeof (r as { amount?: unknown }).amount === "number" ? (r as { amount: number }).amount : 0), 0);

export function valueView(field: string, value: unknown): ValueView {
  if (value === null || value === undefined || value === "") return { kind: "empty" };
  if (Array.isArray(value)) {
    if (field === "payments") return { kind: "payments", total: sumAmounts(value), count: value.length };
    if (MONEY_LIST_FIELDS.has(field)) return { kind: "moneyList", total: sumAmounts(value), count: value.length };
    if (value.every((v) => typeof v === "string")) return value.length ? { kind: "text", text: value.join(", ") } : { kind: "empty" };
    return { kind: "count", count: value.length };
  }
  if (typeof value === "boolean") return { kind: "bool", value };
  if (typeof value === "number") {
    if (field === "milestone.targetUsd" || field === "amountUsd" || field === "holding.amount") return { kind: "usd", amount: value };
    if (MONEY_FIELDS.has(field)) return { kind: "money", amount: value };
    if (PERCENT_FIELDS.has(field)) return { kind: "percent", value };
    return { kind: "number", value };
  }
  if (typeof value === "string") {
    if (ISO_DAY.test(value)) return { kind: "date", iso: value };
    if (field === "category") return { kind: "category", id: value };
    if (field === "frequency") return { kind: "frequency", id: value };
    if (field === "kind" && (value === "bill" || value === "budget")) return { kind: "expenseKind", id: value };
    if (field === "rateKind" && (value === "Fixed" || value === "Variable")) return { kind: "rateKind", id: value };
    if (field === "holding.product") return { kind: "goldProduct", id: value };
    if (field === "holding.unit") return { kind: "weightUnit", id: value };
    if (field === "holding.kind") return { kind: "holdingKind", id: value };
    if (field === "currency.goldBasis") return { kind: "goldBasis", id: value };
    return { kind: "text", text: value };
  }
  // Own gold prices: how many products have one.
  if (field === "currency.goldPrices" && typeof value === "object") return { kind: "count", count: Object.keys(value as object).length };
  const json = JSON.stringify(value);
  return { kind: "text", text: json.length > 80 ? `${json.slice(0, 77)}…` : json };
}

/** `2026-10:itemId` → its month and bill. */
export function splitMonthId(entityId: string): { month: string; itemId: string } {
  const i = entityId.indexOf(":");
  return i < 0 ? { month: "", itemId: entityId } : { month: entityId.slice(0, i), itemId: entityId.slice(i + 1) };
}

/** What a month's check-off now says (or said, when removed). */
export function monthSummary(entry: Pick<ActivityEntry, "action" | "before" | "after">): {
  paid?: { total: number; count: number };
  spent?: number;
  skipped?: boolean;
} {
  const v = (entry.action === "remove" ? entry.before : entry.after) as Record<string, unknown> | null;
  if (!v || typeof v !== "object") return {};
  const out: ReturnType<typeof monthSummary> = {};
  if (Array.isArray(v.payments) && v.payments.length) out.paid = { total: sumAmounts(v.payments), count: v.payments.length };
  if (typeof v.spent === "number") out.spent = v.spent;
  if (v.skipped === true) out.skipped = true;
  return out;
}

/** The headline amount of an added / removed record (its value, balance, amount…). */
export function headlineAmount(entry: Pick<ActivityEntry, "action" | "before" | "after">): number | null {
  const v = (entry.action === "remove" ? entry.before : entry.after) as Record<string, unknown> | null;
  if (!v || typeof v !== "object") return null;
  for (const f of ["amount", "currentValue", "balance", "monthly", "targetAmount", "estValue", "value"]) {
    if (typeof v[f] === "number") return v[f] as number;
  }
  return null;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type DayGroup<T> = { day: string; when: "today" | "yesterday" | "earlier"; entries: T[] };

/** Entries (newest first) grouped by local calendar day. */
export function groupByDay<T extends { at: string }>(entries: T[], now: Date): DayGroup<T>[] {
  const today = localDayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = localDayKey(y);
  const groups: DayGroup<T>[] = [];
  for (const e of entries) {
    const day = localDayKey(new Date(e.at));
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      g = { day, when: day === today ? "today" : day === yesterday ? "yesterday" : "earlier", entries: [] };
      groups.push(g);
    }
    g.entries.push(e);
  }
  return groups;
}
