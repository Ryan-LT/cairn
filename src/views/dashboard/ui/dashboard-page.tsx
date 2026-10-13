"use client";

import { CalendarRange, Droplets, Landmark, Wallet } from "lucide-react";
import { useEffect, useMemo } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { DEBTS_SEED } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { buildGoalPlanSummaries, buildGoalStartingOptions, GOALS_SEED } from "@/entities/goal";
import { INCOME_SOURCES_SEED } from "@/entities/income";
import { useMilestoneConfig } from "@/entities/milestone/api/use-milestone-config";
import { PERSONAL_LOANS_SEED, type PersonalLoan } from "@/entities/personal-loan";
import {
  assetTotalsByCategory,
  buildAllocationReportForTables,
  computeDashboardSummary,
  computeFinancialHealth,
} from "@/entities/portfolio";
import {
  monthToDateNetWorthChangePercent,
  netWorthTrackingUnchanged,
  PREFERENCES_SEED,
  syncNetWorthTracking,
} from "@/entities/preferences";
import { SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import { useI18n } from "@/shared/i18n";
import { formatDate, formatPercent } from "@/shared/lib/format";
import { useInitialLoadDone, useTable } from "@/shared/storage";
import { Money } from "@/shared/ui/money";
import { PageHeader } from "@/shared/ui/page-header";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { StatusBadge } from "@/shared/ui/status-badge";
import { PageContainer } from "@/widgets/app-shell";

import { AllocationCard } from "./allocation-card";
import { BalanceSheetCard } from "./balance-sheet-card";
import { CashflowCard } from "./cashflow-card";
import { FinancialHealthCard } from "./financial-health-card";
import { GoalPlansCard } from "./goal-plans-card";
import { MilestoneCard } from "./milestone-card";
import { NetWorthTrendCard } from "./net-worth-trend-card";

export function DashboardPage() {
  const { t } = useI18n();
  const k = t.dashboard.kpi;
  const initialLoadDone = useInitialLoadDone();
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [debts] = useTable("debts", DEBTS_SEED);
  const [settingsAssets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [incomeSources] = useTable("incomeSources", INCOME_SOURCES_SEED);
  const [goals, setGoals] = useTable("goals", GOALS_SEED);
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const [personalLoans] = useTable<PersonalLoan[]>("personalLoans", PERSONAL_LOANS_SEED);
  const { expenses } = useExpenses();
  const milestoneConfig = useMilestoneConfig();
  const annualRealRate = milestoneConfig.config?.annualRealRate ?? 0;

  const summary = useMemo(
    () => computeDashboardSummary({ assets, debts, settingsAssets, incomeSources, prefs, personalLoans, expenses }),
    [assets, debts, settingsAssets, incomeSources, prefs, personalLoans, expenses],
  );
  const health = useMemo(
    () => computeFinancialHealth({ summary, assets, settingsAssets, debts, annualRealRate }),
    [summary, assets, settingsAssets, debts, annualRealRate],
  );
  const netWorth = summary.netWorth;

  // Keep month-to-date baseline and monthly snapshots current (only after real data
  // loaded, and only when something actually changes).
  useEffect(() => {
    if (!initialLoadDone) return;
    const next = syncNetWorthTracking(prefs, netWorth);
    if (!netWorthTrackingUnchanged(prefs, next)) setPrefs((p) => syncNetWorthTracking(p, netWorth));
  }, [initialLoadDone, netWorth, prefs, setPrefs]);

  const report = useMemo(
    () => buildAllocationReportForTables({ goals, assets, settingsAssets, incomeSources }),
    [goals, assets, settingsAssets, incomeSources],
  );
  const seedOptions = useMemo(() => buildGoalStartingOptions(assets, settingsAssets), [assets, settingsAssets]);
  const plans = useMemo(() => buildGoalPlanSummaries(goals, seedOptions, netWorth), [goals, seedOptions, netWorth]);
  const categories = useMemo(() => assetTotalsByCategory(settingsAssets, assets), [settingsAssets, assets]);

  const mtd = monthToDateNetWorthChangePercent(prefs, netWorth);
  const year = new Date().getFullYear();

  return (
    <PageContainer>
      <PageHeader title={t.dashboard.title} description={t.dashboard.description} />

      <StatGrid>
        <StatCard
          label={k.netWorth.label}
          icon={Landmark}
          value={<Money value={netWorth} compact />}
          hint={prefs.includeLoansInNetWorth ? k.netWorth.hintWithLoans : k.netWorth.hint}
          aside={
            Math.abs(mtd) >= 0.05 ? (
              <StatusBadge tone={mtd >= 0 ? "success" : "danger"} title={k.netWorth.mtdTitle}>
                {k.netWorth.mtd({ pct: formatPercent(mtd, { signDisplay: "exceptZero" }) })}
              </StatusBadge>
            ) : null
          }
          href="/assets"
        />
        <StatCard
          label={k.instantPool.label}
          icon={Droplets}
          value={<Money value={report.totals.instantRemainingPool} compact />}
          hint={k.instantPool.hint}
          href="/allocations"
        />
        <StatCard
          label={k.monthlyNet.label}
          icon={Wallet}
          value={<Money value={summary.monthlyNet} compact signed tone="auto" />}
          hint={k.monthlyNet.hint}
          href="/income"
        />
        <StatCard
          label={k.yearEnd.label}
          icon={CalendarRange}
          value={<Money value={summary.eoyProjection} compact />}
          hint={k.yearEnd.hint({ date: formatDate(new Date(year, 11, 31)) })}
        />
      </StatGrid>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <NetWorthTrendCard history={prefs.netWorthMonthlyHistory ?? []} netWorth={netWorth} />
        </div>
        <MilestoneCard netWorth={netWorth} monthlyNet={summary.monthlyNet} settings={prefs.milestone} configState={milestoneConfig} />
      </div>

      <FinancialHealthCard health={health} annualRealRate={annualRealRate} />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <GoalPlansCard
            plans={plans}
            monthlyNet={summary.monthlyNet}
            onOpenPlan={(id) => setGoals((g) => (g.activeProfileId === id ? g : { ...g, activeProfileId: id }))}
          />
        </div>
        <BalanceSheetCard
          assetConfigurationTotal={summary.assetConfigurationTotal}
          portfolioDetailTotal={summary.portfolioDetailTotal}
          grossAssets={summary.grossAssets}
          liabilities={summary.liabilities}
          netWorth={netWorth}
          loansLent={summary.loansLent}
          loansBorrowed={summary.loansBorrowed}
        />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <AllocationCard rows={categories} />
        </div>
        <CashflowCard
          activeIncome={summary.activeIncome}
          passiveIncome={summary.passiveIncome}
          averageSpending={summary.averageSpending}
          monthlyNet={summary.monthlyNet}
        />
      </div>
    </PageContainer>
  );
}
