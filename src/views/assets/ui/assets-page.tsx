"use client";

import { ArrowLeftRight, ChartPie, Clock, History, Pencil, Plus, RefreshCw, ScrollText, Search, Trash2, TrendingUp, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { GOALS_SEED } from "@/entities/goal";
import { accountActivity, isAccountAsset, useLedger } from "@/entities/ledger";
import { useIncomeSources } from "@/entities/income";
import { assetTotalsByCategory, legacyHoldingsCount, migrateLegacyHoldings } from "@/entities/portfolio";
import { PREFERENCES_SEED, registerExtraAssetCategory } from "@/entities/preferences";
import {
  assetCategoryLabel,
  createSettingsAssetDraft,
  customCategoryToRegister,
  mergeAssetCategoryOptions,
  resolveAssetCategoryEmoji,
  resolveSettingsAssetLiquidity,
  sanitizeSettingsAsset,
  useSettingsAssets,
  type SettingsAsset,
} from "@/entities/settings-asset";
import { LiquidityBadge } from "@/entities/settings-asset/ui";
import { useI18n, type Messages } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import type { AssetHolding } from "@/shared/lib/currency/holding";
import { useCurrency } from "@/shared/lib/currency/provider";
import { formatMoneyCompact, formatNumber, formatRelative, formatUsdAmount } from "@/shared/lib/format";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { useTable } from "@/shared/storage";
import { AmountSheet } from "@/shared/ui/amount-sheet";
import { BarList } from "@/shared/ui/bar-list";
import { Callout } from "@/shared/ui/callout";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { matchesSearch, RowActions, type RowAction } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { Input } from "@/shared/ui/kit/input";
import { ListGroup, ListRow } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { AssetFormDialog } from "./asset-form-dialog";

type DialogState = { mode: "create" | "edit"; asset: SettingsAsset };

/** Values older than this get a gentle "update me" nudge. */
const STALE_DAYS = 90;

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

function EmojiTile({ emoji }: { emoji: string }) {
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-base">
      {emoji}
    </span>
  );
}

/** Net worth › Assets: everything owned, grouped by category, with quick value updates. */
export function AssetsPage() {
  const [assets, setAssets, , storedAssets] = useSettingsAssets();
  const { txns } = useLedger();
  const router = useRouter();
  const usdRate = useCurrency()?.rates.vndPerUsd ?? null;
  // How much recorded money moved each account since its balance was last typed in.
  const activity = useMemo(() => accountActivity(storedAssets, txns, todayIso(), usdRate), [storedAssets, txns, usdRate]);
  const [legacy, setLegacy] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [goals, setGoals] = useTable("goals", GOALS_SEED);
  const [incomeSources, setIncomeSources] = useIncomeSources();
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const { t } = useI18n();
  const m = t.assets;
  const w = t.wealth.assets;

  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SettingsAsset | null>(null);
  const [updating, setUpdating] = useState<SettingsAsset | null>(null);

  const categoryOptions = useMemo(() => mergeAssetCategoryOptions(prefs, assets), [prefs, assets]);
  const legacyCount = legacyHoldingsCount(legacy);

  const openCreate = useCallback(() => {
    setDialog({ mode: "create", asset: createSettingsAssetDraft() });
    setDialogOpen(true);
  }, []);
  const openEdit = useCallback((asset: SettingsAsset) => {
    setDialog({ mode: "edit", asset: { ...asset } });
    setDialogOpen(true);
  }, []);
  useCreateParam(openCreate, (id) => {
    const a = assets.find((x) => x.id === id);
    if (a) openEdit(a);
  });

  const visible = useMemo(() => assets.filter((a) => matchesSearch(`${a.name} ${a.category} ${assetCategoryLabel(a.category)}`, search)), [assets, search]);
  const groups = useMemo(() => {
    const map = new Map<string, SettingsAsset[]>();
    for (const a of visible) map.set(a.category, [...(map.get(a.category) ?? []), a]);
    return [...map.entries()]
      .map(([category, items]) => ({ category, items: items.sort((a, b) => b.currentValue - a.currentValue), total: items.reduce((s, a) => s + Math.max(0, a.currentValue), 0) }))
      .sort((a, b) => b.total - a.total);
  }, [visible]);
  const byCategory = useMemo(() => assetTotalsByCategory(assets, legacy), [assets, legacy]);

  // Totals include the old imported holdings so they always add up to net worth.
  const instant =
    assets.filter((a) => resolveSettingsAssetLiquidity(a.liquidity) === "instant").reduce((s, a) => s + Math.max(0, a.currentValue), 0) +
    legacy.cashAccounts.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const total = byCategory.reduce((s, c) => s + c.value, 0);
  // Assets held in USD or gold follow the market, so they never go stale.
  const stale = assets.filter((a) => !a.holding && !activity.get(a.id)?.count && (daysSince(a.updatedAt) ?? Infinity) > STALE_DAYS && a.currentValue > 0).length;
  /** Live assets are updated by editing the dollars or the weight, not the đồng value. */
  const updateValue = (asset: SettingsAsset) => (asset.holding ? openEdit(asset) : setUpdating(asset));

  const actionsFor = (asset: SettingsAsset): RowAction[] => [
    { label: w.updateValue, icon: RefreshCw, onSelect: () => updateValue(asset) },
    ...(isAccountAsset(asset) ? [{ label: t.ledger.history.accountTransactions, icon: ScrollText, onSelect: () => router.push(`/cashflow/history?account=${encodeURIComponent(asset.id)}`) }] : []),
    { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(asset) },
    "separator",
    { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(asset) },
  ];

  const migrate = () => {
    const out = migrateLegacyHoldings({ assets: legacy, catalog: storedAssets, goals, incomeSources });
    // All four tables go out in the same sync.
    setAssets(() => out.catalog);
    setGoals(() => out.goals);
    setIncomeSources(() => out.incomeSources);
    setLegacy(() => out.assets);
    toast.success(t.wealth.migrate.done({ count: legacyCount }));
  };

  return (
    <TabContent>
      <TabToolbar
        actions={
          <Button onClick={openCreate}>
            <Plus />
            {m.addAsset}
          </Button>
        }
      >
        {assets.length > 5 ? (
          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={m.list.searchPlaceholder} aria-label={m.list.searchPlaceholder} className="pl-8" />
          </div>
        ) : null}
      </TabToolbar>

      {legacyCount > 0 ? (
        <Callout tone="info" title={t.wealth.migrate.title({ count: legacyCount })} icon={History}>
          <p>{t.wealth.migrate.body}</p>
          <Button size="sm" className="mt-2" onClick={migrate}>
            {t.wealth.migrate.action}
          </Button>
        </Callout>
      ) : null}

      {assets.length === 0 && legacyCount === 0 ? (
        <Card className="gap-0 py-0">
          <EmptyState
            art="coins"
            title={m.list.emptyTitle}
            description={m.list.emptyDescription}
            action={
              <Button onClick={openCreate}>
                <Plus />
                {m.addAsset}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
            <StatGrid className="grid-cols-2 xl:col-span-2 xl:grid-cols-1">
              <StatCard help="assetInstant" tone="teal" label={m.kpi.instant.label} icon={Zap} value={<Money value={instant} compact />} hint={m.kpi.instant.hint} />
              <StatCard help="assetNotInstant" tone="blue" label={m.kpi.notInstant.label} icon={Clock} value={<Money value={Math.max(0, total - instant)} compact />} hint={m.kpi.notInstant.hint} />
            </StatGrid>
            <Section title={w.byCategory} className="xl:col-span-3" help="assetsByCategory" icon={ChartPie} tone="amber">
              <BarList
                items={byCategory.slice(0, 6).map((c) => ({
                  key: c.category,
                  label: (
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{resolveAssetCategoryEmoji(c.category)}</span>
                      {assetCategoryLabel(c.category)}
                    </span>
                  ),
                  value: c.value,
                  valueLabel: <Money value={c.value} compact interactive={false} />,
                  share: total > 0 ? c.value / total : 0,
                }))}
              />
            </Section>
          </div>

          {stale > 0 ? <p className="px-1 text-sm text-muted-foreground">{w.stale({ count: stale })}</p> : null}

          {visible.length === 0 && search ? <p className="px-1 text-sm text-muted-foreground">{m.list.noMatch}</p> : null}
          <div className="grid gap-5">
            {groups.map((g) => (
              <ListGroup
                key={g.category}
                title={
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{resolveAssetCategoryEmoji(g.category)}</span>
                    {assetCategoryLabel(g.category)}
                  </span>
                }
                aside={<Money value={g.total} compact interactive={false} />}
              >
                {g.items.map((a) => {
                  const days = daysSince(a.updatedAt);
                  // Accounts that follow recorded money aren't stale while it keeps coming in.
                  const isStale = !a.holding && !activity.get(a.id)?.count && (days === null || days > STALE_DAYS);
                  return (
                    <ListRow
                      key={a.id}
                      leading={<EmojiTile emoji={resolveAssetCategoryEmoji(a.category)} />}
                      title={a.name}
                      subtitle={
                        <span className="flex flex-wrap items-center gap-1.5">
                          <LiquidityBadge liquidity={a.liquidity} />
                          {activity.get(a.id)?.count ? (
                            <span title={t.ledger.account.movedHint} className="inline-flex items-center gap-1 font-medium text-foreground/80" data-private>
                              <ArrowLeftRight className="size-3.5 text-primary" aria-hidden />
                              {t.ledger.account.moved({ amount: activityAmount(a, activity.get(a.id)!.delta), count: activity.get(a.id)!.count })}
                            </span>
                          ) : null}
                          {a.holding ? (
                            <span className="inline-flex items-center gap-1 font-medium text-foreground/80" data-private>
                              <TrendingUp className="size-3.5 text-success" aria-hidden />
                              {holdingText(t, a.holding)}
                            </span>
                          ) : (
                            <span className={isStale ? "text-warning" : undefined}>
                              {a.updatedAt ? w.updatedAgo({ ago: formatRelative(new Date(`${a.updatedAt}T12:00:00`)) }) : w.neverUpdated}
                            </span>
                          )}
                        </span>
                      }
                      trailing={<Money value={a.currentValue} compact interactive={false} />}
                      onClick={() => openEdit(a)}
                      label={a.name}
                      actions={
                        <>
                          <Button variant="ghost" size="icon-sm" aria-label={`${w.updateValue}: ${a.name}`} onClick={() => updateValue(a)} className="text-muted-foreground">
                            <RefreshCw />
                          </Button>
                          <RowActions label={t.common.actionsFor({ name: a.name })} actions={actionsFor(a)} />
                        </>
                      }
                    />
                  );
                })}
              </ListGroup>
            ))}
          </div>
        </>
      )}

      <AmountSheet
        open={updating !== null}
        onOpenChange={(o) => !o && setUpdating(null)}
        title={updating ? w.updateTitle({ name: updating.name }) : ""}
        initial={updating?.currentValue ?? 0}
        allowZero
        amountLabel={m.form.currentValue}
        confirmLabel={w.updateConfirm}
        onConfirm={(value) => {
          if (!updating) return;
          const id = updating.id;
          // A value typed in is the balance from now on (money recorded before it is already in it).
          setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, currentValue: value, updatedAt: todayIso(), valueAsOf: new Date().toISOString() } : a)));
          toast.success(w.updated);
        }}
      />

      <AssetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialog?.mode ?? "create"}
        asset={dialog?.asset ?? null}
        categoryOptions={categoryOptions}
        onSubmit={(draft) => {
          const prev = assets.find((a) => a.id === draft.id);
          const valueChanged = !prev || prev.currentValue !== draft.currentValue || JSON.stringify(prev.holding ?? null) !== JSON.stringify(draft.holding ?? null);
          // The form shows today's balance; saving makes it the balance from now on.
          const next = { ...sanitizeSettingsAsset(draft), updatedAt: valueChanged ? todayIso() : prev?.updatedAt, valueAsOf: new Date().toISOString() };
          const custom = customCategoryToRegister(next.category);
          if (custom) setPrefs((p) => registerExtraAssetCategory(p, custom));
          if (dialog?.mode === "edit") {
            setAssets((all) => all.map((a) => (a.id === next.id ? next : a)));
            toast.success(m.toast.updated);
          } else {
            setAssets((all) => [...all, next]);
            toast.success(m.toast.added);
          }
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={m.confirmDelete.title}
        confirmLabel={t.common.delete}
        cancelLabel={t.common.cancel}
        destructive
        description={pendingDelete ? m.confirmDelete.description({ name: pendingDelete.name }) : null}
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          // Undo restores the stored list (balances as saved, not as shown).
          const before = storedAssets;
          setAssets((all) => all.filter((a) => a.id !== removed.id));
          toast.success(m.toast.deleted, { description: removed.name, action: { label: t.common.undo, onClick: () => setAssets(() => before) } });
        }}
      />
    </TabContent>
  );
}

/** "$5.000" or "2 chỉ Vàng 18K (750)". */
function holdingText(t: Messages, holding: AssetHolding): string {
  const h = t.currency.holding;
  if (holding.kind === "usd") return h.usdShort({ amount: formatUsdAmount(holding.amount) });
  return h.goldShort({
    weight: formatNumber(holding.weight, { maximumFractionDigits: 4 }),
    unit: t.currency.gold.unitsShort[holding.unit],
    product: t.currency.gold.products[holding.product],
  });
}

/** The movement in the account's own unit: "−1,2 tr ₫" or "−$12,50". */
function activityAmount(asset: SettingsAsset, delta: number): string {
  return asset.holding?.kind === "usd" ? formatUsdAmount(delta, { signDisplay: "exceptZero" }) : formatMoneyCompact(delta, { signDisplay: "exceptZero" });
}
