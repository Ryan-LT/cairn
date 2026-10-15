import type { ExpenseCategoryId } from "@/entities/expense/model";

/**
 * A shared report: a frozen snapshot of chosen numbers, built on the owner's
 * device, encrypted on the server with the link's password, and shown at
 * `/share#<id>` to whoever has both. Only totals are in it, never raw records.
 */

/** Money in / out by month is always included; the rest is chosen per link. */
export const REPORT_SECTIONS = ["cashflow", "categories", "income", "netWorth"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

/** `YYYY-MM` months, inclusive. `all`: from the first record to this month. */
export type ReportPeriod = { from: string; to: string; all: boolean };

export type ReportMonth = { month: string; income: number; spending: number };

export type SharedReport = {
  v: 1;
  title: string;
  /** When the snapshot was taken (ISO). */
  createdAt: string;
  /** Day the numbers run to (`YYYY-MM-DD`); the last month may be partial. */
  asOf: string;
  period: ReportPeriod;
  sections: ReportSection[];
  months: ReportMonth[];
  categories?: { category: ExpenseCategoryId; total: number }[];
  /** Biggest bills, budgets and purchases by name. */
  topItems?: { name: string; category: ExpenseCategoryId | null; total: number }[];
  income?: { sources: { name: string; total: number }[]; other: number };
  netWorth?: {
    /** Month-end net worth inside the period (the current month is today's value). */
    history: { month: string; value: number }[];
    assets: number;
    debts: number;
    netWorth: number;
    /** Assets by category (labels in the owner's language). */
    byCategory: { label: string; value: number }[];
  };
};

/** Share links can last this many days, or never expire (`null`). */
export const SHARE_EXPIRY_DAYS = [7, 30, 90, null] as const;
export type ShareExpiry = (typeof SHARE_EXPIRY_DAYS)[number];

export const SHARE_PASSWORD_MIN = 8;
export const SHARE_PASSWORD_MAX = 200;
export const SHARE_TITLE_MAX = 80;
export const REPORT_MAX_MONTHS = 120;
