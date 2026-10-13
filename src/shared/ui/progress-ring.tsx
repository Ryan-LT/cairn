import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

const TONES = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  capstone: "text-capstone",
  muted: "text-muted-foreground",
} as const;

export type ProgressRingTone = keyof typeof TONES;

type ProgressRingProps = {
  /** 0–1 (clamped). */
  value: number;
  size?: number;
  stroke?: number;
  tone?: ProgressRingTone;
  /** Accessible description, e.g. "40 % of target". */
  label: string;
  className?: string;
  /** Reached: a full green ring with a check in the middle replaces the centre label. */
  complete?: boolean;
  children?: ReactNode;
};

/** Circular progress with an optional centre label. */
export function ProgressRing({ value, size = 56, stroke = 6, tone = "primary", label, className, complete, children }: ProgressRingProps) {
  const v = complete ? 1 : Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={label} className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          // Fills from empty when it appears, then eases to new values.
          style={{ "--ring-c": c } as CSSProperties}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out motion-safe:animate-ring-fill motion-reduce:transition-none",
            TONES[complete ? "success" : tone],
            v === 0 && "opacity-0",
          )}
        />
      </svg>
      {complete ? (
        // A soft disc inside the ring; the check pops in once the ring has filled.
        <span className="absolute flex items-center justify-center rounded-full bg-success/12 text-success" style={{ inset: stroke + 2 }}>
          <Check className="size-[58%] [animation-delay:700ms] motion-safe:animate-check-pop motion-safe:[animation-fill-mode:backwards]" strokeWidth={3} aria-hidden />
        </span>
      ) : children ? (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">{children}</span>
      ) : null}
    </div>
  );
}
