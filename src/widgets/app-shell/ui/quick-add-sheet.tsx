"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

import { QUICK_ADD } from "@/shared/config";
import { useI18n } from "@/shared/i18n";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/kit/sheet";

import { isPlainClick } from "../model/navigation";
import { useShell } from "../model/shell-context";

type QuickAddSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigate: (href: string) => void;
};

/** Mobile ＋: record a payment or add anything, plus search. */
export function QuickAddSheet({ open, onOpenChange, navigate }: QuickAddSheetProps) {
  const { setCommandOpen } = useShell();
  const { t } = useI18n();
  const [first, ...rest] = QUICK_ADD;

  const go = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onOpenChange(false);
    navigate(href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)] ease-out data-[state=closed]:duration-200 data-[state=open]:duration-300 md:hidden"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border" />
        <SheetHeader className="pb-3">
          <SheetTitle>{t.shell.quickAddSheet.title}</SheetTitle>
          <SheetDescription>{t.shell.quickAddSheet.description}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          {/* The everyday action gets the big button. */}
          <Link
            href={first.href}
            onClick={(e) => go(e, first.href)}
            className="flex items-center gap-3 rounded-xl bg-primary px-4 py-3.5 text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
          >
            <first.icon className="size-5" aria-hidden />
            <span className="text-sm font-semibold">{t.nav.quickAdd[first.id].label}</span>
          </Link>
          <ul className="stagger-in grid grid-cols-3 gap-2">
            {rest.map((action) => (
              <li key={action.href}>
                <Link
                  href={action.href}
                  onClick={(e) => go(e, action.href)}
                  aria-label={t.nav.quickAdd[action.id].label}
                  className="flex h-full flex-col items-center gap-1.5 rounded-xl border bg-card px-1 py-3 text-center text-xs font-medium transition-[background-color,transform] hover:bg-accent active:scale-95"
                >
                  <action.icon className="size-5 text-primary" aria-hidden />
                  {t.nav.quickAdd[action.id].short}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              setCommandOpen(true);
            }}
            className="flex h-11 items-center gap-2 rounded-xl border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            <Search className="size-4" aria-hidden />
            {t.shell.quickAddSheet.search}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
