"use client";

import { Pencil, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { completeGoldPrices, GOLD_JEWELRY, GOLD_PRODUCTS, type GoldProductId } from "@/shared/lib/currency/gold";
import { useCurrency } from "@/shared/lib/currency/provider";
import type { Currency, GoldBasis } from "@/shared/lib/currency/rates";
import { formatDate, formatMoney, formatNumber, formatTime } from "@/shared/lib/format";
import { AmountSheet } from "@/shared/ui/amount-sheet";
import { Callout } from "@/shared/ui/callout";
import { Button } from "@/shared/ui/kit/button";
import { Label } from "@/shared/ui/kit/label";
import { Switch } from "@/shared/ui/kit/switch";
import { Section } from "@/shared/ui/section";
import { SegmentedControl } from "@/shared/ui/segmented-control";

/** Shown before "every purity" is opened. */
const MAIN_PRODUCTS: readonly GoldProductId[] = ["sjc_bar", "ring_9999", "k24", "k18", "k14", "k10"];

/** "17:30" today, "12 thg 10, 2026 17:30" otherwise. */
function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Date().toDateString() === d.toDateString() ? formatTime(d) : `${formatDate(d, "medium")} ${formatTime(d)}`;
}

/** Settings → Currency and gold prices: display currency, live rates, own overrides. */
export function CurrencySection() {
  const { t } = useI18n();
  const c = t.currency;
  const s = c.settings;
  const ctx = useCurrency();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<GoldProductId | "usd" | null>(null);
  if (!ctx) return null;
  const { snapshot, rates, prefs, chosen, loading, error, refresh, updatePrefs } = ctx;

  const quoted = new Set(Object.keys(snapshot?.gold?.prices ?? {}));
  const prices = snapshot?.gold ? completeGoldPrices(snapshot.gold.prices) : {};
  const rows = (showAll ? GOLD_PRODUCTS : MAIN_PRODUCTS).filter((p) => prices[p] || prefs.goldPrices?.[p]);
  const productName = (p: GoldProductId) => c.gold.products[p];
  const editingName = editing && editing !== "usd" ? productName(editing) : "";

  const setOwnGold = (p: GoldProductId, value: number | null) =>
    updatePrefs((cur) => {
      const next = { ...(cur.goldPrices ?? {}) };
      if (value === null) delete next[p];
      else next[p] = value;
      return { ...cur, goldPrices: Object.keys(next).length ? next : undefined };
    });

  return (
    <div id="currency" className="scroll-mt-20">
      <Section
        title={s.title}
        description={s.description}
        actions={
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn(loading && "animate-spin")} />
            {loading ? s.refreshing : s.refresh}
          </Button>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-medium">{s.display}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.displayHint}</p>
          </div>
          <SegmentedControl<Currency>
            aria-label={s.display}
            value={chosen}
            onValueChange={(v) => updatePrefs((p) => ({ ...p, display: v }))}
            options={[
              { value: "VND", label: "₫ VND" },
              { value: "USD", label: "$ USD" },
            ]}
          />
        </div>

        {error && !snapshot ? (
          <Callout tone="warning" className="mt-4">
            {s.unavailable}
          </Callout>
        ) : null}

        <div className="mt-4 grid gap-3 border-t pt-4">
          <div>
            <p className="text-sm font-medium">{s.usdTitle}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{rates.vndPerUsd ? s.rateLine({ rate: formatNumber(rates.vndPerUsd, { maximumFractionDigits: 2 }) }) : "—"}</p>
            {snapshot?.usd && !rates.usdOverridden ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {c.sources[snapshot.usd.source]} · {s.updated({ time: when(snapshot.usd.at) })}
                {snapshot.usd.buy && snapshot.usd.sell ? ` · ${s.bankLine({ buy: formatNumber(snapshot.usd.buy), sell: formatNumber(snapshot.usd.sell) })}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Label htmlFor="own-usd-rate">{s.ownRate}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.ownRateHint}</p>
            </div>
            <div className="flex items-center gap-2">
              {prefs.usdRate ? (
                <Button type="button" variant="ghost" size="icon" aria-label={s.ownRate} onClick={() => setEditing("usd")}>
                  <Pencil />
                </Button>
              ) : null}
              <Switch
                id="own-usd-rate"
                checked={Boolean(prefs.usdRate)}
                onCheckedChange={(on) => {
                  if (on) setEditing("usd");
                  else updatePrefs((p) => ({ ...p, usdRate: undefined }));
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm font-medium">{s.goldTitle}</p>
            <SegmentedControl<GoldBasis>
              aria-label={s.basis}
              value={rates.goldBasis}
              onValueChange={(v) => updatePrefs((p) => ({ ...p, goldBasis: v === "sell" ? "sell" : undefined }))}
              options={[
                { value: "buy", label: s.basisBuy },
                { value: "sell", label: s.basisSell },
              ]}
            />
          </div>
          <p className="text-xs text-muted-foreground">{s.basisHint}</p>
          {rows.length ? (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-1 py-1.5 font-medium">{s.colProduct}</th>
                    <th className="px-1 py-1.5 text-right font-medium">{s.colBuy}</th>
                    <th className="px-1 py-1.5 text-right font-medium">{s.colSell}</th>
                    <th className="w-10 px-1 py-1.5">
                      <span className="sr-only">{s.ownPrice}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((p) => {
                    const q = prices[p];
                    const own = prefs.goldPrices?.[p];
                    const estimated = !quoted.has(p);
                    return (
                      <tr key={p} className={cn(GOLD_JEWELRY.includes(p) && "text-muted-foreground")}>
                        <td className="px-1 py-2">
                          <span className="font-medium text-foreground">{productName(p)}</span>
                          {own ? <span className="block text-xs text-primary">{s.ownPrice}: {formatMoney(own, { currency: "VND" })}</span> : null}
                          {!own && estimated ? <span className="block text-xs">{s.derived}</span> : null}
                        </td>
                        <td className={cn("px-1 py-2 text-right tabular-nums", rates.goldBasis === "buy" && !own && "font-semibold text-foreground")}>
                          {q ? `${estimated ? "≈ " : ""}${formatNumber(q.buy)}` : "—"}
                        </td>
                        <td className={cn("px-1 py-2 text-right tabular-nums", rates.goldBasis === "sell" && !own && "font-semibold text-foreground")}>
                          {q ? `${estimated ? "≈ " : ""}${formatNumber(q.sell)}` : "—"}
                        </td>
                        <td className="px-1 py-1 text-right">
                          {own ? (
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={s.clearOwnPrice} onClick={() => setOwnGold(p, null)}>
                              <X />
                            </Button>
                          ) : (
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={s.setOwnPrice({ product: productName(p) })} onClick={() => setEditing(p)}>
                              <Pencil />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {snapshot?.gold ? `${s.source({ source: c.sources[snapshot.gold.source] })} · ${s.updated({ time: when(snapshot.gold.at) })}` : null}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? s.showLess : s.showAll}
            </Button>
          </div>
        </div>
      </Section>

      <AmountSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "usd" ? s.ownRate : s.ownPriceTitle({ product: editingName })}
        description={editing === "usd" ? s.ownRateHint : undefined}
        initial={editing === "usd" ? (prefs.usdRate ?? Math.round(rates.vndPerUsd ?? 0)) : editing ? (prefs.goldPrices?.[editing] ?? rates.goldPerChi?.[editing] ?? 0) : 0}
        amountLabel={editing === "usd" ? s.ownRateLabel : s.ownPriceLabel}
        confirmLabel={t.common.save}
        currencySwitch={false}
        onConfirm={(value) => {
          if (editing === "usd") updatePrefs((p) => ({ ...p, usdRate: value }));
          else if (editing) setOwnGold(editing, value);
          toast.success(s.saved);
        }}
      />
    </div>
  );
}
