import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/** A form field's problem, under the field: icon + text, announced when it appears. */
export function FieldError({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn("flex items-start gap-1.5 text-sm font-medium text-danger", className)}>
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
