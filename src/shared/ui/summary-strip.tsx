import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/kit/card";

export type SummaryItem = {
  key: string;
  icon: LucideIcon;
  /** Tailwind text colour for the icon (e.g. `text-success`). */
  tone: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
};

/** A section's headline figures side by side (3 on phones too), with an optional footer line. */
export function SummaryStrip({ items, footer, className }: { items: SummaryItem[]; footer?: ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <div className="grid divide-x py-4" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(({ key, icon: Icon, tone, label, value, sub }) => (
          <div key={key} className="grid min-w-0 gap-1 px-3 first:pl-4 last:pr-4 md:px-5 md:first:pl-5 md:last:pr-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground md:text-sm">
              <Icon className={cn("size-3.5 shrink-0 md:size-4", tone)} aria-hidden />
              <span className="truncate">{label}</span>
            </p>
            <p className="truncate text-lg font-semibold tracking-tight md:text-2xl">{value}</p>
            {sub ? <p className="truncate text-xs text-muted-foreground">{sub}</p> : null}
          </div>
        ))}
      </div>
      {footer ? <div className="border-t px-4 py-3 md:px-5">{footer}</div> : null}
    </Card>
  );
}
