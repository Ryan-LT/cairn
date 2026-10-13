"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { NumericFormat } from "react-number-format";
import { z } from "zod";

import { assetCategoryLabel, categorySelectOptions, resolveAssetCategoryEmoji, type SettingsAsset } from "@/entities/settings-asset";
import { useI18n, type Messages } from "@/shared/i18n";
import { GOLD_JEWELRY, GOLD_PRODUCTS, WEIGHT_UNITS, type GoldProductId, type WeightUnit } from "@/shared/lib/currency/gold";
import { holdingValueVnd, type AssetHolding } from "@/shared/lib/currency/holding";
import { useCurrency } from "@/shared/lib/currency/provider";
import { formatMoney, formatNumber } from "@/shared/lib/format";
import { ComboboxField, MoneyField, SegmentedField, TextField } from "@/shared/ui/form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/kit/form";
import { Input } from "@/shared/ui/kit/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Form } from "@/shared/ui/kit/form";

const HOLDING_KINDS = ["vnd", "usd", "gold"] as const;

function makeSchema(f: Messages["assets"]["form"], h: Messages["currency"]["holding"]) {
  return z
    .object({
      name: z.string().trim().min(1, f.nameRequired).max(80),
      category: z.string().trim().min(1, f.categoryRequired).max(40),
      liquidity: z.enum(["instant", "not_instant"]),
      currentValue: z.number().min(0),
      holdingKind: z.enum(HOLDING_KINDS),
      usdAmount: z.number().min(0),
      goldProduct: z.enum(GOLD_PRODUCTS),
      goldWeight: z.number().min(0),
      goldUnit: z.enum(WEIGHT_UNITS),
    })
    .superRefine((v, ctx) => {
      if (v.holdingKind === "gold" && !(v.goldWeight > 0)) ctx.addIssue({ code: "custom", path: ["goldWeight"], message: h.weightRequired });
    });
}

/** The holding the form describes (none for plain đồng). */
function holdingOf(v: Pick<Values, "holdingKind" | "usdAmount" | "goldProduct" | "goldWeight" | "goldUnit">): AssetHolding | undefined {
  if (v.holdingKind === "usd") return { kind: "usd", amount: Math.round(v.usdAmount * 100) / 100 };
  if (v.holdingKind === "gold") return { kind: "gold", product: v.goldProduct, weight: v.goldWeight, unit: v.goldUnit };
  return undefined;
}

type Values = z.infer<ReturnType<typeof makeSchema>>;

type AssetFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  asset: SettingsAsset | null;
  categoryOptions: string[];
  onSubmit: (asset: SettingsAsset) => void;
};

export function AssetFormDialog({ open, onOpenChange, asset, ...rest }: AssetFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {asset ? (
          <AssetForm
            key={asset.id}
            asset={asset}
            mode={rest.mode}
            categoryOptions={rest.categoryOptions}
            onCancel={() => onOpenChange(false)}
            onSubmit={(next) => {
              rest.onSubmit(next);
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AssetForm({
  asset,
  mode,
  categoryOptions,
  onCancel,
  onSubmit,
}: {
  asset: SettingsAsset;
  mode: "create" | "edit";
  categoryOptions: string[];
  onCancel: () => void;
  onSubmit: (asset: SettingsAsset) => void;
}) {
  const { t } = useI18n();
  const f = t.assets.form;
  const h = t.currency.holding;
  const rates = useCurrency()?.rates ?? null;
  const schema = useMemo(() => makeSchema(f, h), [f, h]);
  const held = asset.holding;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: asset.name,
      category: asset.category || "Cash",
      liquidity: asset.liquidity === "not_instant" ? "not_instant" : "instant",
      currentValue: asset.currentValue,
      holdingKind: held?.kind ?? "vnd",
      usdAmount: held?.kind === "usd" ? held.amount : rates?.vndPerUsd ? Math.round((asset.currentValue / rates.vndPerUsd) * 100) / 100 : 0,
      goldProduct: held?.kind === "gold" ? held.product : "sjc_bar",
      goldWeight: held?.kind === "gold" ? held.weight : 0,
      goldUnit: held?.kind === "gold" ? held.unit : "chi",
    },
  });
  const category = useWatch({ control: form.control, name: "category" });
  const holdingKind = useWatch({ control: form.control, name: "holdingKind" });
  const options = useMemo(() => categorySelectOptions(categoryOptions, category), [categoryOptions, category]);

  const submit = (v: Values) => {
    const holding = holdingOf(v);
    // The VND value at today's rate; without a rate keep the last known one.
    const live = holding && rates ? holdingValueVnd(holding, rates) : null;
    const currentValue = holding ? (live ?? asset.currentValue) : v.currentValue;
    const base: SettingsAsset = { ...asset };
    delete base.holding;
    onSubmit({
      ...base,
      name: v.name,
      category: v.category,
      liquidity: v.liquidity,
      currentValue,
      ...(holding ? { holding } : {}),
    });
  };

  return (
    <Form {...form}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit(submit)}>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? f.addTitle : f.editTitle}</DialogTitle>
          <DialogDescription>{f.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <TextField control={form.control} name="name" label={f.name} placeholder={f.namePlaceholder} autoFocus={mode === "create"} />
          <ComboboxField
            control={form.control}
            name="category"
            label={f.category}
            options={options}
            allowCreate
            renderOption={(c) => (
              <span className="flex items-center gap-2">
                <span aria-hidden>{resolveAssetCategoryEmoji(c)}</span>
                {assetCategoryLabel(c)}
              </span>
            )}
            description={f.categoryDescription}
          />
          <SegmentedField
            control={form.control}
            name="liquidity"
            label={f.access}
            options={[
              { value: "instant", label: t.domain.liquidity.instant },
              { value: "not_instant", label: t.domain.liquidity.notInstant },
            ]}
            description={f.accessDescription}
          />
          <SegmentedField
            control={form.control}
            name="holdingKind"
            label={h.label}
            options={HOLDING_KINDS.map((k) => ({ value: k, label: h.kinds[k] }))}
            onValueChange={(k) => {
              // New gold asset: file it under precious metals.
              if (k === "gold" && mode === "create" && form.getValues("category") === "Cash") form.setValue("category", "Precious Metals");
            }}
          />
          {holdingKind === "vnd" ? <MoneyField control={form.control} name="currentValue" label={f.currentValue} currencySwitch={false} /> : null}
          {holdingKind === "usd" ? <MoneyField control={form.control} name="usdAmount" label={h.usdAmount} currency="USD" currencySwitch={false} /> : null}
          {holdingKind === "gold" ? <GoldFields control={form.control} /> : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.common.cancel}
          </Button>
          <Button type="submit">{mode === "create" ? f.submitAdd : t.common.saveChanges}</Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

/** Kind of gold, weight and unit, with what it's worth at today's price. */
function GoldFields({ control }: { control: Control<Values> }) {
  const { t } = useI18n();
  const c = t.currency;
  const h = c.holding;
  const ctx = useCurrency();
  const [product, weight, unit] = useWatch({ control, name: ["goldProduct", "goldWeight", "goldUnit"] });
  const holding: AssetHolding = { kind: "gold", product, weight, unit };
  const value = ctx ? holdingValueVnd(holding, ctx.rates) : null;
  const price = ctx?.rates.goldPerChi?.[product];
  const source = ctx?.snapshot?.gold ? c.sources[ctx.snapshot.gold.source] : null;
  const bars = GOLD_PRODUCTS.filter((p) => !GOLD_JEWELRY.includes(p));

  return (
    <div className="grid gap-3 rounded-xl border bg-muted/30 p-3">
      <FormField
        control={control}
        name="goldProduct"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{h.goldProduct}</FormLabel>
            <Select value={field.value} onValueChange={(v) => field.onChange(v as GoldProductId)}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="max-h-80">
                <SelectGroup>
                  <SelectLabel>{c.gold.groups.bars}</SelectLabel>
                  {bars.map((p) => (
                    <SelectItem key={p} value={p}>
                      {c.gold.products[p]}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>{c.gold.groups.jewelry}</SelectLabel>
                  {GOLD_JEWELRY.map((p) => (
                    <SelectItem key={p} value={p}>
                      {c.gold.products[p]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
        <FormField
          control={control}
          name="goldWeight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{h.weight}</FormLabel>
              <FormControl>
                <NumericFormat
                  customInput={Input}
                  name={field.name}
                  value={Number.isFinite(field.value) && field.value > 0 ? field.value : ""}
                  onValueChange={(v) => field.onChange(v.floatValue ?? 0)}
                  onBlur={field.onBlur}
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={4}
                  allowNegative={false}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  className="tabular-nums"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="goldUnit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{h.unit}</FormLabel>
              <Select value={field.value} onValueChange={(v) => field.onChange(v as WeightUnit)}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {WEIGHT_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {c.gold.units[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>
      <div className="text-sm" aria-live="polite">
        {value !== null && price ? (
          <>
            <p className="font-medium" data-private>
              {h.worth({ amount: formatMoney(value, { currency: "VND" }) })}
            </p>
            <p className="text-xs text-muted-foreground">
              {h.goldBasis({
                price: `${formatNumber(price)} ₫`,
                basis: ctx?.rates.goldBasis === "sell" ? c.settings.basisSell : c.settings.basisBuy,
                source: ctx?.rates.goldOverridden.includes(product) ? c.settings.ownPrice : (source ?? ""),
              })}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">{h.noRate}</p>
        )}
      </div>
    </div>
  );
}
