import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

import { cn } from "@/shared/lib/cn";

export type TabLink = { href: string; label: string; icon?: LucideIcon; active: boolean };

/** A row of page tabs (links). Scrolls sideways on narrow screens. */
export function TabLinks({
  tabs,
  label,
  onNavigate,
  className,
}: {
  tabs: TabLink[];
  label: string;
  onNavigate?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("no-scrollbar -mx-1 overflow-x-auto px-1", className)}>
      <ul className="flex w-max gap-1 rounded-full border bg-muted/70 p-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              onClick={onNavigate ? (e) => onNavigate(e, tab.href) : undefined}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                tab.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.icon ? <tab.icon className="size-4" aria-hidden /> : null}
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
