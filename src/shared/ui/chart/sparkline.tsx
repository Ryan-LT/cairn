import { useId } from "react";

import { cn } from "@/shared/lib/cn";

type SparklineProps = {
  values: number[];
  /** Accessible summary (e.g. "Up 230 tr over 5 months"). */
  label: string;
  className?: string;
  /** Fill the area under the line with a soft gradient. */
  area?: boolean;
};

/** A tiny trend line (no axes): colour comes from `currentColor`. */
export function Sparkline({ values, label, className, area = true }: SparklineProps) {
  const id = useId();
  const w = 120;
  const h = 36;
  const pad = 3;
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (w - pad * 2), pad + (1 - (v - min) / span) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <div role="img" aria-label={label} className={cn("relative h-9 w-full motion-safe:animate-draw-in", className)}>
      {/* Stretched to the card's width, so only strokes (non-scaling) belong in here. */}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
        {area ? (
          <>
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={`${line} L${last[0].toFixed(2)},${h} L${pts[0][0].toFixed(2)},${h} Z`} fill={`url(#${id})`} />
          </>
        ) : null}
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* The latest point: an HTML dot so it stays round however wide the line is drawn. */}
      <span
        aria-hidden
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-card"
        style={{ left: `${(last[0] / w) * 100}%`, top: `${(last[1] / h) * 100}%` }}
      />
    </div>
  );
}
