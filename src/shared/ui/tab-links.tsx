"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, type MouseEvent } from "react";

import { cn } from "@/shared/lib/cn";

export type TabLink = { href: string; label: string; icon?: LucideIcon; active: boolean };

/**
 * A row of page tabs (links). Scrolls sideways on narrow screens. The active
 * tab's pill slides to the tab you pick (it moves before the page changes, so
 * the tap is acknowledged at once).
 */
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
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const activeHref = tabs.find((t) => t.active)?.href;

  // Positioned straight from the DOM (no re-render); until it's placed, the active tab paints its own pill.
  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const place = (animate: boolean) => {
      // The tab's list item: positioned against the list (the link sits inside its relative <li>).
      const active = list.querySelector<HTMLElement>('[aria-current="page"]')?.parentElement;
      if (!active) {
        list.removeAttribute("data-pill");
        return;
      }
      if (!animate) pill.style.transition = "none";
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.transform = `translateX(${active.offsetLeft - 4}px)`;
      if (!animate) {
        void pill.offsetWidth;
        pill.style.transition = "";
      }
      list.setAttribute("data-pill", "on");
    };
    place(list.hasAttribute("data-pill"));
    const ro = new ResizeObserver(() => place(false));
    ro.observe(list);
    return () => ro.disconnect();
  }, [activeHref, tabs.length]);

  return (
    <nav aria-label={label} className={cn("no-scrollbar -mx-1 overflow-x-auto px-1", className)}>
      <ul ref={listRef} className="group/tabs relative flex w-max gap-1 rounded-full border bg-muted/70 p-1">
        <span
          ref={pillRef}
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-card opacity-0 shadow-sm transition-[transform,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-data-[pill=on]/tabs:opacity-100 motion-reduce:transition-none"
        />
        {tabs.map((tab) => (
          <li key={tab.href} className="relative">
            <Link
              href={tab.href}
              onClick={onNavigate ? (e) => onNavigate(e, tab.href) : undefined}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                tab.active
                  ? "bg-card text-foreground shadow-sm group-data-[pill=on]/tabs:bg-transparent group-data-[pill=on]/tabs:shadow-none"
                  : "text-muted-foreground hover:text-foreground",
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
