"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import type { Currency } from "@/shared/lib/currency/rates";
import { DatePicker } from "@/shared/ui/kit/date-picker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/kit/form";
import { Input } from "@/shared/ui/kit/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Switch } from "@/shared/ui/kit/switch";
import { Textarea } from "@/shared/ui/kit/textarea";
import { SegmentedControl } from "@/shared/ui/segmented-control";

import { MoneyInput } from "./money-input";
import { PercentInput } from "./percent-input";

type BaseFieldProps<T extends FieldValues, N extends FieldPath<T>> = {
  control: Control<T>;
  name: N;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
};

export function TextField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
  placeholder,
  autoFocus,
}: BaseFieldProps<T, N> & { placeholder?: string; autoFocus?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} autoFocus={autoFocus} {...field} value={field.value ?? ""} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
  placeholder,
  rows = 2,
}: BaseFieldProps<T, N> & { placeholder?: string; rows?: number }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea placeholder={placeholder} rows={rows} {...field} value={field.value ?? ""} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function MoneyField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
  max,
  autoFocus,
  currency,
  onCurrencyChange,
  currencySwitch,
}: BaseFieldProps<T, N> & {
  max?: number;
  autoFocus?: boolean;
  /** The amount is in this currency (see `MoneyInput`). */
  currency?: Currency;
  onCurrencyChange?: (next: Currency) => void;
  currencySwitch?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <MoneyInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              min={0}
              max={max}
              autoFocus={autoFocus}
              currency={currency}
              onCurrencyChange={onCurrencyChange}
              currencySwitch={currencySwitch}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function PercentField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
}: BaseFieldProps<T, N>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <PercentInput name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
  clearable,
  placeholder,
}: BaseFieldProps<T, N> & { clearable?: boolean; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <DatePicker
              value={field.value ?? ""}
              onChange={field.onChange}
              clearable={clearable}
              placeholder={placeholder}
              aria-invalid={!!fieldState.error}
            />
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export type SelectOption = { value: string; label: ReactNode };

export function SelectField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder,
}: BaseFieldProps<T, N> & { options: SelectOption[]; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="max-h-72">
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

const UNSET = "_unset";
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Day of month 1–31, or "Not set" (stored as `undefined`). */
export function DayOfMonthField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
}: BaseFieldProps<T, N>) {
  const { t } = useI18n();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select
            value={typeof field.value === "number" && field.value >= 1 && field.value <= 31 ? String(field.value) : UNSET}
            onValueChange={(v) => field.onChange(v === UNSET ? undefined : Number.parseInt(v, 10))}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="max-h-72">
              <SelectItem value={UNSET}>{t.shell.ui.notSet}</SelectItem>
              {DAYS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SegmentedField<T extends FieldValues, N extends FieldPath<T>, V extends string>({
  control,
  name,
  label,
  description,
  className,
  options,
  onValueChange,
}: BaseFieldProps<T, N> & { options: { value: V; label: string }[]; onValueChange?: (value: V) => void }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div>
              <SegmentedControl
                value={field.value}
                onValueChange={(v: V) => {
                  field.onChange(v);
                  onValueChange?.(v);
                }}
                options={options}
                fullWidth
              />
            </div>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  className,
}: BaseFieldProps<T, N>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-row items-start justify-between gap-4 rounded-md border p-3", className)}>
          <div className="grid gap-1">
            <FormLabel>{label}</FormLabel>
            {description ? <FormDescription>{description}</FormDescription> : null}
          </div>
          <FormControl>
            <Switch checked={!!field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
