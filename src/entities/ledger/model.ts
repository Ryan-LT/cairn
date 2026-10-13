import type { ExpenseCategoryId } from "@/entities/expense/model";

/**
 * The ledger ("sổ thu chi"): money that actually went out or came in, one
 * record per payment. Bills ticked off, money spent from a budget, unplanned
 * spending and income received all land here, so the history pages can list
 * them and an account (an asset) can follow them.
 *
 * Stored one table per calendar month of `date` (`ledger:2026-10`).
 */

export type TxnSource =
  /** A bill's payment, for its occurrence in `month` (it may be paid a few days early or late). */
  | { type: "bill"; itemId: string; month: string }
  /** Spending from a budget in `month`. */
  | { type: "budget"; itemId: string; month: string }
  /** Spent on the spot, outside the plan. */
  | { type: "instant" }
  /** An income source's payment for `month`. */
  | { type: "income"; sourceId: string; month: string }
  /** Money in that isn't one of the income sources (a bonus, a gift, a refund). */
  | { type: "extra" };

export type TxnKind = "expense" | "income";

export type LedgerTxn = {
  id: string;
  kind: TxnKind;
  /** `YYYY-MM-DD` it happened. */
  date: string;
  /** When it was recorded (ISO); orders a day's entries and decides whether an account already counted it. */
  at: string;
  /** VND, above 0. A budget correction may be negative (it takes spending back). */
  amount: number;
  /** Entered in US dollars: the dollar amount (VND is at that day's rate). */
  amountUsd?: number;
  source: TxnSource;
  /** Own label; bill, budget and income payments show their item's name when unset. */
  name?: string;
  /** Spending category (instant spending; planned spending uses its item's). */
  category?: ExpenseCategoryId;
  note?: string;
  /** Asset (account) the money left or went into. */
  accountId?: string;
  /** Posted to an account held in USD: the dollars it moved (fixed when recorded). */
  accountUsd?: number;
  /** Created by the schedule (autopay bills, automatic income), not by hand. */
  auto?: boolean;
  /** Carried over from the old month log; a budget's carried total is the month's sum, not one purchase. */
  legacy?: boolean;
  /** A budget total corrected by hand ("set what I spent"). */
  correction?: boolean;
  /** First amount before any adjustment, and when it was last adjusted (ISO). */
  originalAmount?: number;
  editedAt?: string;
};

export type LedgerMonth = {
  txns: LedgerTxn[];
  /** Automatic or carried-over entries removed by hand: never recreate them. */
  dismissed?: string[];
};

export const LEDGER_MONTH_SEED: LedgerMonth = { txns: [] };
