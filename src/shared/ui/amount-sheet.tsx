"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatMoneyCompact } from "@/shared/lib/format";
import { MoneyInput } from "@/shared/ui/form";
import { Button } from "@/shared/ui/kit/button";
import { DatePicker } from "@/shared/ui/kit/date-picker";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Label } from "@/shared/ui/kit/label";

type AmountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Amount the field starts with. */
  initial: number;
  /** Quick-amount chips: `add` adds to the field (budget spending), `set` replaces it. */
  presets?: number[];
  presetMode?: "add" | "set";
  /** Show a date field starting at this `YYYY-MM-DD`. */
  initialDate?: string;
  amountLabel?: string;
  confirmLabel: string;
  /** Extra controls under the amount (e.g. a checkbox). */
  children?: ReactNode;
  /** Allow confirming 0 (e.g. "spent nothing"). */
  allowZero?: boolean;
  /** The ₫ / $ switch on the amount (off for prices and rates that are always in đồng). */
  currencySwitch?: boolean;
  onConfirm: (amount: number, date: string) => void;
};

function AmountSheetBody({
  initial,
  presets,
  presetMode = "set",
  initialDate,
  amountLabel,
  confirmLabel,
  children,
  allowZero,
  currencySwitch,
  onConfirm,
  onClose,
}: Omit<AmountSheetProps, "open" | "onOpenChange" | "title" | "description"> & { onClose: () => void }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(initial);
  const [date, setDate] = useState(initialDate ?? "");
  const valid = Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0);
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onConfirm(amount, date);
        onClose();
      }}
    >
      <DialogBody className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="amount-sheet-input">{amountLabel ?? t.common.amount}</Label>
          <MoneyInput
            id="amount-sheet-input"
            value={amount}
            onChange={setAmount}
            min={0}
            autoFocus
            currencySwitch={currencySwitch}
            className="h-12 text-lg font-semibold"
          />
          {presets?.length ? (
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn("rounded-full tabular-nums")}
                  onClick={() => setAmount((a) => (presetMode === "add" ? (a || 0) + p : p))}
                >
                  {presetMode === "add" ? "+" : ""}
                  {formatMoneyCompact(p)}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        {initialDate !== undefined ? (
          <div className="grid gap-2">
            <Label>{t.common.date}</Label>
            <DatePicker value={date} onChange={setDate} />
          </div>
        ) : null}
        {children}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={!valid}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Bottom sheet (dialog on desktop) for entering one amount quickly: paying a bill, logging spending, updating a value. */
export function AmountSheet({ open, onOpenChange, title, description, ...rest }: AmountSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {/* Remount per open so the field starts from `initial` each time. */}
        {open ? <AmountSheetBody {...rest} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
