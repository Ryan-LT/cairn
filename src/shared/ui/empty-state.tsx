import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import { CairnStones } from "./cairn-stones";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Larger, friendlier version with the brand stones (first-run states). */
  illustrated?: boolean;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, illustrated, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 text-center", illustrated ? "py-12" : "py-10", className)}>
      {illustrated ? (
        <CairnStones className="mb-2" />
      ) : Icon ? (
        <div className="mb-1 flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </div>
      ) : null}
      <p className={cn("font-semibold", illustrated ? "text-base" : "text-sm")}>{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
