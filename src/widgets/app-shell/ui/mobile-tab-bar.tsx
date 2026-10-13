"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { isNavActive, NAV_HUBS } from "@/shared/config";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";

import { useOptimisticNavigation } from "../model/navigation";
import { QuickAddSheet } from "./quick-add-sheet";

const TABS = NAV_HUBS.filter((h) => h.mobileTab);
/** The ＋ sits in the middle of the bar. */
const PLUS_AT = Math.floor(TABS.length / 2);

/**
 * Bottom bar below `md`: the four sections with a raised ＋ in the middle
 * (record a payment, add anything). The highlight moves on tap, before the
 * page has rendered.
 */
export function MobileTabBar() {
  const { activePath, onLinkClick, navigate } = useOptimisticNavigation();
  const { t } = useI18n();
  const [addOpen, setAddOpen] = useState(false);

  const tab = (i: number) => {
    const item = TABS[i];
    const active = isNavActive(activePath, item.href);
    return (
      <li key={item.href} className="relative">
        <Link
          href={item.href}
          onClick={(e) => onLinkClick(e, item.href)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex h-full flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-[color,transform] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
            active ? "text-primary-soft-foreground" : "text-muted-foreground",
          )}
        >
          <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-300", active && "bg-primary-soft")}>
            <item.icon aria-hidden className={cn("size-5 transition-transform duration-300 motion-reduce:transition-none", active && "scale-105")} />
          </span>
          <span className="leading-none">{t.nav.hubs[item.id].short}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <nav
        aria-label={t.shell.primaryNav}
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/75 md:hidden"
      >
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1.5 py-1">
          {TABS.slice(0, PLUS_AT).map((_, i) => tab(i))}
          <li className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              aria-expanded={addOpen}
              aria-haspopup="dialog"
              aria-label={t.shell.quickAddSheet.title}
              className="flex size-12 -translate-y-2 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform outline-none focus-visible:ring-ring active:scale-95"
            >
              <Plus className={cn("size-6 transition-transform duration-300", addOpen && "rotate-45")} aria-hidden />
            </button>
          </li>
          {TABS.slice(PLUS_AT).map((_, i) => tab(i + PLUS_AT))}
        </ul>
      </nav>
      <QuickAddSheet open={addOpen} onOpenChange={setAddOpen} navigate={navigate} />
    </>
  );
}
