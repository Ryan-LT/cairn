"use client";

import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Clock, Landmark, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { totalCombinedAssetValue } from "@/entities/portfolio";
import { PREFERENCES_SEED, registerExtraAssetCategory } from "@/entities/preferences";
import {
  createSettingsAssetDraft,
  customCategoryToRegister,
  mergeAssetCategoryOptions,
  reorderVisible,
  resolveSettingsAssetLiquidity,
  sanitizeSettingsAsset,
  SETTINGS_ASSETS_SEED,
  sortSettingsAssets,
  totalSettingsAssetsValue,
  type AssetSortKey,
  type AssetSortState,
  type SettingsAsset,
} from "@/entities/settings-asset";
import { CategoryBadge, LiquidityBadge } from "@/entities/settings-asset/ui";
import { useI18n } from "@/shared/i18n";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { useTable } from "@/shared/storage";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { DataTable, DataTableColumnHeader, DataTableToolbar, matchesSearch, RowActions, type RowAction } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { Button } from "@/shared/ui/kit/button";
import { Money } from "@/shared/ui/money";
import { Section } from "@/shared/ui/section";
import { StatCard, StatGrid } from "@/shared/ui/stat-card";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { AssetFormDialog } from "./asset-form-dialog";
import { LegacyHoldings } from "./legacy-holdings";

const COLUMN_TO_KEY: Record<string, AssetSortKey> = {
  name: "name",
  category: "category",
  liquidity: "liquidity",
  currentValue: "value",
};
const KEY_TO_COLUMN: Record<AssetSortKey, string> = {
  name: "name",
  category: "category",
  liquidity: "liquidity",
  value: "currentValue",
};

type DialogState = { mode: "create" | "edit"; asset: SettingsAsset };

export function AssetsPage() {
  const [assets, setAssets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [legacy] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const { t } = useI18n();
  const m = t.assets;

  const [sort, setSort] = useState<AssetSortState | null>(null);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SettingsAsset | null>(null);

  const categoryOptions = useMemo(() => mergeAssetCategoryOptions(prefs, assets), [prefs, assets]);

  // Domain sort (keeps the id tie-break); the table only renders.
  const displayed = useMemo(() => (sort ? sortSettingsAssets(assets, sort.key, sort.dir) : assets), [assets, sort]);
  const visible = useMemo(
    () => displayed.filter((a) => matchesSearch(`${a.name} ${a.category}`, search)),
    [displayed, search],
  );
  const sorting: SortingState = sort ? [{ id: KEY_TO_COLUMN[sort.key], desc: sort.dir === "desc" }] : [];

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

  const reorder = useCallback(
    (activeId: string, overId: string) => {
      const next = reorderVisible(displayed, activeId, overId);
      if (!next) return;
      setAssets(() => next);
      setSort(null);
    },
    [displayed, setAssets],
  );

  const actionsFor = useCallback(
    (asset: SettingsAsset, withMove: boolean): RowAction[] => {
      const index = displayed.findIndex((a) => a.id === asset.id);
      const canMove = !search.trim();
      const moves: RowAction[] = withMove
        ? [
            {
              label: m.list.moveUp,
              icon: ArrowUp,
              disabled: !canMove || index <= 0,
              onSelect: () => reorder(asset.id, displayed[index - 1].id),
            },
            {
              label: m.list.moveDown,
              icon: ArrowDown,
              disabled: !canMove || index === -1 || index >= displayed.length - 1,
              onSelect: () => reorder(asset.id, displayed[index + 1].id),
            },
            "separator",
          ]
        : [];
      return [
        { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(asset) },
        ...moves,
        ...(withMove ? [] : (["separator"] as RowAction[])),
        { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(asset) },
      ];
    },
    [displayed, search, reorder, openEdit, m, t.common],
  );

  const catalogTotal = totalSettingsAssetsValue(assets);
  const instantTotal = assets
    .filter((a) => resolveSettingsAssetLiquidity(a.liquidity) === "instant")
    .reduce((s, a) => s + Math.max(0, a.currentValue), 0);
  const grossTotal = totalCombinedAssetValue(legacy, assets);

  const columns = useMemo<ColumnDef<SettingsAsset>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title={m.list.colName} />,
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "category",
        header: ({ column }) => <DataTableColumnHeader column={column} title={m.list.colCategory} />,
        cell: ({ row }) => <CategoryBadge category={row.original.category} />,
      },
      {
        id: "liquidity",
        accessorFn: (a) => resolveSettingsAssetLiquidity(a.liquidity),
        header: ({ column }) => <DataTableColumnHeader column={column} title={m.list.colAccess} />,
        cell: ({ row }) => <LiquidityBadge liquidity={row.original.liquidity} />,
      },
      {
        accessorKey: "currentValue",
        header: ({ column }) => <DataTableColumnHeader column={column} title={m.list.colValue} align="right" />,
        cell: ({ row }) => <Money value={row.original.currentValue} className="font-medium" />,
        footer: () => <Money value={catalogTotal} className="font-semibold" />,
        meta: { align: "right" },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">{t.common.actions}</span>,
        cell: ({ row }) => <RowActions label={t.common.actionsFor({ name: row.original.name })} actions={actionsFor(row.original, false)} />,
        meta: { className: "w-12" },
      },
    ],
    [actionsFor, catalogTotal, m, t.common],
  );

  return (
    <TabContent>
      <TabToolbar
        actions={
        <Button onClick={openCreate}>
          <Plus />
          {m.addAsset}
        </Button>
        }
      />

      <StatGrid>
        <StatCard label={m.kpi.total.label} icon={Landmark} value={<Money value={grossTotal} compact />} hint={m.kpi.total.hint({ count: assets.length })} />
        <StatCard label={m.kpi.instant.label} icon={Zap} value={<Money value={instantTotal} compact />} hint={m.kpi.instant.hint} />
        <StatCard label={m.kpi.notInstant.label} icon={Clock} value={<Money value={catalogTotal - instantTotal} compact />} hint={m.kpi.notInstant.hint} />
        <StatCard label={m.kpi.categories.label} value={new Set(assets.map((a) => a.category.trim())).size} hint={m.kpi.categories.hint({ count: categoryOptions.length })} />
      </StatGrid>

      <Section title={m.list.title} description={m.list.description} flush>
        <div className="border-b px-5 py-3">
          <DataTableToolbar search={search} onSearchChange={setSearch} placeholder={m.list.searchPlaceholder} />
        </div>
        <DataTable
          columns={columns}
          data={visible}
          getRowId={(a) => a.id}
          getRowLabel={(a) => a.name}
          manualSorting
          sorting={sorting}
          onSortingChange={(updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            const first = next[0];
            setSort(first ? { key: COLUMN_TO_KEY[first.id], dir: first.desc ? "desc" : "asc" } : null);
          }}
          reorder={{
            enabled: !search.trim(),
            disabledReason: m.list.reorderDisabled,
            onReorder: reorder,
          }}
          onRowClick={openEdit}
          empty={
            assets.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title={m.list.emptyTitle}
                description={m.list.emptyDescription}
                action={
                  <Button variant="outline" onClick={openCreate}>
                    <Plus />
                    {m.addAsset}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={m.list.noMatch} />
            )
          }
          renderMobileItem={(a) => (
            <div className="flex items-center gap-3 px-4 py-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(a)}>
                <p className="truncate font-medium">{a.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={a.category} />
                  <LiquidityBadge liquidity={a.liquidity} />
                </div>
              </button>
              <Money value={a.currentValue} className="text-sm font-medium" />
              <RowActions label={t.common.actionsFor({ name: a.name })} actions={actionsFor(a, true)} />
            </div>
          )}
        />
      </Section>

      <LegacyHoldings assets={legacy} />

      <AssetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialog?.mode ?? "create"}
        asset={dialog?.asset ?? null}
        categoryOptions={categoryOptions}
        onSubmit={(draft) => {
          const next = sanitizeSettingsAsset(draft);
          const custom = customCategoryToRegister(next.category);
          if (custom) setPrefs((p) => registerExtraAssetCategory(p, custom));
          if (dialog?.mode === "edit") {
            setAssets((prev) => prev.map((a) => (a.id === next.id ? next : a)));
            toast.success(m.toast.updated);
          } else {
            setAssets((prev) => [...prev, next]);
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
        description={
          pendingDelete ? m.confirmDelete.description({ name: pendingDelete.name }) : null
        }
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          setAssets((prev) => prev.filter((a) => a.id !== removed.id));
          toast.success(m.toast.deleted, { description: removed.name });
        }}
      />
    </TabContent>
  );
}
