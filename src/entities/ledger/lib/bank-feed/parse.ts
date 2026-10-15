import { EXPENSE_CATEGORY_IDS, type ExpenseCategoryId } from "@/entities/expense/model";
import { parseVnDateTime, vnDay } from "@/shared/lib/vn-time";

import type { TxnKind, WebhookProvider } from "../../model";
import { guessCategory } from "./guess-category";

/** A bank transaction as the webhook stores it, before the app turns it into a ledger entry. */
export type InboxTxn = {
  kind: TxnKind;
  /** VND, above 0. */
  amount: number;
  /** `YYYY-MM-DD` in Vietnam. */
  date: string;
  /** When it happened (ISO). */
  at: string;
  title?: string;
  note?: string;
  category?: ExpenseCategoryId;
  /** Asset id or name the payload named (SePay / Casso: the bank account number). */
  account?: string;
};

export type ParsedItem = { ref: string | null; txn: InboxTxn };

export type ParseError = "invalid_body" | "invalid_item" | "too_many";

export type ParseResult =
  | { ok: true; provider: WebhookProvider; items: ParsedItem[] }
  | { ok: false; code: ParseError; message: string; index?: number };

export const MAX_BATCH = 100;
const MAX_AMOUNT = 1e13;
/** Dates further back than this, or in the future past tomorrow, are refused. */
const MAX_AGE_DAYS = 400;

type Raw = Record<string, unknown>;

function isRecord(v: unknown): v is Raw {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function text(v: unknown, max: number): string | undefined {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
  return s || undefined;
}

/**
 * A signed amount: a number, or a string such as "-50000", "50.000",
 * "1,250,000" or "12.5". VND has no cents, so it's rounded.
 */
export function parseAmount(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const s = v.replace(/[\s₫đ]|vn[dđ]/gi, "");
    if (/^[+-]?\d{1,3}([.,]\d{3})+$/.test(s)) n = Number(s.replace(/[.,]/g, ""));
    else if (/^[+-]?\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) n = Number(s.replace(/,/g, ""));
    else if (/^[+-]?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) n = Number(s.replace(/\./g, "").replace(",", "."));
    else if (/^[+-]?\d+([.,]\d{1,2})?$/.test(s)) n = Number(s.replace(",", "."));
    else return null;
  } else return null;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return Math.abs(rounded) > MAX_AMOUNT ? null : rounded;
}

function when(value: unknown, now: Date): { date: string; at: string } | null {
  if (value === undefined || value === null || value === "") return { date: vnDay(now), at: now.toISOString() };
  const parsed = parseVnDateTime(value);
  if (!parsed) return null;
  const age = (now.getTime() - parsed.at.getTime()) / 86_400_000;
  if (age > MAX_AGE_DAYS || age < -1.5) return null;
  const date = vnDay(parsed.at);
  // A bare day that is today: it happened by now, not at noon.
  const at = parsed.dayOnly && date === vnDay(now) ? now.toISOString() : parsed.at.toISOString();
  return { date, at };
}

function category(explicit: unknown, kind: TxnKind, ...texts: (string | undefined)[]): ExpenseCategoryId | undefined {
  if (kind !== "expense") return undefined;
  if (typeof explicit === "string" && (EXPENSE_CATEGORY_IDS as readonly string[]).includes(explicit)) return explicit as ExpenseCategoryId;
  return guessCategory(texts.filter(Boolean).join(" ")) ?? undefined;
}

function build(input: {
  signed: number;
  kind?: TxnKind;
  when: { date: string; at: string };
  title?: string;
  note?: string;
  category?: unknown;
  account?: string;
}): InboxTxn | null {
  const amount = Math.abs(input.signed);
  if (amount === 0) return null;
  const kind = input.kind ?? (input.signed < 0 ? "expense" : "income");
  const txn: InboxTxn = { kind, amount, date: input.when.date, at: input.when.at };
  if (input.title) txn.title = input.title;
  if (input.note && input.note !== input.title) txn.note = input.note;
  const cat = category(input.category, kind, input.title, input.note);
  if (cat) txn.category = cat;
  if (input.account) txn.account = input.account;
  return txn;
}

const ref = (...values: unknown[]): string | null => {
  for (const v of values) {
    const s = text(v, 100);
    if (s) return s;
  }
  return null;
};

function directionOf(v: unknown): TxnKind | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (["in", "income", "credit", "deposit", "tang", "thu"].includes(s)) return "income";
  if (["out", "expense", "debit", "withdraw", "giam", "chi"].includes(s)) return "expense";
  return undefined;
}

/** `{ title, amount, type?, date?, id?, category?, note?, account? }`; a negative amount (or `type: "out"`) is money out. */
function genericItem(raw: unknown, now: Date): ParsedItem | null {
  if (!isRecord(raw)) return null;
  const signed = parseAmount(raw.amount);
  const w = when(raw.date ?? raw.time ?? raw.at, now);
  if (signed === null || !w) return null;
  const typed = raw.type ?? raw.direction;
  const kind = directionOf(typed);
  if (typed !== undefined && typed !== null && typed !== "" && !kind) return null;
  const txn = build({
    signed,
    kind,
    when: w,
    title: text(raw.title ?? raw.name ?? raw.description, 80),
    note: text(raw.note, 200),
    category: raw.category,
    account: text(raw.account ?? raw.accountId, 80),
  });
  return txn ? { ref: ref(raw.id, raw.ref, raw.reference), txn } : null;
}

/** SePay: https://docs.sepay.vn/tich-hop-webhooks.html */
function sepayItem(raw: Raw, now: Date): ParsedItem | null {
  const amount = parseAmount(raw.transferAmount);
  const kind = raw.transferType === "in" ? "income" : raw.transferType === "out" ? "expense" : undefined;
  const w = when(raw.transactionDate, now);
  if (amount === null || !kind || !w) return null;
  const content = text(raw.content, 200) ?? text(raw.description, 200);
  const txn = build({
    signed: Math.abs(amount),
    kind,
    when: w,
    title: content?.slice(0, 80) ?? text(raw.gateway, 80),
    note: [text(raw.gateway, 40), text(raw.referenceCode, 60)].filter(Boolean).join(" · ") || undefined,
    account: text(raw.accountNumber, 40),
  });
  return txn ? { ref: ref(raw.id, raw.referenceCode), txn } : null;
}

/** Casso v1 (`when`, `tid`) and v2 (`transactionDateTime`, `reference`): amount is signed. */
function cassoItem(raw: unknown, now: Date): ParsedItem | null {
  if (!isRecord(raw)) return null;
  const signed = parseAmount(raw.amount);
  const w = when(raw.transactionDateTime ?? raw.when, now);
  if (signed === null || !w) return null;
  const description = text(raw.description, 200);
  const txn = build({
    signed,
    when: w,
    title: description?.slice(0, 80) ?? text(raw.bankName, 80),
    note: text(raw.bankName ?? raw.bankAbbreviation, 60),
    account: text(raw.accountNumber ?? raw.bank_sub_acc_id ?? raw.subAccId, 40),
  });
  return txn ? { ref: ref(raw.tid, raw.reference, raw.id), txn } : null;
}

function detect(body: unknown): { provider: WebhookProvider; items: unknown[] } | null {
  if (Array.isArray(body)) return { provider: "generic", items: body };
  if (!isRecord(body)) return null;
  if ("transferType" in body && "transferAmount" in body) return { provider: "sepay", items: [body] };
  if ("data" in body && ("error" in body || isRecord(body.data) || Array.isArray(body.data))) {
    const data = body.data;
    const items = Array.isArray(data) ? data : isRecord(data) ? [data] : null;
    if (items && items.every((d) => isRecord(d) && ("when" in d || "transactionDateTime" in d || "tid" in d))) return { provider: "casso", items };
  }
  if (Array.isArray(body.transactions)) return { provider: "generic", items: body.transactions };
  if ("amount" in body) return { provider: "generic", items: [body] };
  return null;
}

/** Read a webhook body in any supported format into normalized transactions. Pure. */
export function parseWebhookBody(body: unknown, now: Date = new Date()): ParseResult {
  const found = detect(body);
  if (!found) return { ok: false, code: "invalid_body", message: "Unrecognized payload: send { title, amount, type, date } or a SePay / Casso webhook" };
  if (found.items.length === 0) return { ok: true, provider: found.provider, items: [] };
  if (found.items.length > MAX_BATCH) return { ok: false, code: "too_many", message: `At most ${MAX_BATCH} transactions per request` };
  const items: ParsedItem[] = [];
  for (let i = 0; i < found.items.length; i++) {
    const raw = found.items[i];
    const item = found.provider === "sepay" ? sepayItem(raw as Raw, now) : found.provider === "casso" ? cassoItem(raw, now) : genericItem(raw, now);
    if (!item) {
      return {
        ok: false,
        code: "invalid_item",
        index: i,
        message: `Transaction ${i + 1}: needs a non-zero amount, a valid type ("in" / "out") and a date within the last ${MAX_AGE_DAYS} days`,
      };
    }
    items.push(item);
  }
  return { ok: true, provider: found.provider, items };
}
