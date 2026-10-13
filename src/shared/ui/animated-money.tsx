"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { formatMoneyCompact } from "@/shared/lib/format";
import { Money, moneyToneClass, type MoneyTone } from "@/shared/ui/money";

const DURATION_MS = 700;
/** Values already counted up this session (counting again on every visit gets old). */
const seen = new Set<string>();

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * A hero amount that counts up the first time it appears in a session, then
 * settles into a normal compact `Money` (tooltip, tap to expand).
 */
export function AnimatedMoney({
  value,
  id,
  signed,
  tone = "none",
  className,
}: {
  value: number;
  /** Stable key for "counted once". */
  id: string;
  signed?: boolean;
  tone?: MoneyTone;
  className?: string;
}) {
  const [shown, setShown] = useState<number | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (seen.has(id) || prefersReducedMotion() || value === 0) return;
    seen.add(id);
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p < 1 ? value * eased : null);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [id, value]);

  if (shown === null) return <Money value={value} compact signed={signed} tone={tone} className={className} />;
  const signDisplay = signed ? "exceptZero" : "auto";
  return (
    <span className={cn("whitespace-nowrap tabular-nums", moneyToneClass(tone, value), className)} data-private>
      <span aria-hidden>{formatMoneyCompact(shown, { signDisplay })}</span>
      <span className="sr-only">{formatMoneyCompact(value, { signDisplay })}</span>
    </span>
  );
}
