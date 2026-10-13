"use client";

import { useEffect, useMemo } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { DEBTS_SEED } from "@/entities/debt";
import { PERSONAL_LOANS_SEED, type PersonalLoan } from "@/entities/personal-loan";
import { computeNetWorth } from "@/entities/portfolio";
import { netWorthTrackingUnchanged, PREFERENCES_SEED, syncNetWorthTracking } from "@/entities/preferences";
import { SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import { useInitialLoadDone, useTable } from "@/shared/storage";

/**
 * Keeps the month-to-date baseline and the monthly net-worth history current
 * from any page (not only the overview), once real data has loaded and only
 * when something actually changes.
 */
export function useNetWorthTracking(): void {
  const initialLoadDone = useInitialLoadDone();
  const [assets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [settingsAssets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [debts] = useTable("debts", DEBTS_SEED);
  const [personalLoans] = useTable<PersonalLoan[]>("personalLoans", PERSONAL_LOANS_SEED);
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);

  const netWorth = useMemo(
    () => computeNetWorth({ assets, settingsAssets, debts, personalLoans, includeLoans: prefs.includeLoansInNetWorth }),
    [assets, settingsAssets, debts, personalLoans, prefs.includeLoansInNetWorth],
  );

  useEffect(() => {
    if (!initialLoadDone) return;
    const next = syncNetWorthTracking(prefs, netWorth);
    if (!netWorthTrackingUnchanged(prefs, next)) setPrefs((p) => syncNetWorthTracking(p, netWorth));
  }, [initialLoadDone, netWorth, prefs, setPrefs]);
}
