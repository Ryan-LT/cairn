import type { CurrencyPrefs } from "@/shared/lib/currency/rates";

/** Monthly net worth snapshots for charts / rollover ({@link syncNetWorthTracking}). */
export type NetWorthMonthSnapshot = {
  monthKey: string;
  value: number;
};

/** Liquidity-band visibility for the allocations matrix switcher. */
export type AllocationsBandFilter = "both" | "instant" | "not_instant";

/**
 * Persisted column sort for the allocations Source × plan matrix.
 * `null` = default order (instant access first, then source name A–Z).
 */
export type AllocationsMatrixColumnSort =
  | null
  | { kind: "source"; dir: "asc" | "desc" }
  | { kind: "reserved"; dir: "asc" | "desc" }
  | { kind: "live"; dir: "asc" | "desc" }
  | { kind: "pool"; dir: "asc" | "desc" }
  | { kind: "plan"; planId: string; dir: "asc" | "desc" };

export type Preferences = {
  /** Net income fallback when month inflow/outflow are unset. */
  netMonthIncome: number;
  /** Inflow / outflow for resolved monthly cash flow when both are set. */
  monthInflow: number;
  /** @deprecated Prefer {@link averageMonthlySpending}; kept in sync on write. */
  monthOutflow: number;
  /** Average monthly living expenses (settings → household cash flow). */
  averageMonthlySpending?: number;

  /** Calendar month key `YYYY-MM` aligned with MTD net-worth baseline. */
  netWorthMonthKey?: string;
  /** Net worth at MTD baseline (month rollover or first visit). */
  netWorthMonthBaseline?: number;
  /** Last recorded net worth (used when the calendar month rolls over). */
  lastKnownNetWorth?: number;
  /** Rolling closes used by the dashboard sparkline (latest entries retained). */
  netWorthMonthlyHistory?: NetWorthMonthSnapshot[];

  /** User-defined asset category labels (merged with built-in defaults in the UI). */
  extraAssetCategories?: string[];

  /** Liquidity-band visibility on the allocations matrix; defaults to `"both"`. */
  allocationsBandFilter?: AllocationsBandFilter;
  /** Column sort on the allocations matrix; `null`/unset = default order. */
  allocationsMatrixColumnSort?: AllocationsMatrixColumnSort;

  /**
   * Count open personal loans in net worth: money you lent out as an asset,
   * money you borrowed as a debt. Off by default (the loan log is informal).
   */
  includeLoansInNetWorth?: boolean;

  /** Chosen language; follows the person to other devices (the device cookie is set from it). */
  locale?: "en" | "vi";

  /** First-run setup guide: dismissed, and "I have no debts" (that step counts as done). */
  setup?: { dismissedAt?: string; noDebts?: boolean };

  /** Display currency, own USD rate / gold prices, and the gold valuation basis. */
  currency?: CurrencyPrefs;

  /** Net-worth milestone (dashboard card, Settings → Milestone goal): birth date, USD target and age. */
  milestone?: {
    /** `YYYY-MM-DD`. */
    birthDate?: string;
    targetUsd?: number;
    targetAge?: number;
  };
};

export const PREFERENCES_SEED: Preferences = {
  netMonthIncome: 0,
  monthInflow: 0,
  monthOutflow: 0,
};
