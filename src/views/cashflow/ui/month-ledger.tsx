"use client";

import { CheckCircle2, Clock, Gift, TrendingUp, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { CategoryTile } from "@/entities/expense";
import { useIncomeSources } from "@/entities/income";
import { useLedger, type LedgerTxn } from "@/entities/ledger";
import { resolveAssetCategoryEmoji, useSettingsAssets } from "@/entities/settings-asset";
import { TxnSheet, type TxnSheetMode } from "@/features/record-transaction";
import { useI18n } from "@/shared/i18n";
import { todayIso } from "@/shared/lib/date";
import { formatDate, formatMoney } from "@/shared/lib/format";
import { dayInMonthIso, daysInMonth } from "@/shared/lib/month";
import { IconTile } from "@/shared/ui/icon-tile";
import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";
import { ListGroup, ListRow } from "@/shared/ui/list";
import { Money } from "@/shared/ui/money";

const INCOME_TILE = { color: "var(--success)", background: "color-mix(in oklab, var(--success) 14%, transparent)" };

/**
 * The month's money in (each income source by payment day: received, due
 * — tap "Đã nhận" —, or not yet) and its spending outside the plan.
 */
export function MonthLedger({ monthKey }: { monthKey: string }) {
  const { t } = useI18n();
  const l = t.ledger;
  const ledger = useLedger();
  const [sources] = useIncomeSources();
  const [assets] = useSettingsAssets();
  const [sheet, setSheet] = useState<TxnSheetMode | null>(null);
  const today = todayIso();
  const accountName = (id?: string) => {
    const a = id ? assets.find((x) => x.id === id) : undefined;
    return a ? `${resolveAssetCategoryEmoji(a.category)} ${a.name}` : id ? l.account.deleted : null;
  };

  const incomes = useMemo(() => {
    const received = new Map<string, LedgerTxn[]>();
    for (const x of ledger.txns) {
      if (x.source.type === "income" && x.source.month === monthKey) received.set(x.source.sourceId, [...(received.get(x.source.sourceId) ?? []), x]);
    }
    return sources
      .filter((s) => s.monthly > 0 || received.has(s.id))
      .map((s) => {
        const payDate = s.paymentDay ? dayInMonthIso(monthKey, Math.min(s.paymentDay, daysInMonth(monthKey))) : null;
        const got = received.get(s.id) ?? [];
        const status = got.length ? "received" : !payDate ? (monthKey <= today.slice(0, 7) ? "due" : "waiting") : payDate <= today ? "due" : "waiting";
        return { source: s, payDate, got, status: status as "received" | "due" | "waiting" };
      })
      .sort((a, b) => (a.payDate ?? "9999").localeCompare(b.payDate ?? "9999") || a.source.name.localeCompare(b.source.name));
  }, [sources, ledger.txns, monthKey, today]);

  const unplanned = useMemo(() => ledger.txns.filter((x) => x.source.type === "instant" && x.date.slice(0, 7) === monthKey), [ledger.txns, monthKey]);
  const extras = useMemo(() => ledger.txns.filter((x) => x.source.type === "extra" && x.date.slice(0, 7) === monthKey), [ledger.txns, monthKey]);
  const unplannedTotal = unplanned.reduce((s, x) => s + x.amount, 0);

  const save = (txn: LedgerTxn) => {
    const existed = ledger.txns.some((x) => x.id === txn.id);
    ledger.put(txn);
    if (existed) toast.success(l.edit.saved);
    else if (txn.source.type === "income") toast.success(l.receive.saved({ name: sources.find((s) => txn.source.type === "income" && s.id === txn.source.sourceId)?.name ?? "" }));
    else toast.success(txn.kind === "expense" ? l.instant.saved({ amount: formatMoney(txn.amount) }) : l.extra.saved({ amount: formatMoney(txn.amount) }));
  };
  const remove = (txn: LedgerTxn) => {
    ledger.remove([txn.id]);
    toast.success(l.edit.deleted, { action: { label: t.common.undo, onClick: () => ledger.restore([txn]) } });
  };

  return (
    <>
      {incomes.length || extras.length ? (
        <ListGroup title={l.month.incomeTitle} description={l.month.incomeHint}>
          {incomes.map(({ source: s, payDate, got, status }) => {
            const receivedTotal = got.reduce((sum, x) => sum + x.amount, 0);
            return (
              <ListRow
                key={s.id}
                leading={<IconTile icon={TrendingUp} {...INCOME_TILE} />}
                title={s.name}
                subtitle={
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span>
                      {status === "received"
                        ? l.month.receivedOn({ date: formatDate(got[got.length - 1].date, "dayMonth") })
                        : payDate
                          ? `${status === "due" ? l.month.due : l.month.waiting} · ${formatDate(payDate, "dayMonth")}`
                          : l.month.noDay}
                    </span>
                    {s.autoReceive ? <Badge variant="neutral">{l.month.autoOn}</Badge> : null}
                    {accountName(got[0]?.accountId ?? s.accountId) ? <span>· {accountName(got[0]?.accountId ?? s.accountId)}</span> : null}
                  </span>
                }
                trailing={<Money value={status === "received" ? receivedTotal : s.monthly} compact interactive={false} tone={status === "received" ? "success" : "muted"} />}
                trailingSub={status === "received" ? l.month.received : l.month.expected}
                onClick={got.length ? () => setSheet({ kind: "edit", txn: got[got.length - 1], title: s.name }) : undefined}
                label={s.name}
                actions={
                  status === "due" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSheet({
                          kind: "receive",
                          sourceId: s.id,
                          sourceName: s.name,
                          month: monthKey,
                          amount: s.amountUsd ?? s.monthly,
                          amountUsd: s.amountUsd,
                          date: payDate && payDate <= today ? payDate : today,
                          accountId: s.accountId,
                        })
                      }
                    >
                      <CheckCircle2 />
                      {l.receive.confirm}
                    </Button>
                  ) : status === "waiting" ? (
                    <Clock className="size-4 text-muted-foreground" aria-hidden />
                  ) : null
                }
              />
            );
          })}
          {extras.map((x) => (
            <ListRow
              key={x.id}
              leading={<IconTile icon={Gift} {...INCOME_TILE} />}
              title={x.name ?? l.kinds.extra}
              subtitle={[formatDate(x.date, "dayMonth"), accountName(x.accountId)].filter(Boolean).join(" · ")}
              trailing={<Money value={x.amount} compact signed tone="success" interactive={false} />}
              trailingSub={l.kinds.extra}
              onClick={() => setSheet({ kind: "edit", txn: x })}
              label={x.name ?? l.kinds.extra}
            />
          ))}
        </ListGroup>
      ) : null}

      <ListGroup
        title={l.month.unplannedTitle}
        description={l.month.unplannedHint}
        aside={
          <>
            {unplanned.length ? (
              <span className="tabular-nums" data-private>
                {l.month.unplannedTotal({ amount: formatMoney(unplannedTotal) })}
              </span>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setSheet({ kind: "instant" })}>
              <Zap />
              {l.instant.title}
            </Button>
          </>
        }
        empty={<p className="px-4 py-3 text-sm text-muted-foreground">{l.history.emptyExpense.title}</p>}
      >
        {unplanned.map((x) => (
          <ListRow
            key={x.id}
            leading={<CategoryTile category={x.category ?? "other"} />}
            title={x.name ?? t.expenses.categories[x.category ?? "other"]}
            subtitle={[formatDate(x.date, "dayMonth"), accountName(x.accountId), x.note].filter(Boolean).join(" · ")}
            trailing={<Money value={x.amount} compact interactive={false} />}
            onClick={() => setSheet({ kind: "edit", txn: x })}
            label={x.name ?? t.expenses.categories[x.category ?? "other"]}
          />
        ))}
      </ListGroup>

      <TxnSheet mode={sheet} onOpenChange={(o) => !o && setSheet(null)} onSave={save} onDelete={remove} />
    </>
  );
}
