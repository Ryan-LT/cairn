"use client";

import { NumericFormat, type NumberFormatValues } from "react-number-format";

import { cn } from "@/shared/lib/cn";
import { Input } from "@/shared/ui/kit/input";

export type MoneyInputProps = {
  value: number | undefined;
  onChange: (next: number) => void;
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

function allowValues(values: NumberFormatValues, opts: { allowNegative: boolean; min?: number; max?: number }) {
  const v = values.floatValue;
  if (v === undefined) return true;
  if (!opts.allowNegative && v < 0) return false;
  if (opts.min !== undefined && v < opts.min) return false;
  if (opts.max !== undefined && v > opts.max) return false;
  return true;
}

/** VND input written the same way as the display: `1.245.670.000 ₫`. */
export function MoneyInput({
  value,
  onChange,
  onBlur,
  min,
  max,
  allowNegative = false,
  placeholder = "0 ₫",
  className,
  ...rest
}: MoneyInputProps) {
  return (
    <NumericFormat
      customInput={Input}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={0}
      suffix=" ₫"
      allowNegative={allowNegative}
      value={Number.isFinite(value) ? value : ""}
      onValueChange={(vals) => onChange(vals.floatValue ?? 0)}
      onBlur={onBlur}
      isAllowed={(vals) => allowValues(vals, { allowNegative, min, max })}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={cn("tabular-nums", className)}
      {...rest}
    />
  );
}
