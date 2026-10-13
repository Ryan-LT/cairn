"use client";

import { useState } from "react";
import { NumericFormat, type NumberFormatValues } from "react-number-format";

import { useI18n } from "@/shared/i18n";
import type { Currency } from "@/shared/lib/currency/rates";
import { useCurrency } from "@/shared/lib/currency/provider";
import { cn } from "@/shared/lib/cn";
import { formatMoney, formatNumber, formatUsdAmount } from "@/shared/lib/format";
import { Input } from "@/shared/ui/kit/input";

export type MoneyInputProps = {
  /** VND, or (when `currency` is given) an amount in that currency. */
  value: number | undefined;
  onChange: (next: number) => void;
  /**
   * The value is in this currency and stays so (an asset, income or bill held
   * in USD). The switch then changes the record's currency, converting the
   * amount. Without it, the value is VND and typing in USD converts as you go.
   */
  currency?: Currency;
  onCurrencyChange?: (next: Currency) => void;
  /** The ₫ / $ switch (default: shown once a USD rate is known). */
  currencySwitch?: boolean;
  /** The line under the input with the other currency (default true). */
  showConversion?: boolean;
  onBlur?: () => void;
  min?: number;
  max?: number;
  allowNegative?: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  name?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /** Needed when there's no visible <label> for the input. */
  "aria-label"?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Plain numeric string for the USD field ("1234.5"), so a half-typed "12," survives re-renders. */
function usdText(n: number | undefined): string {
  return n !== undefined && Number.isFinite(n) ? String(round2(n)) : "";
}

function allowed(v: number | undefined, opts: { allowNegative: boolean; min?: number; max?: number }) {
  if (v === undefined) return true;
  if (!opts.allowNegative && v < 0) return false;
  if (opts.min !== undefined && v < opts.min) return false;
  if (opts.max !== undefined && v > opts.max) return false;
  return true;
}

/**
 * Money input written the same way as the display: `1.245.670.000 ₫` or
 * `$1.234,50`. A small ₫ / $ switch picks the currency you type in.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  onCurrencyChange,
  currencySwitch,
  showConversion = true,
  onBlur,
  min,
  max,
  allowNegative = false,
  placeholder,
  className,
  ...rest
}: MoneyInputProps) {
  const { t } = useI18n();
  const ctx = useCurrency();
  const rate = ctx?.rates.vndPerUsd ?? null;
  const native = currency !== undefined;
  // Convert mode: which currency you type in (starts with the display currency).
  const [entry, setEntry] = useState<Currency>(() => (ctx?.display === "USD" && rate ? "USD" : "VND"));
  // What was typed in USD, kept while the value is the one it produced.
  const [typed, setTyped] = useState<{ text: string; value: number } | null>(null);

  const typing: Currency = native ? currency : rate ? entry : "VND";
  const canSwitch = (currencySwitch ?? true) && rate !== null && (!native || onCurrencyChange !== undefined);

  /** The value in VND (for limits and the conversion line), or null when it can't be known. */
  const vndOf = (v: number | undefined): number | null => {
    if (v === undefined || !Number.isFinite(v)) return null;
    if (native && currency === "USD") return rate ? Math.round(v * rate) : null;
    return v;
  };

  const switchTo = (next: Currency) => {
    if (next === typing || !rate) return;
    setTyped(null);
    if (native) {
      // The record changes currency: carry the amount over at today's rate.
      const v = value !== undefined && Number.isFinite(value) ? value : 0;
      onCurrencyChange?.(next);
      onChange(next === "USD" ? round2(v / rate) : Math.round(v * rate));
    } else {
      setEntry(next);
    }
  };

  const limits = { allowNegative, min, max };
  let field: React.ReactNode;
  if (typing === "VND") {
    field = (
      <NumericFormat
        customInput={Input}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={0}
        suffix=" ₫"
        allowNegative={allowNegative}
        value={value !== undefined && Number.isFinite(value) ? value : ""}
        onValueChange={(vals) => onChange(vals.floatValue ?? 0)}
        onBlur={onBlur}
        isAllowed={(vals) => allowed(vals.floatValue, limits)}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? "0 ₫"}
        className={cn("tabular-nums", canSwitch && "pr-20", className)}
        {...rest}
      />
    );
  } else {
    // USD typed: native mode stores dollars; convert mode stores the VND it comes to.
    const shownUsd = native ? value : value !== undefined && rate ? value / rate : undefined;
    const text = typed && typed.value === value ? typed.text : usdText(shownUsd);
    field = (
      <NumericFormat
        customInput={Input}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        prefix="$"
        allowNegative={allowNegative}
        valueIsNumericString
        value={text}
        onValueChange={(vals: NumberFormatValues) => {
          const usd = vals.floatValue ?? 0;
          const next = native ? round2(usd) : rate ? Math.round(usd * rate) : 0;
          setTyped({ text: vals.value, value: next });
          onChange(next);
        }}
        onBlur={onBlur}
        isAllowed={(vals) => {
          if (vals.floatValue === undefined) return true;
          const vnd = rate ? vals.floatValue * rate : null;
          return allowed(vals.floatValue, { allowNegative }) && (vnd === null || allowed(vnd, limits));
        }}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder && !placeholder.includes("₫") ? placeholder : "$0"}
        className={cn("tabular-nums", canSwitch && "pr-20", className)}
        {...rest}
      />
    );
  }

  const vnd = vndOf(value);
  let conversion: string | null = null;
  if (showConversion && rate && vnd !== null && vnd !== 0) {
    conversion =
      typing === "USD"
        ? t.currency.input.equals({ amount: formatMoney(vnd, { currency: "VND" }), rate: formatNumber(rate) })
        : ctx?.display === "USD"
          ? t.currency.input.about({ amount: formatUsdAmount(vnd / rate) })
          : null;
  }

  if (!canSwitch && !conversion) return field;
  return (
    <div className="grid gap-1">
      <div className="relative">
        {field}
        {canSwitch ? (
          <div
            role="radiogroup"
            aria-label={t.currency.input.switchLabel}
            className="absolute top-1/2 right-1.5 flex -translate-y-1/2 rounded-md bg-muted p-0.5 text-xs font-semibold"
          >
            {(["VND", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={typing === c}
                aria-label={t.currency.names[c]}
                disabled={rest.disabled}
                onClick={() => switchTo(c)}
                className={cn(
                  "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  typing === c && "bg-card text-foreground shadow-sm",
                )}
              >
                {c === "VND" ? "₫" : "$"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {conversion ? (
        <p className="px-0.5 text-xs text-muted-foreground tabular-nums" data-private>
          {conversion}
        </p>
      ) : null}
    </div>
  );
}
