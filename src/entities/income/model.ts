import type { GoalSeedLine } from "@/entities/goal";

export type IncomeSourceKind = "active" | "passive";

export type IncomeSource = {
  id: string;
  kind: IncomeSourceKind;
  name: string;
  details: string;
  icon: string;
  monthly: number;
  /**
   * Paid in US dollars: the monthly amount in USD. `monthly` then follows
   * today's rate (see `useIncomeSources`) and keeps the VND at the last save.
   */
  amountUsd?: number;
  /** Day-of-month (1-31) the payment lands. */
  paymentDay?: number;
  paymentEntity?: string;
  /**
   * Capital (principal) backing this income — modelled as allocations from
   * specific assets, the same way goal starting balances are. Each line points
   * at an asset (via `sourceKey`) or `"custom"` for free-form amounts. Mainly
   * meaningful for passive sources (deposits, bonds, dividend portfolios) where
   * the holder has put money in to earn the monthly return.
   *
   * Reservations here are tracked independently of goal seed lines; they do
   * NOT compete with goal headroom. See Liquidity & commitments for the
   * collapsed-across-sources view.
   */
  capitalLines?: GoalSeedLine[];
};

export const INCOME_SOURCES_SEED: IncomeSource[] = [];
