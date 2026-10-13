import { totalAssetValue, type AssetsState } from "@/entities/asset";
import { totalDebtBalance, type Debt } from "@/entities/debt";
import {
  monthlyIncomeByKind,
  totalMonthlyIncomeFromSources,
  type IncomeSource,
} from "@/entities/income";
import { EXPENSES_SEED, resolveMonthlySpending, type ExpensesDoc, type SpendingResolution } from "@/entities/expense";
import {
  estimatedMonthlyNetCashflow,
  legacySpendingEstimate,
  projectNetWorthEndOfYear,
  type Preferences,
} from "@/entities/preferences";
import type { PersonalLoan } from "@/entities/personal-loan";
import { totalSettingsAssetsValue, type SettingsAsset } from "@/entities/settings-asset";

import { personalLoanBalances, totalCombinedAssetValue } from "./net-worth";

export type CashflowSummary = {
  totalIncome: number;
  activeIncome: number;
  passiveIncome: number;
  /** Monthly spending used by every projection (= `spending.total`). */
  averageSpending: number;
  /** Household monthly net used by every projection: income − spending. */
  monthlyNet: number;
  /** How spending is made up (items, debt repayments, the old estimate). */
  spending: SpendingResolution;
};

export type CashflowInput = {
  prefs: Preferences;
  sources: IncomeSource[];
  expenses?: ExpensesDoc;
  debts?: Debt[];
};

export function summarizeCashflow({ prefs, sources, expenses = EXPENSES_SEED, debts = [] }: CashflowInput): CashflowSummary {
  const totalIncome = totalMonthlyIncomeFromSources(sources);
  const spending = resolveMonthlySpending({ expenses, debts, legacyEstimate: legacySpendingEstimate(prefs) });
  return {
    totalIncome,
    activeIncome: monthlyIncomeByKind(sources, "active"),
    passiveIncome: monthlyIncomeByKind(sources, "passive"),
    averageSpending: spending.total,
    monthlyNet: estimatedMonthlyNetCashflow(totalIncome, spending.total),
    spending,
  };
}

export type DashboardSummary = CashflowSummary & {
  grossAssets: number;
  liabilities: number;
  netWorth: number;
  eoyProjection: number;
  /** Legacy portfolio detail (`assets` table). */
  portfolioDetailTotal: number;
  /** Asset catalog (`settingsAssets` table). */
  assetConfigurationTotal: number;
  /** Open personal loans counted in net worth (0 unless the preference is on). */
  loansLent: number;
  loansBorrowed: number;
};

export function computeDashboardSummary(t: {
  assets: AssetsState;
  debts: Debt[];
  settingsAssets: SettingsAsset[];
  incomeSources: IncomeSource[];
  prefs: Preferences;
  personalLoans?: PersonalLoan[];
  expenses?: ExpensesDoc;
}): DashboardSummary {
  const loans = t.prefs.includeLoansInNetWorth ? personalLoanBalances(t.personalLoans) : { lent: 0, borrowed: 0 };
  const grossAssets = totalCombinedAssetValue(t.assets, t.settingsAssets) + loans.lent;
  const liabilities = totalDebtBalance(t.debts) + loans.borrowed;
  const netWorth = grossAssets - liabilities;
  const cashflow = summarizeCashflow({ prefs: t.prefs, sources: t.incomeSources, expenses: t.expenses, debts: t.debts });
  return {
    ...cashflow,
    grossAssets,
    liabilities,
    netWorth,
    eoyProjection: projectNetWorthEndOfYear(netWorth, cashflow.monthlyNet, { principalMonthly: cashflow.spending.debtPrincipal }),
    portfolioDetailTotal: totalAssetValue(t.assets),
    assetConfigurationTotal: totalSettingsAssetsValue(t.settingsAssets),
    loansLent: loans.lent,
    loansBorrowed: loans.borrowed,
  };
}
