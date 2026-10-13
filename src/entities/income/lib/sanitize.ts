import type { GoalProfile } from "@/entities/goal";
import type { IncomeSource } from "@/entities/income/model";
import { wrapIncomeSourceAsProfile } from "@/entities/income/lib/wrap-as-profile";

export function createIncomeSourceDraft(now: number = Date.now()): IncomeSource {
  return {
    id: `income-${now}`,
    kind: "active",
    name: "",
    details: "",
    icon: "work",
    monthly: 0,
    capitalLines: [],
  };
}

/**
 * Persisted shape: trimmed text, non-negative monthly, zero capital lines dropped
 * (and the key omitted when empty), blank entity omitted, payment day kept only in 1–31.
 */
export function sanitizeIncomeSource(draft: IncomeSource): IncomeSource {
  const cleanLines = (draft.capitalLines ?? []).filter(
    (l) => Number.isFinite(l.amount) && l.amount > 0,
  );
  return {
    ...draft,
    name: draft.name.trim(),
    details: draft.details.trim(),
    monthly: Number.isFinite(draft.monthly) ? Math.max(0, draft.monthly) : 0,
    accountId: draft.accountId || undefined,
    autoReceive: draft.autoReceive ? true : undefined,
    autoSince: draft.autoReceive && draft.autoSince ? draft.autoSince : undefined,
    amountUsd: typeof draft.amountUsd === "number" && Number.isFinite(draft.amountUsd) && draft.amountUsd > 0 ? Math.round(draft.amountUsd * 100) / 100 : undefined,
    capitalLines: cleanLines.length > 0 ? cleanLines : undefined,
    paymentEntity:
      draft.paymentEntity?.trim() === "" ? undefined : draft.paymentEntity?.trim(),
    paymentDay:
      draft.paymentDay !== undefined &&
      draft.paymentDay !== null &&
      draft.paymentDay >= 1 &&
      draft.paymentDay <= 31
        ? draft.paymentDay
        : undefined,
  };
}

/** Other income sources wrapped as plans so capital caps subtract their reservations. */
export function incomeCapitalPeers(sources: IncomeSource[], editingId: string): GoalProfile[] {
  return sources.filter((s) => s.id !== editingId).map(wrapIncomeSourceAsProfile);
}
