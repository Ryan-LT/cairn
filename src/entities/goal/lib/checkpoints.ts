import type { GoalCheckpoint, GoalProfile } from "@/entities/goal/model";

function parseLocalDay(iso: string): Date | null {
  const day = String(iso).trim().split("T")[0];
  if (!day) return null;
  const d = new Date(`${day}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

type RawCheckpoint = {
  id?: string;
  date?: string;
  amount?: number;
  cumulativeAmount?: number;
  paid?: boolean;
};

/**
 * Normalize checkpoints for storage: each row is an **installment** (`amount`) due on `date`.
 * Older saves used `cumulativeAmount` (running total); those are converted to installments by
 * differencing consecutive rows when sorted by date, only when no explicit positive `amount` exists.
 */
export function normalizeStoredCheckpoints(
  checkpoints: GoalProfile["checkpoints"],
): GoalCheckpoint[] {
  const raw = Array.isArray(checkpoints) ? checkpoints : [];
  const cleaned = raw
    .filter(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        Boolean(String((c as RawCheckpoint).id ?? "").trim()) &&
        String((c as RawCheckpoint).date ?? "").trim() !== "",
    )
    .map((c) => {
      const r = c as RawCheckpoint;
      return {
        id: String(r.id).trim(),
        date: String(r.date).trim().split("T")[0],
        amount: typeof r.amount === "number" ? Math.max(0, Math.floor(r.amount)) : 0,
        paid: r.paid === true,
        legacyCumulative:
          typeof r.cumulativeAmount === "number"
            ? Math.max(0, Math.floor(r.cumulativeAmount))
            : undefined,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const anyExplicitPay = cleaned.some((r) => r.amount > 0);
  const anyLegacy = cleaned.some((r) => (r.legacyCumulative ?? 0) > 0);

  if (anyLegacy && !anyExplicitPay) {
    let prevCumulative = 0;
    let warnedNonMonotonic = false;
    return cleaned.map((r) => {
      const cum = r.legacyCumulative ?? 0;
      const delta = cum - prevCumulative;
      if (delta < 0 && !warnedNonMonotonic) {
        warnedNonMonotonic = true;
        console.warn(
          "[cairn] legacy checkpoint cumulativeAmount is not monotonic; negative delta clamped to 0 during migration",
          { id: r.id, date: r.date, prevCumulative, cumulativeAmount: cum },
        );
      }
      const installment = Math.max(0, delta);
      prevCumulative = cum;
      const row: GoalCheckpoint = { id: r.id, date: r.date, amount: installment };
      if (r.paid) row.paid = true;
      return row;
    });
  }

  return cleaned.map((r) => {
    const row: GoalCheckpoint = { id: r.id, date: r.date, amount: r.amount };
    if (r.paid) row.paid = true;
    return row;
  });
}

/**
 * Build stepped cumulative-due curve: sums installment `amount`s in date order (same calendar day
 * sums first, then cumulative).
 */
export function cumulativeDueScheduleFromCheckpoints(
  checkpoints: GoalCheckpoint[],
): { date: Date; cumulative: number }[] {
  const byTime = new Map<number, { date: Date; sum: number }>();
  for (const c of checkpoints) {
    const d = parseLocalDay(c.date);
    if (!d) continue;
    const k = d.getTime();
    const inc = Math.max(0, Math.floor(Number(c.amount) || 0));
    const prev = byTime.get(k);
    if (prev) prev.sum += inc;
    else byTime.set(k, { date: d, sum: inc });
  }
  const rows = [...byTime.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  let run = 0;
  return rows.map(({ date, sum }) => {
    run += sum;
    return { date, cumulative: run };
  });
}

/** Display order (by date) with installments floored and a running cumulative total. */
export function checkpointsWithRunningTotal(
  checkpoints: GoalCheckpoint[],
): (GoalCheckpoint & { running: number })[] {
  const sorted = [...checkpoints]
    .filter((c) => String(c.date).trim())
    .map((c) => ({
      ...c,
      date: String(c.date).trim().split("T")[0],
      amount: Math.max(0, Math.floor(Number(c.amount) || 0)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  return sorted.map((c) => {
    running += c.amount;
    return { ...c, running };
  });
}

/** Mark one checkpoint paid / unpaid. Unpaid rows drop the `paid` key entirely. */
export function setCheckpointPaid(
  checkpoints: GoalCheckpoint[],
  id: string,
  paid: boolean,
): GoalCheckpoint[] {
  return checkpoints.map((c) => {
    if (c.id !== id) return c;
    if (paid) return { ...c, paid: true };
    return { id: c.id, date: c.date, amount: c.amount };
  });
}

export function createCheckpointId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
