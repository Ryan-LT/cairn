"use client";

import type { ReactNode } from "react";

export type ChartTooltipRow = { key: string; name: string; color: string; value: ReactNode; dashed?: boolean };

/** Tooltip body: value leads, series name follows, keyed by a short line in the series colour. */
export function ChartTooltipCard({ title, rows }: { title: ReactNode; rows: ChartTooltipRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-44 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium text-muted-foreground">{title}</p>
      <ul className="grid gap-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            <svg width="12" height="4" aria-hidden className="shrink-0">
              <line x1="0" y1="2" x2="12" y2="2" stroke={r.color} strokeWidth="2" strokeLinecap="round" strokeDasharray={r.dashed ? "3 2" : undefined} />
            </svg>
            <span className="font-semibold tabular-nums" data-private>
              {r.value}
            </span>
            <span className="ml-auto pl-3 text-muted-foreground">{r.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legend entry mirroring a line mark. */
export function ChartLegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <svg width="14" height="4" aria-hidden>
        <line x1="0" y1="2" x2="14" y2="2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? "3 2" : undefined} />
      </svg>
      {label}
    </span>
  );
}

/** Shared axis / grid styling for recharts. */
export const chartAxisProps = {
  stroke: "var(--chart-axis)",
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
  tickLine: false,
  axisLine: false,
} as const;
