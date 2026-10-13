import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/kit/card";

type SectionProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Header actions; wrap below the title when there is no room beside it. */
  actions?: ReactNode;
  /** Edge-to-edge content (tables, lists): no side padding, no bottom padding. */
  flush?: boolean;
  /** `plain`: no card, just a heading above the content (for content that brings its own cards). */
  variant?: "card" | "plain";
  className?: string;
  contentClassName?: string;
  children: ReactNode;
};

/** A titled card — the standard container for page sections. */
export function Section({ title, description, actions, flush, variant = "card", className, contentClassName, children }: SectionProps) {
  if (variant === "plain") {
    return (
      <section className={cn("grid gap-3", className)}>
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
          <div className="grid min-w-0 gap-0.5">
            <h2 className="text-base leading-snug font-semibold">{title}</h2>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        <div className={contentClassName}>{children}</div>
      </section>
    );
  }
  return (
    <Card className={cn(flush && "gap-0 overflow-hidden pb-0", className)}>
      <CardHeader className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3", flush && "pb-4")}>
        <div className="grid min-w-0 flex-1 basis-56 gap-1">
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn(flush && "border-t px-0", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
