"use client";

import { useMemo } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { DEBTS_SEED } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { useIncomeSources } from "@/entities/income";
import { useLedger } from "@/entities/ledger";
import { PERSONAL_LOANS_SEED, type PersonalLoan } from "@/entities/personal-loan";
import { computeDashboardSummary } from "@/entities/portfolio";
import { PREFERENCES_SEED } from "@/entities/preferences";
import type { ReportInput } from "@/entities/report";
import { assetCategoryLabel, useSettingsAssets } from "@/entities/settings-asset";
import { useI18n } from "@/shared/i18n";
import { useTable } from "@/shared/storage";

/** Everything a shared report is built from, as on the overview right now. */
export function useReportData(): Pick<ReportInput, "txns" | "items" | "sources" | "netWorth"> {
  const { t } = useI18n();
  const otherLabel = t.connect.view.otherAssets;
  const { txns } = useLedger();
  const { expenses } = useExpenses();
  const [sources] = useIncomeSources();
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [debts] = useTable("debts", DEBTS_SEED);
  const [settingsAssets] = useSettingsAssets();
  const [prefs] = useTable("preferences", PREFERENCES_SEED);
  const [personalLoans] = useTable<PersonalLoan[]>("personalLoans", PERSONAL_LOANS_SEED);

  const netWorth = useMemo(() => {
    const summary = computeDashboardSummary({ assets, debts, settingsAssets, incomeSources: sources, prefs, personalLoans, expenses });
    const byLabel = new Map<string, number>();
    for (const a of settingsAssets) {
      const label = assetCategoryLabel(a.category);
      byLabel.set(label, (byLabel.get(label) ?? 0) + a.currentValue);
    }
    // Imported holdings and money lent out (when counted): whatever the categories don't cover.
    const listed = [...byLabel.values()].reduce((s, v) => s + v, 0);
    const rest = summary.grossAssets - listed;
    const byCategory = [...byLabel].map(([label, value]) => ({ label, value }));
    if (rest > 0.5) byCategory.push({ label: otherLabel, value: rest });
    return {
      history: prefs.netWorthMonthlyHistory ?? [],
      assets: summary.grossAssets,
      debts: summary.liabilities,
      netWorth: summary.netWorth,
      byCategory,
    };
  }, [assets, debts, settingsAssets, sources, prefs, personalLoans, expenses, otherLabel]);

  return { txns, items: expenses.items, sources, netWorth };
}
