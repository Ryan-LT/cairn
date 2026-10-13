"use client";

import { useMemo, useState } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { DEBTS_SEED } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { buildMonthView, planVsActual } from "@/entities/expense";
import { buildGoalPlanStatuses, buildGoalStartingOptions, GOALS_SEED, resolveMonthlyShares } from "@/entities/goal";
import { INCOME_SOURCES_SEED } from "@/entities/income";
import { useMilestoneConfig } from "@/entities/milestone/api/use-milestone-config";
import { PERSONAL_LOANS_SEED, type PersonalLoan } from "@/entities/personal-loan";
import { buildInsights, computeDashboardSummary, computeFinancialHealth } from "@/entities/portfolio";
import { monthToDateNetWorthChangePercent, PREFERENCES_SEED } from "@/entities/preferences";
import { SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import { useRecordSpending } from "@/features/record-spending";
import { useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/lib/format";
import { monthKeyOf, monthsEndingAt } from "@/shared/lib/month";
import { useTable } from "@/shared/storage";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { InsightsFeed } from "@/widgets/insights-feed";
import { PageContainer, useOptimisticNavigation, useShell } from "@/widgets/app-shell";
import { SetupGuide } from "@/widgets/setup-guide";

import { FinancialHealthCard } from "./financial-health-card";
import { DueBills, GoalsGlance, HealthTiles, MonthGlance, NetWorthHero } from "./home-cards";
import { MilestoneCard } from "./milestone-card";
import { NetWorthTrendCard } from "./net-worth-trend-card";

function greetingKey(d: Date): "morning" | "afternoon" | "evening" {
  const h = d.getHours();
  return h < 11 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/** Overview: where money stands today, what needs doing, and what's worth a look. */
export function HomePage() {
  const { t } = useI18n();
  const { userName } = useShell();
  const { navigate } = useOptimisticNavigation();
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [debts] = useTable("debts", DEBTS_SEED);
  const [settingsAssets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [incomeSources] = useTable("incomeSources", INCOME_SOURCES_SEED);
  const [goals, setGoals] = useTable("goals", GOALS_SEED);
  const [prefs] = useTable("preferences", PREFERENCES_SEED);
  const [personalLoans] = useTable<PersonalLoan[]>("personalLoans", PERSONAL_LOANS_SEED);
  const { expenses, log } = useExpenses();
  const milestoneConfig = useMilestoneConfig();
  const annualRealRate = milestoneConfig.config?.annualRealRate ?? 0;
  const actions = useRecordSpending();
  const [healthOpen, setHealthOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const monthKey = monthKeyOf(now);
  const summary = useMemo(
    () => computeDashboardSummary({ assets, debts, settingsAssets, incomeSources, prefs, personalLoans, expenses }),
    [assets, debts, settingsAssets, incomeSources, prefs, personalLoans, expenses],
  );
  const health = useMemo(() => computeFinancialHealth({ summary, assets, settingsAssets, debts, annualRealRate }), [summary, assets, settingsAssets, debts, annualRealRate]);
  const paydays = useMemo(() => incomeSources.filter((s) => s.paymentDay).map((s) => ({ id: s.id, name: s.name, day: s.paymentDay! })), [incomeSources]);
  const month = useMemo(() => buildMonthView({ expenses, log, debts, monthKey, today: now, paydays }), [expenses, log, debts, monthKey, now, paydays]);
  const history = useMemo(() => planVsActual({ expenses, log, debts, monthKeys: monthsEndingAt(monthKey, 6), today: now }), [expenses, log, debts, monthKey, now]);
  const seedOptions = useMemo(() => buildGoalStartingOptions(assets, settingsAssets), [assets, settingsAssets]);
  const plans = useMemo(() => buildGoalPlanStatuses(goals, seedOptions, summary.monthlyNet, now), [goals, seedOptions, summary.monthlyNet, now]);
  const insights = useMemo(
    () =>
      buildInsights({
        now,
        cashflow: summary,
        health,
        month,
        history,
        debts,
        expenses,
        goals: plans,
        sharesOverAllocated: resolveMonthlyShares(goals.profiles).overAllocated,
        settingsAssets,
      }),
    [now, summary, health, month, history, debts, expenses, plans, goals.profiles, settingsAssets],
  );
  const due = [...month.groups.overdue, ...month.groups.needsConfirm, ...month.groups.dueSoon].slice(0, 5);

  return (
    <PageContainer className="stagger-in">
      <header className="grid gap-0.5">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{t.home.greeting[greetingKey(now)]({ name: userName })}</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{formatDate(now)}</p>
      </header>

      {/* Actionable while setting up, so it comes first; hidden once done or dismissed. */}
      <SetupGuide />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
        <NetWorthHero
          className="xl:col-span-7"
          netWorth={summary.netWorth}
          grossAssets={summary.grossAssets}
          liabilities={summary.liabilities}
          mtdPct={monthToDateNetWorthChangePercent(prefs, summary.netWorth)}
          history={prefs.netWorthMonthlyHistory ?? []}
        />
        <MonthGlance className="xl:col-span-5" month={month} cash={summary} />
      </div>

      <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-12">
        <DueBills className="xl:col-span-7" lines={due} monthKey={monthKey} actions={actions} />
        <InsightsFeed className="xl:col-span-5" insights={insights} />
      </div>

      <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-12">
        <GoalsGlance
          className="xl:col-span-7"
          plans={plans}
          onOpen={(id) => {
            setGoals((g) => (g.activeProfileId === id ? g : { ...g, activeProfileId: id }));
            navigate("/goals");
          }}
        />
        <HealthTiles className="xl:col-span-5" health={health} cash={summary} onDetails={() => setHealthOpen(true)} />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <NetWorthTrendCard history={prefs.netWorthMonthlyHistory ?? []} netWorth={summary.netWorth} />
        </div>
        <div className="xl:col-span-4">
          <MilestoneCard netWorth={summary.netWorth} monthlyNet={summary.monthlyNet} settings={prefs.milestone} configState={milestoneConfig} />
        </div>
      </div>

      <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>{t.dashboard.health.title}</DialogTitle>
            <DialogDescription>{t.dashboard.health.description}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FinancialHealthCard health={health} annualRealRate={annualRealRate} bare />
          </DialogBody>
        </DialogContent>
      </Dialog>
      {actions.sheet}
    </PageContainer>
  );
}
