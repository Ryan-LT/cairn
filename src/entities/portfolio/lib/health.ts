import type { AssetsState } from "@/entities/asset";
import { totalMonthlyInterest, type Debt } from "@/entities/debt";
import { resolveSettingsAssetLiquidity, type SettingsAsset } from "@/entities/settings-asset";
import { monthsToReach } from "@/shared/lib/growth";

import type { DashboardSummary } from "./summary";

/** Yearly spending × 25: the portfolio a 4 % yearly withdrawal could sustain. */
export const FI_MULTIPLE = 25;

export type FinancialHealth = {
  /** Cash accounts + instant-access catalog assets (live values). */
  instantAssets: number;
  /** Months the instant-access money covers total spending (debt repayments included); `null` without spending. */
  emergencyMonths: number | null;
  /** Share (0–1) of gross assets that is instant access; `null` without assets. */
  liquidShare: number | null;
  /** Debts ÷ gross assets; `null` without assets. */
  debtToAssets: number | null;
  /** Interest accruing per month across debts. */
  monthlyInterest: number;
  /** Passive income ÷ living costs (spending without debt repayments); `null` without spending. */
  passiveCoverage: number | null;
  /** Financial-independence number: yearly living costs × 25 (debts end, living costs don't); `null` without spending. */
  fiNumber: number | null;
  /** Net worth ÷ FI number (0–1+); `null` without spending. */
  fiProgress: number | null;
  /** Years until net worth reaches the FI number at the current monthly net and real return; `null` if never / unknown. */
  yearsToFi: number | null;
};

/** Instant-access money: cash accounts plus catalog assets tagged instant. */
export function instantAccessAssets(assets: AssetsState, catalog: SettingsAsset[]): number {
  const cash = assets.cashAccounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const instant = catalog
    .filter((a) => resolveSettingsAssetLiquidity(a.liquidity) === "instant")
    .reduce((s, a) => s + Math.max(0, a.currentValue), 0);
  return cash + instant;
}

export function computeFinancialHealth(t: {
  summary: DashboardSummary;
  assets: AssetsState;
  settingsAssets: SettingsAsset[];
  debts: Debt[];
  /** Yearly real return (fraction) used for the years-to-FI estimate. */
  annualRealRate?: number;
}): FinancialHealth {
  const { summary } = t;
  const spending = summary.averageSpending;
  const living = summary.spending.living;
  const instantAssets = instantAccessAssets(t.assets, t.settingsAssets);
  const gross = summary.grossAssets;
  const fiNumber = living > 0 ? living * 12 * FI_MULTIPLE : null;

  let yearsToFi: number | null = null;
  if (fiNumber !== null) {
    const months = monthsToReach(Math.max(0, summary.netWorth), summary.monthlyNet, fiNumber, t.annualRealRate ?? 0);
    yearsToFi = Number.isFinite(months) && months <= 1200 ? months / 12 : null;
  }

  return {
    instantAssets,
    emergencyMonths: spending > 0 ? instantAssets / spending : null,
    liquidShare: gross > 0 ? instantAssets / gross : null,
    debtToAssets: gross > 0 ? summary.liabilities / gross : null,
    monthlyInterest: totalMonthlyInterest(t.debts),
    passiveCoverage: living > 0 ? summary.passiveIncome / living : null,
    fiNumber,
    fiProgress: fiNumber !== null ? Math.max(0, summary.netWorth) / fiNumber : null,
    yearsToFi,
  };
}
