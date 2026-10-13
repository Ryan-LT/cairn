import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

export type StackedBarSegment = {
  key: string;
  value: number;
  /** CSS colour (a chart slot or `var(--muted-foreground)`). */
  color: string;
  label: ReactNode;
  /** Shown after the label in the legend (amount, %). */
  detail?: ReactNode;
};

type StackedBarProps = {
  segments: StackedBarSegment[];
  /** Accessible summary of the whole bar. */
  label: string;
  /** Optional reference marks (0–1 along the bar), e.g. the 50 / 30 / 20 split. */
  markers?: { at: number; label: string }[];
  className?: string;
};

/** One horizontal bar split into parts with a 2px gap between them, and a legend below (identity never by colour alone). */
export function StackedBar({ segments, label, markers, className }: StackedBarProps) {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((s, x) => s + x.value, 0);
  return (
    <div className={cn("grid gap-3", className)}>
      <div role="img" aria-label={label} className="relative">
        <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted motion-safe:animate-draw-in">
          {total > 0
            ? visible.map((s) => (
                <div key={s.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
              ))
            : null}
        </div>
        {markers?.map((m) => (
          <span
            key={m.label}
            aria-hidden
            title={m.label}
            className="absolute -top-1 h-5 w-0.5 rounded-full bg-foreground/50"
            style={{ left: `calc(${Math.min(1, Math.max(0, m.at)) * 100}% - 1px)` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs" aria-hidden>
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
            {s.detail ? <span className="font-medium text-foreground">{s.detail}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
