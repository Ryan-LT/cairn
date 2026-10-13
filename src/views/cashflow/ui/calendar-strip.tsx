"use client";

import { Banknote } from "lucide-react";
import { useEffect, useRef } from "react";

import type { MonthView } from "@/entities/expense";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/format";
import { monthStart } from "@/shared/lib/month";

const DOT: Record<string, string> = {
  paid: "bg-success",
  autopaid: "bg-success",
  skipped: "bg-muted-foreground/40",
  overdue: "bg-danger",
  due_today: "bg-warning",
  due_soon: "bg-warning",
  upcoming: "bg-muted-foreground",
  unconfirmed: "bg-info",
};

/** The month's days in a scrollable strip: dots for bills due (coloured by status), a note for paydays. Tap a day to filter. */
export function CalendarStrip({
  view,
  todayIso,
  selected,
  onSelect,
}: {
  view: MonthView;
  todayIso: string;
  selected: string | null;
  onSelect: (iso: string | null) => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLOListElement>(null);
  const statusById = new Map(view.lines.filter((l) => l.kind === "bill").map((l) => [l.item.id, l.kind === "bill" ? l.status : "upcoming"]));

  // Start scrolled to today in the current month.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-today]");
    if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2;
  }, [view.monthKey]);

  return (
    <section aria-label={t.cashflow.month.calendar}>
      <ol ref={ref} className="no-scrollbar flex gap-1.5 overflow-x-auto scroll-smooth pb-1">
        {view.calendar.map((d) => {
          const isToday = d.iso === todayIso;
          const isSelected = d.iso === selected;
          const hasStuff = d.billIds.length > 0 || d.paydayIds.length > 0;
          const weekday = formatDate(new Date(`${d.iso}T12:00:00`), "dayMonth");
          return (
            <li key={d.iso} data-today={isToday || undefined}>
              <button
                type="button"
                disabled={!d.billIds.length}
                onClick={() => onSelect(isSelected ? null : d.iso)}
                aria-pressed={isSelected}
                aria-label={weekday}
                className={cn(
                  "flex h-16 w-11 flex-col items-center justify-between rounded-xl border py-2 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default",
                  isSelected ? "border-primary bg-primary text-primary-foreground" : isToday ? "border-primary/50 bg-primary-soft text-primary-soft-foreground" : hasStuff ? "bg-card" : "border-transparent text-muted-foreground",
                )}
              >
                <span className={cn("tabular-nums", (isToday || isSelected) && "font-semibold")}>{d.day}</span>
                <span className="flex h-2 items-center gap-0.5" aria-hidden>
                  {d.billIds.slice(0, 3).map((id) => (
                    <span key={id} className={cn("size-1.5 rounded-full", isSelected ? "bg-primary-foreground" : DOT[statusById.get(id) ?? "upcoming"])} />
                  ))}
                  {d.paydayIds.length ? <Banknote className={cn("size-3", isSelected ? "text-primary-foreground" : "text-success")} aria-label={t.cashflow.month.payday} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="sr-only">{formatDate(monthStart(view.monthKey), "monthYear")}</p>
    </section>
  );
}
