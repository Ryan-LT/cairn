"use client";

import { Landmark, Scale, TrendingDown } from "lucide-react";
import { useMemo } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { DEBTS_SEED, totalDebtBalance } from "@/entities/debt";
import { PERSONAL_LOANS_SEED, type PersonalLoan } from "@/entities/personal-loan";
import { personalLoanBalances, totalCombinedAssetValue } from "@/entities/portfolio";
import { PREFERENCES_SEED } from "@/entities/preferences";
import { SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import { useI18n } from "@/shared/i18n";
import { formatPercent } from "@/shared/lib/format";
import { useTable } from "@/shared/storage";
import { AnimatedMoney } from "@/shared/ui/animated-money";
import { SummaryStrip } from "@/shared/ui/summary-strip";

/** Assets − debts = net worth, above the Net worth tabs, with how much of what you own is owed. */
export function WealthHubSummary() {
  const { t } = useI18n();
  const s = t.wealth.summary;
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [catalog] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [debts] = useTable("debts", DEBTS_SEED);
  const [loans] = useTable<PersonalLoan[]>("personalLoans", PERSONAL_LOANS_SEED);
  const [prefs] = useTable("preferences", PREFERENCES_SEED);

  const { gross, owed, net } = useMemo(() => {
    const l = prefs.includeLoansInNetWorth ? personalLoanBalances(loans) : { lent: 0, borrowed: 0 };
    const gross = totalCombinedAssetValue(assets, catalog) + l.lent;
    const owed = totalDebtBalance(debts) + l.borrowed;
    return { gross, owed, net: gross - owed };
  }, [assets, catalog, debts, loans, prefs.includeLoansInNetWorth]);
  // The bar can't go past full, but the caption tells the real ratio (debts can exceed assets).
  const ratio = gross > 0 ? owed / gross : 0;
  const share = Math.min(1, ratio);

  return (
    <SummaryStrip
      items={[
        { key: "a", icon: Landmark, tone: "text-success", label: s.assets, value: <AnimatedMoney value={gross} id="wealth-assets" /> },
        { key: "d", icon: TrendingDown, tone: "text-danger", label: s.debts, value: <AnimatedMoney value={owed} id="wealth-debts" /> },
        { key: "n", icon: Scale, tone: "text-primary", label: s.netWorth, value: <AnimatedMoney value={net} id="wealth-net" tone={net < 0 ? "danger" : "none"} /> },
      ]}
      footer={
        gross > 0 ? (
          <div className="grid gap-1.5">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={s.debtShare({ pct: formatPercent(ratio * 100, { maximumFractionDigits: 0 }) })}>
              <div className="h-full rounded-l-full bg-chart-3" style={{ width: `${(1 - share) * 100}%` }} />
              {share > 0 ? <div className="h-full rounded-r-full bg-chart-2" style={{ width: `${share * 100}%` }} /> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {s.debtShare({ pct: formatPercent(ratio * 100, { maximumFractionDigits: 0 }) })}
              {prefs.includeLoansInNetWorth ? ` · ${s.withLoans}` : null}
            </p>
          </div>
        ) : undefined
      }
    />
  );
}
