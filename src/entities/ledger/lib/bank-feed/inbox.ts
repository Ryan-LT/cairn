import { isActiveInMonth } from "@/entities/expense/lib/schedule";
import type { ExpenseCategoryId, ExpenseItem } from "@/entities/expense/model";
import type { SettingsAsset } from "@/entities/settings-asset/model";

import type { LedgerTxn, TxnSource, WebhookProvider } from "../../model";
import { accountUsdFor, isAccountAsset } from "../balances";
import type { InboxTxn } from "./parse";

/** One row of `GET /api/inbox`. */
export type InboxItem = {
  id: string;
  provider: WebhookProvider;
  receivedAt: string;
  /** The key's default account, if it has one. */
  defaultAccountId: string | null;
  acked: boolean;
  txn: InboxTxn;
};

/** Ledger id of a webhook transaction: the same on every device. */
export const hookTxnId = (inboxId: string) => `hook-${inboxId}`;

/**
 * Where money out counts: the one budget of that category running that
 * month, else unplanned spending (several budgets of one category: unplanned,
 * since there's no telling which).
 */
export function sourceForCategory(category: ExpenseCategoryId | undefined, month: string, items: readonly ExpenseItem[]): TxnSource {
  if (!category) return { type: "instant" };
  const budgets = items.filter((i) => i.kind === "budget" && i.category === category && isActiveInMonth(i, month));
  return budgets.length === 1 ? { type: "budget", itemId: budgets[0].id, month } : { type: "instant" };
}

/** An account by id, exact name, or (bank account numbers) a name containing it. */
export function resolveAccount(hint: string | undefined, assets: readonly SettingsAsset[]): SettingsAsset | undefined {
  if (!hint) return undefined;
  const accounts = assets.filter(isAccountAsset);
  const h = hint.trim().toLowerCase();
  return (
    accounts.find((a) => a.id === hint) ??
    accounts.find((a) => a.name.trim().toLowerCase() === h) ??
    (/^\d{4,}$/.test(h) ? accounts.find((a) => a.name.replace(/\s/g, "").includes(h) || a.name.includes(h.slice(-4))) : undefined)
  );
}

/** One inbox row as a ledger entry. */
export function inboxToTxn(
  item: InboxItem,
  ctx: { items: readonly ExpenseItem[]; assets: readonly SettingsAsset[]; vndPerUsd: number | null },
): LedgerTxn {
  const { txn } = item;
  const month = txn.date.slice(0, 7);
  const source: TxnSource = txn.kind === "income" ? { type: "extra" } : sourceForCategory(txn.category, month, ctx.items);
  const out: LedgerTxn = {
    id: hookTxnId(item.id),
    kind: txn.kind,
    date: txn.date,
    at: txn.at,
    amount: txn.amount,
    source,
    via: { kind: "webhook", provider: item.provider },
  };
  if (txn.title) out.name = txn.title;
  if (source.type === "instant") out.category = txn.category ?? "other";
  if (txn.note) out.note = txn.note;
  const named = resolveAccount(txn.account, ctx.assets);
  const fallback = item.defaultAccountId ? ctx.assets.find((a) => a.id === item.defaultAccountId && isAccountAsset(a)) : undefined;
  const account = named ?? fallback;
  if (account) {
    out.accountId = account.id;
    const usd = accountUsdFor(account, txn.amount, undefined, ctx.vndPerUsd);
    if (usd !== undefined) out.accountUsd = usd;
  }
  return out;
}

/** Inbox rows not in the ledger yet and not deleted by hand, as ledger entries. */
export function planInboxTxns(
  inbox: readonly InboxItem[],
  ctx: {
    items: readonly ExpenseItem[];
    assets: readonly SettingsAsset[];
    vndPerUsd: number | null;
    has: (id: string) => boolean;
    isDismissed: (id: string) => boolean;
  },
): LedgerTxn[] {
  const out: LedgerTxn[] = [];
  for (const item of inbox) {
    const id = hookTxnId(item.id);
    if (ctx.has(id) || ctx.isDismissed(id)) continue;
    out.push(inboxToTxn(item, ctx));
  }
  return out;
}
