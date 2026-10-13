import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/kit/card";
import { Skeleton } from "@/shared/ui/kit/skeleton";

type StatCardProps = {
  label: string;
  /** Usually `<Money compact />`. */
  value: ReactNode;
  icon?: LucideIcon;
  /** One line under the value. */
  hint?: ReactNode;
  /** Right side of the hint row (e.g. a delta badge). */
  aside?: ReactNode;
  href?: string;
  loading?: boolean;
  /** `hero`: the page's headline figure (larger, with the soft glow). */
  variant?: "default" | "hero";
  className?: string;
};

/** KPI tile with a single fixed type scale. */
export function StatCard({ label, value, icon: Icon, hint, aside, href, loading, variant = "default", className }: StatCardProps) {
  const hero = variant === "hero";
  return (
    <Card
      className={cn(
        "relative h-full gap-2 px-4 py-4",
        hero && "bg-hero gap-3 px-5 py-5",
        href && "transition-colors focus-within:border-ring hover:border-foreground/20 hover:bg-accent/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {href ? (
          // Stretched link: the whole card is clickable without nesting the value's button inside a link.
          <Link
            href={href}
            className="line-clamp-2 text-sm leading-snug font-medium text-muted-foreground outline-none after:absolute after:inset-0 after:rounded-lg"
          >
            {label}
          </Link>
        ) : (
          <p className="line-clamp-2 text-sm leading-snug font-medium text-muted-foreground">{label}</p>
        )}
        {Icon ? <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground max-sm:hidden" aria-hidden /> : null}
      </div>
      {/* Big standalone numbers use proportional figures (tabular only in columns). */}
      <div className={cn("mt-auto font-semibold **:normal-nums", hero ? "text-display md:text-hero" : "text-xl leading-tight tracking-tight md:text-2xl")}>
        {loading ? <Skeleton className="h-7 w-28" /> : value}
      </div>
      {hint || aside ? (
        <div className="relative z-[1] flex min-h-4 items-center justify-between gap-2 text-xs text-muted-foreground">
          {/* On phones a badge (aside) wins over a truncated hint. */}
          <span className={cn("min-w-0 truncate", aside && "max-sm:hidden")}>{hint}</span>
          {aside}
        </div>
      ) : null}
    </Card>
  );
}

/** Responsive KPI row: 2 columns on phones, up to 4 on desktop. */
export function StatGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4", className)}>{children}</div>;
}
