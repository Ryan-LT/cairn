"use client";

import { useI18n } from "@/shared/i18n";
import { findNavMatch, type TabId } from "@/shared/config";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/kit/card";
import { Skeleton } from "@/shared/ui/kit/skeleton";

import { HubFrame } from "./hub-layout";
import { PageContainer } from "./page-container";

/*
 * Page-shaped placeholders. They mirror each page's real layout (header, KPI
 * grid, sections) so content swaps in without the page jumping around.
 */

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-44 max-md:hidden" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      {action ? <Skeleton className="h-9 w-36" /> : null}
    </div>
  );
}

function StatsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-3 px-4 py-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-32 max-w-full" />
        </Card>
      ))}
    </div>
  );
}

function SectionSkeleton({ rows = 4, chart, className }: { rows?: number; chart?: boolean; className?: string }) {
  return (
    <Card className={className}>
      <div className="grid gap-2 px-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid gap-3 px-5">
        {chart ? <Skeleton className="h-56 w-full" /> : null}
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="gap-0 pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4">
        <div className="grid gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-9 w-56 max-w-full" />
      </div>
      <div className="divide-y border-t">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="size-8 shrink-0 rounded-md" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <HeaderSkeleton action={false} />
      <StatsSkeleton />
      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <SectionSkeleton chart rows={0} className="xl:col-span-2" />
        <SectionSkeleton rows={3} />
      </div>
      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <SectionSkeleton rows={4} className="xl:col-span-2" />
        <SectionSkeleton rows={4} />
      </div>
    </>
  );
}

function GoalsSkeleton() {
  return (
    <>
      <Skeleton className="h-10 w-full xl:hidden" />
      <div className="grid items-start gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <Card className="gap-3 px-4 py-4 max-xl:hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-1 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </Card>
        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Skeleton className="h-6 w-48" />
          <StatsSkeleton />
          <Skeleton className="h-12 w-full" />
          <SectionSkeleton chart rows={0} />
        </div>
      </div>
    </>
  );
}

function SettingsSkeleton() {
  return (
    <>
      <SectionSkeleton rows={1} />
      <SectionSkeleton rows={3} />
      <SectionSkeleton rows={2} />
    </>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      <Skeleton className="ml-1 h-4 w-32" />
      <Card className="gap-0 py-0">
        <div className="divide-y">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-9 shrink-0 rounded-lg" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const TAB_SKELETONS: Record<TabId, () => React.ReactNode> = {
  cashflowMonth: () => (
    <>
      <SectionSkeleton rows={2} />
      <ListSkeleton rows={3} />
      <ListSkeleton rows={4} />
    </>
  ),
  cashflowSpending: () => (
    <>
      <SectionSkeleton rows={3} />
      <ListSkeleton rows={6} />
    </>
  ),
  cashflowIncome: () => <ListSkeleton rows={3} />,
  wealthAssets: () => (
    <>
      <StatsSkeleton count={3} className="xl:grid-cols-3" />
      <TableSkeleton />
    </>
  ),
  wealthDebts: () => <ListSkeleton rows={3} />,
  wealthLoans: () => <ListSkeleton rows={4} />,
  goalsPlans: GoalsSkeleton,
  goalsFunding: () => (
    <>
      <StatsSkeleton count={3} className="xl:grid-cols-3" />
      <TableSkeleton rows={4} />
    </>
  ),
  settingsGeneral: () => (
    <div className="flex max-w-3xl flex-col gap-5 md:gap-6">
      <SettingsSkeleton />
    </div>
  ),
  settingsActivity: () => (
    <div className="max-w-3xl">
      <ListSkeleton rows={6} />
    </div>
  ),
};

/** The loading placeholder for whichever page `pathname` belongs to. */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  const match = findNavMatch(pathname);
  const { t } = useI18n();
  const status = (
    <span className="sr-only" role="status">
      {t.common.loading}
    </span>
  );
  if (match?.tab) {
    const Body = TAB_SKELETONS[match.tab.id];
    // The section frame and its tabs are real (and usable) while the content loads.
    // Sections with a summary card above the tabs (keeps the tabs from jumping when data arrives).
    const summary =
      match.hub.id === "cashflow" || match.hub.id === "wealth" ? (
        <Card className="grid grid-cols-3 gap-4 px-5 py-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </Card>
      ) : undefined;
    return (
      <HubFrame hub={match.hub.id} activePath={pathname} skeleton summary={summary}>
        {status}
        <div className="flex flex-col gap-5 md:gap-6">
          <Body />
        </div>
      </HubFrame>
    );
  }
  return (
    <PageContainer skeleton>
      {status}
      <DashboardSkeleton />
    </PageContainer>
  );
}
