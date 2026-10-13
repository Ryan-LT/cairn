"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatDate } from "@/shared/lib/format";
import { addMonths, monthStart, type MonthKey } from "@/shared/lib/month";
import { Button } from "@/shared/ui/kit/button";

type MonthSwitcherProps = {
  value: MonthKey;
  onChange: (next: MonthKey) => void;
  /** The current month: "this month" shortcut and labelling. */
  current: MonthKey;
  min?: MonthKey;
  max?: MonthKey;
  className?: string;
};

/** ‹ Tháng 10, 2026 › with a jump back to the current month. */
export function MonthSwitcher({ value, onChange, current, min, max, className }: MonthSwitcherProps) {
  const { t } = useI18n();
  const prev = addMonths(value, -1);
  const next = addMonths(value, 1);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button variant="ghost" size="icon-sm" onClick={() => onChange(prev)} disabled={min !== undefined && prev < min} aria-label={t.common.previousMonth}>
        <ChevronLeft />
      </Button>
      <p className="min-w-32 text-center text-sm font-semibold capitalize" aria-live="polite">
        {formatDate(monthStart(value), "monthYear")}
      </p>
      <Button variant="ghost" size="icon-sm" onClick={() => onChange(next)} disabled={max !== undefined && next > max} aria-label={t.common.nextMonth}>
        <ChevronRight />
      </Button>
      {value !== current ? (
        <Button variant="outline" size="sm" className="ml-1" onClick={() => onChange(current)}>
          {t.common.thisMonth}
        </Button>
      ) : null}
    </div>
  );
}
