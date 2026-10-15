import * as React from "react";

import { cn } from "@/shared/lib/cn";

/** Shared field chrome used by Input, Textarea, Select and the money/percent inputs. */
export const fieldClassName = cn(
  "w-full min-w-0 rounded-md border border-input bg-card text-sm shadow-xs transition-[color,box-shadow] outline-none",
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
  "aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-danger/25",
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClassName,
        "flex h-9 px-3 py-1",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
