"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Info } from "lucide-react";
import type { ReactNode } from "react";

import { liquidityBandLabel, liquidityBandTone, type AllocationPlanColumn, type AllocationSourceRow } from "@/entities/portfolio";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import { Money } from "@/shared/ui/money";
import { StatusBadge } from "@/shared/ui/status-badge";

import { sortIndicator, type MatrixColumnClick, type MatrixColumnSort } from "../lib/matrix-column-sort";

type SourceMatrixProps = {
  rows: AllocationSourceRow[];
  plans: AllocationPlanColumn[];
  sort: MatrixColumnSort;
  onSort: (click: MatrixColumnClick) => void;
};

function SortHeader({
  sort,
  click,
  onSort,
  align = "right",
  sticky,
  children,
}: {
  sort: MatrixColumnSort;
  click: MatrixColumnClick;
  onSort: (click: MatrixColumnClick) => void;
  align?: "left" | "right";
  sticky?: boolean;
  children: ReactNode;
}) {
  const dir = sortIndicator(sort, click);
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <TableHead
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
      className={cn(align === "right" && "text-right", sticky && "sticky left-0 z-10 min-w-48 bg-card")}
    >
      <button
        type="button"
        onClick={() => onSort(click)}
        className={cn(
          "-mx-1.5 inline-flex h-7 max-w-48 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none",
          dir && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        <span className="truncate">{children}</span>
        <Icon className={cn("size-3.5 shrink-0", !dir && "opacity-50")} aria-hidden />
      </button>
    </TableHead>
  );
}

/**
 * Desktop matrix: sticky source column, one column per plan, then totals.
 * Compact amounts (full value on hover / tap) so every column fits a laptop screen.
 */
export function SourceMatrix({ rows, plans, sort, onSort }: SourceMatrixProps) {
  const { t } = useI18n();
  const m = t.allocations.matrix;
  return (
    <Table containerClassName="max-w-full">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <SortHeader sort={sort} click={{ type: "source" }} onSort={onSort} align="left" sticky>
            {m.colSource}
          </SortHeader>
          {plans.map((p) => (
            <SortHeader key={p.id} sort={sort} click={{ type: "plan", planId: p.id }} onSort={onSort}>
              {p.name}
            </SortHeader>
          ))}
          <TableHead className="text-right">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  {m.colIncomeCapital}
                  <Info className="size-3.5 opacity-60" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent>{m.incomeCapitalHint}</TooltipContent>
            </Tooltip>
          </TableHead>
          <SortHeader sort={sort} click={{ type: "reserved" }} onSort={onSort}>
            {m.colReserved}
          </SortHeader>
          <SortHeader sort={sort} click={{ type: "live" }} onSort={onSort}>
            {m.colLive}
          </SortHeader>
          <SortHeader sort={sort} click={{ type: "pool" }} onSort={onSort}>
            {m.colPool}
          </SortHeader>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.sourceKey} className="group">
            <TableCell className="sticky left-0 z-10 min-w-48 bg-card group-hover:bg-muted">
              <p className="max-w-56 truncate font-medium">{row.label}</p>
              <StatusBadge tone={liquidityBandTone(row.band)} dot className="mt-1">
                {liquidityBandLabel(row.band)}
              </StatusBadge>
            </TableCell>
            {plans.map((p) => {
              const v = row.perPlanStored[p.id] ?? 0;
              return (
                <TableCell key={p.id} className="text-right">
                  {v > 0 ? <Money value={v} compact /> : <span className="text-muted-foreground">—</span>}
                  {row.allInPlanId === p.id ? <p className="text-xs text-primary">{t.goals.allocate.allInBadge}</p> : null}
                </TableCell>
              );
            })}
            <TableCell className="text-right">
              {row.totalIncomeCapital > 0 ? <Money value={row.totalIncomeCapital} compact /> : <span className="text-muted-foreground">—</span>}
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.totalReservedStored} compact />
            </TableCell>
            <TableCell className="text-right">
              <Money value={row.liveBalance} compact />
            </TableCell>
            <TableCell className="text-right font-medium">
              <Money value={row.remainingPool} compact />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Phone / narrow layout of one matrix row. */
export function SourceItem({ row, plans }: { row: AllocationSourceRow; plans: AllocationPlanColumn[] }) {
  const { t } = useI18n();
  const m = t.allocations.matrix;
  const perPlan = plans.filter((p) => (row.perPlanStored[p.id] ?? 0) > 0);
  return (
    <div className="grid gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-medium">{row.label}</p>
        <StatusBadge tone={liquidityBandTone(row.band)} dot>
          {liquidityBandLabel(row.band)}
        </StatusBadge>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">{m.colLive}</dt>
          <dd>
            <Money value={row.liveBalance} compact />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{m.colReserved}</dt>
          <dd>
            <Money value={row.totalReservedStored} compact />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{m.colPool}</dt>
          <dd className="font-medium">
            <Money value={row.remainingPool} compact />
          </dd>
        </div>
      </dl>
      {perPlan.length > 0 || row.totalIncomeCapital > 0 ? (
        <ul className="grid gap-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
          {perPlan.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span className="truncate text-muted-foreground">
                {p.name}
                {row.allInPlanId === p.id ? <span className="ml-1.5 text-primary">· {t.goals.allocate.allInBadge}</span> : null}
              </span>
              <Money value={row.perPlanStored[p.id]} />
            </li>
          ))}
          {row.totalIncomeCapital > 0 ? (
            <li className="flex justify-between gap-3">
              <span className="truncate text-muted-foreground">{m.colIncomeCapital}</span>
              <Money value={row.totalIncomeCapital} />
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
