"use client";

import { Clock, PencilRuler, Target, Zap } from "lucide-react";
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
import { formatMoney, formatPercent } from "@/shared/lib/format";
import { useMediaQuery } from "@/shared/lib/use-media-query";
import { useTable } from "@/shared/storage";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { IconTile } from "@/shared/ui/icon-tile";
import { ListGroup, ListRow } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { TabContent, useOptimisticNavigation } from "@/widgets/app-shell";

import { cycleMatrixColumnSort, normalizeMatrixColumnSort, sortMatrixByColumn } from "../lib/matrix-column-sort";
import { SourceItem, SourceMatrix } from "./source-matrix";

export function AllocationsPage() {
  const [goals, setGoals] = useTable("goals", GOALS_SEED);
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [settingsAssets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [incomeSources] = useTable("incomeSources", INCOME_SOURCES_SEED);
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  // The matrix needs a wide screen (one column per plan); below that, one card per asset.
  const compact = useMediaQuery("(max-width: 1279px)");
  const { t } = useI18n();
  const m = t.allocations;
  const { navigate } = useOptimisticNavigation();

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
    <TabContent>
      <StatGrid className="xl:grid-cols-3">
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
          className="max-xl:col-span-2"
          label={m.kpi.custom.label}
          icon={PencilRuler}
          value={<Money value={report.totals.customReservedStored} compact />}
          hint={m.kpi.custom.hint}
        />
      </StatGrid>

      {report.plans.length === 0 ? (
        <Card className="gap-0 py-0">
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
        </Card>
      ) : (
        <ListGroup title={m.plans.title} description={m.plans.description}>
          {report.plans.map((p) => {
            const share = shares.byPlan.get(p.id) ?? 0;
            return (
              <ListRow
                key={p.id}
                leading={<IconTile icon={Target} color="var(--capstone-ink)" background="var(--capstone-soft)" />}
                title={p.name}
                subtitle={
                  p.usesMonthlyIncome ? (
                    <span data-private>
                      {m.plans.sharePerMonth({
                        pct: formatPercent(share * 100, { maximumFractionDigits: 0 }),
                        amount: formatMoney(Math.round(cash.monthlyNet * share)),
                      })}
                    </span>
                  ) : (
                    m.plans.noMonthly
                  )
                }
                trailing={<Money value={p.effectiveStartingTotal} compact interactive={false} />}
                onClick={() => {
                  setGoals((g) => ({ ...g, activeProfileId: p.id }));
                  navigate("/goals");
                }}
                label={p.name}
              />
            );
          })}
        </ListGroup>
      )}

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
    </TabContent>
  );
}
