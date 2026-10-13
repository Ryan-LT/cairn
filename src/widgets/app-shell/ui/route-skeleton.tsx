"use client";

import { useI18n } from "@/shared/i18n";
import { findNavMatch, type TabId } from "@/shared/config";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/kit/card";
import { Skeleton } from "@/shared/ui/kit/skeleton";

import { HubFrame, TabToolbar } from "./hub-layout";
import { PageContainer } from "./page-container";

/*
 * Page-shaped placeholders. Each one is built from the same pieces, paddings
 * and grid as the page it stands in for (summary strip, toolbar, hero card,
 * list groups, stat cards), so content swaps in without the page jumping.
 * Keep them in step when a page's layout changes.
 */

/* ---------- Pieces ---------- */

/** `SummaryStrip`: three figures side by side, optionally the net-worth bar below. */
function SummaryStripSkeleton({ footer }: { footer?: boolean }) {
  return (
    <Card className="gap-0 py-0">
      <div className="grid grid-cols-3 divide-x py-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="grid gap-1.5 px-3 first:pl-4 last:pr-4 md:px-5 md:first:pl-5 md:last:pr-5">
            <Skeleton className="h-4 w-16 md:w-20" />
            <Skeleton className="h-6 w-20 md:h-8 md:w-28" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      {footer ? (
        <div className="grid gap-2 border-t px-4 py-3 md:px-5">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : null}
    </Card>
  );
}

/** `TabToolbar`: context on the left (the month switcher), actions on the right. */
/** Same placement as the real `TabToolbar` (desktop: actions in the tab bar). */
function ToolbarSkeleton({ month, actions }: { month?: boolean; actions: string[] }) {
  return (
    <TabToolbar
      actions={actions.map((w, i) => (
        <Skeleton key={i} className={cn("h-9 rounded-md", w)} />
      ))}
    >
      {month ? <Skeleton className="h-8 w-48" /> : null}
    </TabToolbar>
  );
}

/** One `ListRow`: icon tile, two lines, amount (and a check button for bills, a bar for budgets). */
function RowSkeleton({ kind = "plain" }: { kind?: "plain" | "bill" | "budget" }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <Skeleton className="size-9 shrink-0 rounded-lg" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Skeleton className="h-4 w-32 max-w-[60%]" />
        {kind === "budget" ? <Skeleton className="h-1.5 w-full rounded-full" /> : null}
        <Skeleton className="h-3 w-24 max-w-[45%]" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0" />
      {kind === "bill" ? <Skeleton className="size-9 shrink-0 rounded-full" /> : null}
      {kind === "budget" ? <Skeleton className="h-8 w-20 shrink-0 rounded-full max-sm:hidden" /> : null}
    </div>
  );
}

/** `ListGroup`: a small heading row above a card of rows. */
function ListGroupSkeleton({ rows, kind, title = true }: { rows: number; kind?: "plain" | "bill" | "budget"; title?: boolean }) {
  return (
    <section className="grid gap-2">
      {title ? (
        <div className="flex items-end justify-between gap-3 px-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      ) : null}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="divide-y">
          {Array.from({ length: rows }, (_, i) => (
            <RowSkeleton key={i} kind={kind} />
          ))}
        </div>
      </Card>
    </section>
  );
}

/** `StatCard`: label (and icon), value, hint. */
function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full gap-2 px-4 py-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-4 rounded-sm max-sm:hidden" />
      </div>
      <Skeleton className="mt-auto h-6 w-24 md:h-7 md:w-28" />
      <Skeleton className="h-3 w-36 max-w-full" />
    </Card>
  );
}

function StatGridSkeleton({ count, className, lastClassName }: { count: number; className?: string; lastClassName?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4", className)}>
      {Array.from({ length: count }, (_, i) => (
        <StatCardSkeleton key={i} className={i === count - 1 ? lastClassName : undefined} />
      ))}
    </div>
  );
}

/** `Section` card: title + description, optional actions, then its body. */
function SectionSkeleton({ actions, children, className }: { actions?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5">
        <div className="grid min-w-0 flex-1 basis-56 gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        {actions ? <Skeleton className={cn("h-8 rounded-md", actions)} /> : null}
      </div>
      <div className="px-5">{children}</div>
    </Card>
  );
}

/** A home card heading: title left, link right. */
function CardHeadingSkeleton({ title = "w-28", link = true }: { title?: string; link?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Skeleton className={cn("h-5", title)} />
      {link ? <Skeleton className="h-4 w-24 max-sm:w-4" /> : null}
    </div>
  );
}

/** Label on the left, value on the right (description lists, totals). */
function PairRows({ rows }: { rows: number }) {
  return (
    <div className="grid flex-1 gap-2.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/* ---------- Home ---------- */

function HomeSkeleton() {
  return (
    <>
      <header className="grid gap-1.5">
        <Skeleton className="h-6 w-64 max-w-full md:h-7" />
        <Skeleton className="h-4 w-28" />
      </header>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
        {/* Net worth hero */}
        <Card className="bg-hero gap-4 px-5 xl:col-span-7">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-9 w-full" />
          <div className="mt-auto flex gap-5 border-t pt-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </Card>
        {/* This month */}
        <Card className="gap-4 px-5 xl:col-span-5">
          <CardHeadingSkeleton title="w-24" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 shrink-0 rounded-full" />
            <PairRows rows={3} />
          </div>
          <Skeleton className="mt-auto h-11 w-full rounded-lg" />
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
        {/* Bills to pay */}
        <Card className="gap-0 py-0 xl:col-span-7">
          <div className="px-4 pt-4 pb-2">
            <CardHeadingSkeleton title="w-32" />
          </div>
          <div className="divide-y border-t">
            {Array.from({ length: 4 }, (_, i) => (
              <RowSkeleton key={i} kind="bill" />
            ))}
          </div>
        </Card>
        {/* Worth a look */}
        <Card className="gap-0 py-0 xl:col-span-5">
          <div className="px-5 pt-4 pb-2">
            <CardHeadingSkeleton title="w-24" link={false} />
          </div>
          <div className="divide-y">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <Skeleton className="size-7 shrink-0 rounded-lg" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t px-3 py-2">
            <Skeleton className="mx-auto h-5 w-28" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
        {/* Goals */}
        <Card className="gap-3 px-5 xl:col-span-7">
          <CardHeadingSkeleton title="w-20" />
          <div className="grid gap-1 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="size-12 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        {/* Health */}
        <Card className="gap-3 px-5 xl:col-span-5">
          <CardHeadingSkeleton title="w-36" />
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-12">
        {/* Net worth trend */}
        <SectionSkeleton actions="w-36" className="xl:col-span-7">
          <Skeleton className="h-48 w-full" />
        </SectionSkeleton>
        {/* Milestone */}
        <SectionSkeleton className="xl:col-span-5">
          <div className="grid gap-4">
            <Skeleton className="h-6 w-48 rounded-full" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <PairRows rows={3} />
          </div>
        </SectionSkeleton>
      </div>
    </>
  );
}

/* ---------- Cash flow ---------- */

function CashflowMonthSkeleton() {
  return (
    <>
      <ToolbarSkeleton month actions={["w-24"]} />
      <Card className="bg-hero gap-4 px-5">
        <div className="flex items-center gap-4 md:gap-6">
          <Skeleton className="size-[76px] shrink-0 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="grid gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </Card>
      {/* Calendar strip */}
      <div className="flex gap-1.5 overflow-hidden pb-1">
        {Array.from({ length: 22 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-11 shrink-0 rounded-xl" />
        ))}
      </div>
      <ListGroupSkeleton rows={4} kind="bill" />
      <ListGroupSkeleton rows={3} kind="budget" />
    </>
  );
}

function CashflowSpendingSkeleton() {
  return (
    <>
      <ToolbarSkeleton actions={["w-9 md:w-28", "w-9 md:w-36", "w-24"]} />
      <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
        <Card className="bg-hero gap-5 px-5 xl:col-span-3">
          <div className="grid gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-40 md:h-11" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-xl border p-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="grid gap-1.5">
                <Skeleton className="h-3 w-20 max-w-full" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
          <div className="mt-auto grid gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex flex-wrap gap-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3 w-full max-w-md" />
          </div>
        </Card>
        <Card className="gap-4 xl:col-span-2">
          <div className="px-5">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid gap-3 px-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <Skeleton className="size-7 rounded-md" />
                <div className="grid gap-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
                <Skeleton className="h-4 w-14" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <ListGroupSkeleton rows={2} />
      <ListGroupSkeleton rows={2} />
      <ListGroupSkeleton rows={2} />
    </>
  );
}

function CashflowIncomeSkeleton() {
  return (
    <>
      <ToolbarSkeleton actions={["w-44"]} />
      <ListGroupSkeleton rows={2} />
      <ListGroupSkeleton rows={1} />
    </>
  );
}

/* ---------- Net worth ---------- */

function WealthAssetsSkeleton() {
  return (
    <>
      <ToolbarSkeleton actions={["w-32"]} />
      <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:col-span-2 xl:grid-cols-1">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <Card className="gap-4 xl:col-span-3">
          <div className="px-5">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid gap-3.5 px-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <ListGroupSkeleton rows={1} />
      <ListGroupSkeleton rows={1} />
      <ListGroupSkeleton rows={2} />
    </>
  );
}

function WealthDebtsSkeleton() {
  return (
    <>
      <ToolbarSkeleton actions={["w-36"]} />
      <StatGridSkeleton count={3} className="xl:grid-cols-3" lastClassName="max-xl:col-span-2" />
      <ListGroupSkeleton rows={3} />
    </>
  );
}

function WealthLoansSkeleton() {
  return (
    <>
      <ToolbarSkeleton actions={["w-36"]} />
      <StatGridSkeleton count={3} className="xl:grid-cols-3" lastClassName="max-xl:col-span-2" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <SectionSkeleton>
        <div className="-mx-5 grid border-t">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-9 w-72 max-md:hidden" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-t px-5 py-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-24 rounded-full max-md:hidden" />
              <Skeleton className="h-4 w-20 max-md:hidden" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      </SectionSkeleton>
    </>
  );
}

/* ---------- Goals ---------- */

function GoalsPlansSkeleton() {
  return (
    <>
      <ToolbarSkeleton actions={["w-36"]} />
      {/* Phones and tablets: plans as a sideways row of cards. */}
      <div className="flex gap-2 overflow-hidden xl:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[5.75rem] w-64 shrink-0 rounded-lg" />
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <Card className="gap-0 py-2 max-xl:hidden">
          <Skeleton className="mx-4 mt-2 mb-2 h-3 w-20" />
          <div className="grid gap-1 px-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-3">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-5 w-56 max-w-full" />
            </div>
            {/* "Sửa kế hoạch" on wide screens, an icon button on phones. */}
            <Skeleton className="h-9 w-9 shrink-0 rounded-md md:w-32" />
          </div>
          <Card className="bg-hero flex-row items-center gap-5 px-5">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-48 max-w-full" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          </Card>
          <StatGridSkeleton count={3} className="xl:grid-cols-3" lastClassName="max-xl:col-span-2" />
          <SectionSkeleton actions="w-36">
            <Skeleton className="h-56 w-full" />
          </SectionSkeleton>
        </div>
      </div>
    </>
  );
}

function GoalsFundingSkeleton() {
  return (
    <>
      <StatGridSkeleton count={3} className="xl:grid-cols-3" lastClassName="max-xl:col-span-2" />
      <section className="grid gap-2">
        <div className="grid gap-1.5 px-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <Card className="gap-0 overflow-hidden py-0">
          <div className="divide-y">
            {Array.from({ length: 3 }, (_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        </Card>
      </section>
      <SectionSkeleton actions="w-64 max-md:w-full">
        <div className="-mx-5 grid border-t">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-5 py-4 last:border-b-0">
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16 max-md:hidden" />
              <Skeleton className="h-4 w-16 max-md:hidden" />
            </div>
          ))}
        </div>
      </SectionSkeleton>
    </>
  );
}

/* ---------- Settings ---------- */

function SettingsGeneralSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-5 md:gap-6">
      <SectionSkeleton>
        <div className="grid gap-4">
          <Skeleton className="h-9 w-60 rounded-md" />
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-t pt-4">
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
              <Skeleton className={cn("shrink-0", i === 0 ? "h-9 w-40 rounded-md" : "h-5 w-9 rounded-full")} />
            </div>
          ))}
        </div>
      </SectionSkeleton>
      <SectionSkeleton>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="grid gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </SectionSkeleton>
      <SectionSkeleton>
        <div className="flex items-center justify-between gap-4">
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>
          <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
        </div>
      </SectionSkeleton>
      <SectionSkeleton actions="w-28">
        <div className="grid divide-y">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 py-2.5">
              <div className="grid gap-1.5">
                <Skeleton className="h-4 w-28" />
                {i > 1 ? <Skeleton className="h-3 w-56 max-w-full" /> : null}
              </div>
              <Skeleton className={cn("shrink-0", i > 1 ? "h-8 w-28 rounded-md" : "h-4 w-24")} />
            </div>
          ))}
        </div>
      </SectionSkeleton>
    </div>
  );
}

function SettingsActivitySkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-5 md:gap-6">
      <div className="grid gap-1.5">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {["w-16", "w-20", "w-20", "w-16", "w-20", "w-16", "w-20", "w-16"].map((w, i) => (
          <Skeleton key={i} className={cn("h-8 shrink-0 rounded-full", w)} />
        ))}
      </div>
      <section className="grid gap-2">
        <Skeleton className="ml-1 h-4 w-20" />
        <Card className="gap-0 overflow-hidden py-0">
          <div className="divide-y">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="grid flex-1 gap-1.5">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                </div>
                <Skeleton className="h-3 w-10 shrink-0" />
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

const TAB_SKELETONS: Record<TabId, () => React.ReactNode> = {
  cashflowMonth: CashflowMonthSkeleton,
  cashflowSpending: CashflowSpendingSkeleton,
  cashflowIncome: CashflowIncomeSkeleton,
  wealthAssets: WealthAssetsSkeleton,
  wealthDebts: WealthDebtsSkeleton,
  wealthLoans: WealthLoansSkeleton,
  goalsPlans: GoalsPlansSkeleton,
  goalsFunding: GoalsFundingSkeleton,
  settingsGeneral: SettingsGeneralSkeleton,
  settingsActivity: SettingsActivitySkeleton,
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
    // The section frame and its tabs are real (and usable) while the content loads;
    // sections with a summary above the tabs get its placeholder so the tabs don't jump.
    const summary =
      match.hub.id === "cashflow" ? <SummaryStripSkeleton /> : match.hub.id === "wealth" ? <SummaryStripSkeleton footer /> : undefined;
    return (
      <HubFrame hub={match.hub.id} activePath={pathname} skeleton summary={summary}>
        {status}
        <div className="flex min-w-0 flex-col gap-5 md:gap-6">
          <Body />
        </div>
      </HubFrame>
    );
  }
  return (
    <PageContainer skeleton>
      {status}
      <HomeSkeleton />
    </PageContainer>
  );
}
