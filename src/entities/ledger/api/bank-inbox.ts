"use client";

import { EXPENSES_SEED, type ExpensesDoc } from "@/entities/expense/model";
import { SETTINGS_ASSETS_SEED, type SettingsAsset } from "@/entities/settings-asset/model";
import { backgroundRefetchTables, flushTablesNow, readTable } from "@/shared/storage";

import { planInboxTxns, type InboxItem } from "../lib/bank-feed/inbox";
import { addTxns, allTxns, isDismissed } from "../lib/ops";
import { currentLedger, writeLedger } from "./use-ledger";

/** Fired by "Sync now" so the shell also checks the bank inbox. */
export const BANK_INBOX_SYNC_EVENT = "wt:bank-inbox-sync";

export function requestBankInboxSync(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BANK_INBOX_SYNC_EVENT));
}

async function fetchInbox(scope: "pending" | "recent"): Promise<InboxItem[]> {
  const res = await fetch(`/api/inbox${scope === "pending" ? "?scope=pending" : ""}`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: InboxItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

async function ackInbox(ids: string[]): Promise<void> {
  await fetch("/api/inbox/ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
}

function plan(items: readonly InboxItem[], vndPerUsd: number | null) {
  const tables = currentLedger();
  const known = new Set(allTxns(tables).map((t) => t.id));
  const expenses = readTable<ExpensesDoc | null>("expenses", EXPENSES_SEED);
  const assets = readTable<SettingsAsset[] | null>("settingsAssets", SETTINGS_ASSETS_SEED);
  const txns = planInboxTxns(items, {
    items: Array.isArray(expenses?.items) ? expenses.items : [],
    assets: Array.isArray(assets) ? assets : [],
    vndPerUsd,
    has: (id) => known.has(id),
    isDismissed: (id) => isDismissed(tables, id),
  });
  return { tables, txns };
}

async function run(full: boolean, vndPerUsd: number | null): Promise<number> {
  const items = await fetchInbox(full ? "recent" : "pending");
  if (!items.length) return 0;
  let added = 0;
  if (plan(items, vndPerUsd).txns.length) {
    // Adding rewrites the whole month: take in other devices' newer saves of it first.
    await flushTablesNow();
    await backgroundRefetchTables();
    const { tables, txns } = plan(items, vndPerUsd);
    if (txns.length) {
      writeLedger(addTxns(tables, txns));
      added = txns.length;
      // Not saved (offline): leave them unacknowledged so this or another device tries again.
      if (!(await flushTablesNow())) return added;
    }
  }
  const pending = items.filter((i) => !i.acked).map((i) => i.id);
  if (pending.length) await ackInbox(pending);
  return added;
}

let running: Promise<number> | null = null;

/**
 * Copy webhook transactions into the ledger (ids `hook-…`, skipping any
 * deleted by hand) and acknowledge them. `full`: re-check the last 45 days,
 * which puts back entries an older save from another device dropped.
 * Resolves to how many were added.
 */
export function syncBankInbox({ full, vndPerUsd }: { full: boolean; vndPerUsd: number | null }): Promise<number> {
  running ??= run(full, vndPerUsd)
    .catch(() => 0)
    .finally(() => {
      running = null;
    });
  return running;
}
