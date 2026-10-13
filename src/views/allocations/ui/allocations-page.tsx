"use client";

import { Clock, PencilRuler, ShoppingCart, Target, TrendingUp, Wallet, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { GOALS_SEED, resolveMonthlyShares } from "@/entities/goal";
import { INCOME_SOURCES_SEED } from "@/entities/income";
import { buildAllocationReportForTables, filterAllocationRowsByBand } from "@/entities/portfolio";
import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import {
  ALLOCATIONS_BAND_FILTERS,
  PREFERENCES_SEED,
  resolveAllocationsBandFilter,
  type AllocationsBandFilter,
} from "@/entities/preferences";
import { SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import { useI18n } from "@/shared/i18n";
import { useMediaQuery } from "@/shared/lib/use-media-query";
import { useTable } from "@/shared/storage";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/kit/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";
import { Money } from "@/shared/ui/money";
import { PageHeader } from "@/shared/ui/page-header";
import { Section } from "@/shared/ui/section";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { StatusBadge } from "@/shared/ui/status-badge";
import { PageContainer } from "@/widgets/app-shell";

import { cycleMatrixColumnSort, normalizeMatrixColumnSort, sortMatrixByColumn } from "../lib/matrix-column-sort";
import { SourceItem, SourceMatrix } from "./source-matrix";

export function AllocationsPage() {
  const [goals] = useTable("goals", GOALS_SEED);
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [settingsAssets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [incomeSources] = useTable("incomeSources", INCOME_SOURCES_SEED);
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const compact = useMediaQuery("(max-width: 1023px)");
  const { t } = useI18n();
  const m = t.allocations;

  const report = useMemo(
    () => buildAllocationReportForTables({ goals, assets, settingsAssets, incomeSources }),
    [goals, assets, settingsAssets, incomeSources],
  );
  const cash = useHouseholdCashflow();
  const shares = useMemo(() => resolveMonthlyShares(goals.profiles), [goals.profiles]);
  const band = resolveAllocationsBandFilter(prefs);
  const sort = useMemo(() => normalizeMatrixColumnSort(prefs.allocationsMatrixColumnSort), [prefs.allocationsMatrixColumnSort]);
  const rows = useMemo(
    () => filterAllocationRowsByBand(sortMatrixByColumn(report.sources, sort), band),
    [report.sources, sort, band],
  );

  return (
    <PageContainer>
      <PageHeader title={m.title} description={m.description} />

      <StatGrid className="xl:grid-cols-3">
        <StatCard label={m.kpi.monthlyIncome.label} icon={TrendingUp} value={<Money value={cash.totalIncome} compact />} href="/income" />
        <StatCard label={m.kpi.avgSpending.label} icon={ShoppingCart} value={<Money value={cash.averageSpending} compact />} href="/income" />
        <StatCard
          label={m.kpi.monthlyNet.label}
          icon={Wallet}
          value={<Money value={cash.monthlyNet} compact signed tone="auto" />}
          hint={m.kpi.monthlyNet.hint}
        />
        <StatCard
          label={m.kpi.instantPool.label}
          icon={Zap}
          value={<Money value={report.totals.instantRemainingPool} compact />}
          hint={m.kpi.instantPool.hint}
        />
        <StatCard
          label={m.kpi.notInstantPool.label}
          icon={Clock}
          value={<Money value={report.totals.notInstantRemainingPool} compact />}
          hint={m.kpi.notInstantPool.hint}
        />
        <StatCard
          label={m.kpi.custom.label}
          icon={PencilRuler}
          value={<Money value={report.totals.customReservedStored} compact />}
          hint={m.kpi.custom.hint}
        />
      </StatGrid>

      <Section title={m.plans.title} description={m.plans.description} flush>
        {report.plans.length === 0 ? (
          <EmptyState
            icon={Target}
            title={m.plans.emptyTitle}
            description={m.plans.emptyDescription}
            action={
              <Button variant="outline" asChild>
                <Link href="/goals">{m.plans.goToGoals}</Link>
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{m.plans.colPlan}</TableHead>
                <TableHead className="text-right">{m.plans.colStarting}</TableHead>
                <TableHead className="max-sm:hidden">{m.plans.colMonthlyIncome}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-48 truncate font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">
                    <Money value={p.effectiveStartingTotal} />
                  </TableCell>
                  <TableCell className="max-sm:hidden">
                    {p.usesMonthlyIncome ? (
                      <StatusBadge tone="success" dot>
                        {m.plans.incomeOn} <Money value={cash.monthlyNet * (shares.byPlan.get(p.id) ?? 0)} compact signed />
                        {m.plans.perMonthShort}
                      </StatusBadge>
                    ) : (
                      <StatusBadge dot>{m.plans.incomeOff}</StatusBadge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title={m.matrix.title}
        description={m.matrix.description}
        actions={
          <SegmentedControl<AllocationsBandFilter>
            aria-label={m.matrix.filterLabel}
            value={band}
            onValueChange={(v) => setPrefs((p) => ({ ...p, allocationsBandFilter: v }))}
            options={ALLOCATIONS_BAND_FILTERS.map((o) => ({
              ...o,
              label: m.matrix.filter[o.value],
            }))}
          />
        }
        flush
      >
        {report.sources.length === 0 ? (
          <EmptyState title={m.matrix.emptyTitle} description={m.matrix.emptyDescription} />
        ) : rows.length === 0 ? (
          <EmptyState title={m.matrix.noMatch} />
        ) : compact ? (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.sourceKey}>
                <SourceItem row={row} plans={report.plans} />
              </li>
            ))}
          </ul>
        ) : (
          <SourceMatrix
            rows={rows}
            plans={report.plans}
            sort={sort}
            onSort={(click) => setPrefs((p) => ({ ...p, allocationsMatrixColumnSort: cycleMatrixColumnSort(sort, click) }))}
          />
        )}
      </Section>
    </PageContainer>
  );
}
