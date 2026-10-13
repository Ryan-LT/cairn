"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { buildGoalStartingOptions } from "@/entities/goal";
import { capitalYieldPct, createIncomeSourceDraft, effectiveIncomeCapital, incomeCapitalPeers, type IncomeSource, sanitizeIncomeSource, totalCapitalAmount, useIncomeSources } from "@/entities/income";
import { useHouseholdCashflow } from "@/entities/portfolio/model/use-household-cashflow";
import { useSettingsAssets } from "@/entities/settings-asset";
import { useI18n, type Messages } from "@/shared/i18n";
import { formatPercent } from "@/shared/lib/format";
import { useCreateParam } from "@/shared/lib/use-create-param";
import { useTable } from "@/shared/storage";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { RowActions, type RowAction } from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { resolveIcon } from "@/shared/ui/icon-registry";
import { IconTile } from "@/shared/ui/icon-tile";
import { Card } from "@/shared/ui/kit/card";
import { ListGroup, ListRow } from "@/shared/ui/list";
import { Button } from "@/shared/ui/kit/button";
import { Money } from "@/shared/ui/money";
import { TabContent, TabToolbar } from "@/widgets/app-shell";

import { IncomeSourceFormDialog } from "./income-source-form-dialog";

type DialogState = { mode: "create" | "edit"; source: IncomeSource };

function paymentLabel(t: Messages, s: IncomeSource): string {
  const parts = [s.paymentDay ? t.income.paymentDay({ day: s.paymentDay }) : null, s.paymentEntity || null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function IncomePage() {
  const { t } = useI18n();
  const [sources, setSources] = useIncomeSources();
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [settingsAssets] = useSettingsAssets();

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<IncomeSource | null>(null);

  const cash = useHouseholdCashflow();
  const seedOptions = useMemo(() => buildGoalStartingOptions(assets, settingsAssets), [assets, settingsAssets]);
  const peers = useMemo(() => (dialog ? incomeCapitalPeers(sources, dialog.source.id) : []), [sources, dialog]);

  const openCreate = useCallback(() => {
    setDialog({ mode: "create", source: createIncomeSourceDraft() });
    setDialogOpen(true);
  }, []);
  const openEdit = useCallback((s: IncomeSource) => {
    setDialog({ mode: "edit", source: { ...s, capitalLines: [...(s.capitalLines ?? [])] } });
    setDialogOpen(true);
  }, []);
  useCreateParam(openCreate, (id) => {
    const s = sources.find((x) => x.id === id);
    if (s) openEdit(s);
  });

  const actionsFor = useCallback(
    (s: IncomeSource): RowAction[] => [
      { label: t.common.edit, icon: Pencil, onSelect: () => openEdit(s) },
      "separator",
      { label: t.common.delete, icon: Trash2, destructive: true, onSelect: () => setPendingDelete(s) },
    ],
    [openEdit, t],
  );

  return (
    <TabContent>
      <TabToolbar
        actions={
        <Button onClick={openCreate}>
          <Plus />
          {t.income.addSource}
        </Button>
        }
      />

      {sources.length === 0 ? (
        <Card className="gap-0 py-0">
          <EmptyState
            illustrated
            title={t.income.empty.title}
            description={t.income.empty.description}
            action={
              <Button onClick={openCreate}>
                <Plus />
                {t.income.addSource}
              </Button>
            }
          />
        </Card>
      ) : (
        (["active", "passive"] as const).map((kind) => {
          const list = sources.filter((s) => s.kind === kind);
          if (!list.length) return null;
          return (
            <ListGroup
              key={kind}
              title={kind === "active" ? t.income.activeTitle : t.income.passiveTitle}
              aside={
                <span>
                  <Money value={kind === "active" ? cash.activeIncome : cash.passiveIncome} compact interactive={false} /> {t.expenses.per.monthly}
                </span>
              }
            >
              {list.map((s) => {
                const reserved = totalCapitalAmount(s.capitalLines);
                const capital = reserved > 0 ? effectiveIncomeCapital(s, sources, seedOptions) : 0;
                const yieldPct = reserved > 0 ? capitalYieldPct(s.monthly, capital) : null;
                return (
                  <ListRow
                    key={s.id}
                    leading={<IconTile icon={resolveIcon(s.icon)} color={kind === "active" ? "var(--tone-teal)" : "var(--tone-blue)"} background={kind === "active" ? "var(--tone-teal-soft)" : "var(--tone-blue-soft)"} />}
                    title={s.name}
                    subtitle={[s.details || null, paymentLabel(t, s) !== "—" ? paymentLabel(t, s) : null].filter(Boolean).join(" · ") || (kind === "active" ? t.income.active : t.income.passive)}
                    trailing={<Money value={s.monthly} compact interactive={false} />}
                    trailingSub={
                      yieldPct !== null ? <span data-private>{t.income.capital.yield({ pct: formatPercent(yieldPct) })}</span> : t.expenses.per.monthly
                    }
                    onClick={() => openEdit(s)}
                    label={s.name}
                    actions={<RowActions label={t.common.actionsFor({ name: s.name })} actions={actionsFor(s)} />}
                  />
                );
              })}
            </ListGroup>
          );
        })
      )}

      <IncomeSourceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialog?.mode ?? "create"}
        source={dialog?.source ?? null}
        peers={peers}
        seedOptions={seedOptions}
        onSubmit={(draft) => {
          const next = sanitizeIncomeSource(draft);
          if (dialog?.mode === "edit") {
            setSources((prev) => prev.map((s) => (s.id === next.id ? next : s)));
            toast.success(t.income.toast.updated);
          } else {
            setSources((prev) => [...prev, next]);
            toast.success(t.income.toast.added);
          }
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t.income.confirmDelete.title}
        description={pendingDelete ? t.income.confirmDelete.description({ name: pendingDelete.name }) : null}
        onConfirm={() => {
          if (!pendingDelete) return;
          const removed = pendingDelete;
          setSources((prev) => prev.filter((s) => s.id !== removed.id));
          toast.success(t.income.toast.deleted, { description: removed.name });
        }}
      />
    </TabContent>
  );
}
