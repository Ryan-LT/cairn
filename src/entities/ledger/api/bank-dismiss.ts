"use client";

const HOOK_PREFIX = "hook-";

/**
 * Tell the server webhook entries were deleted (or restored by undo), so no
 * device copies them in again. Best effort: the month's own `dismissed` list
 * covers this device while offline.
 */
export function dismissBankTxns(txnIds: readonly string[], restore = false): void {
  const ids = txnIds.filter((id) => id.startsWith(HOOK_PREFIX)).map((id) => id.slice(HOOK_PREFIX.length));
  if (!ids.length) return;
  void fetch("/api/inbox/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, restore }) }).catch(() => undefined);
}
