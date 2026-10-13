"use client";

import { Check, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { ASSETS_SEED, type AssetsState } from "@/entities/asset";
import { DEBTS_SEED } from "@/entities/debt";
import { useExpenses } from "@/entities/expense/api/use-expenses";
import { GOALS_SEED } from "@/entities/goal";
import { useIncomeSources } from "@/entities/income";
import { computeSetupProgress } from "@/entities/portfolio";
import { PREFERENCES_SEED } from "@/entities/preferences";
import { useSettingsAssets } from "@/entities/settings-asset";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { todayIso } from "@/shared/lib/date";
import { useTable } from "@/shared/storage";
import { CairnStones } from "@/shared/ui/cairn-stones";
import { Button } from "@/shared/ui/kit/button";
import { Card } from "@/shared/ui/kit/card";
import { ProgressRing } from "@/shared/ui/progress-ring";

/** First-run checklist on the overview; disappears when done or dismissed. */
export function SetupGuide({ className }: { className?: string }) {
  const { t } = useI18n();
  const s = t.setup;
  const [incomeSources] = useIncomeSources();
  const [settingsAssets] = useSettingsAssets();
  const [legacyAssets] = useTable<AssetsState>("assets", ASSETS_SEED);
  const [debts] = useTable("debts", DEBTS_SEED);
  const [goals] = useTable("goals", GOALS_SEED);
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);
  const { expenses } = useExpenses();

  const progress = useMemo(
    () => computeSetupProgress({ incomeSources, expenses, settingsAssets, legacyAssets, debts, goals, setup: prefs.setup }),
    [incomeSources, expenses, settingsAssets, legacyAssets, debts, goals, prefs.setup],
  );
  if (!progress.visible) return null;

  const setSetup = (patch: NonNullable<typeof prefs.setup>) => setPrefs((p) => ({ ...p, setup: { ...p.setup, ...patch } }));

  return (
    <Card className={cn("gap-4 border-capstone/40 px-5", className)}>
      <div className="flex items-start gap-4">
        <CairnStones className="h-12 w-14 shrink-0 max-sm:hidden" />
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="text-base font-semibold">{s.title}</h2>
          <p className="text-sm text-muted-foreground">{s.description({ done: progress.done, total: progress.total })}</p>
        </div>
        <ProgressRing value={progress.done / progress.total} size={44} stroke={5} tone="capstone" label={s.description({ done: progress.done, total: progress.total })}>
          {progress.done}/{progress.total}
        </ProgressRing>
        <Button variant="ghost" size="icon-sm" aria-label={s.dismiss} onClick={() => setSetup({ dismissedAt: todayIso() })} className="text-muted-foreground">
          <X />
        </Button>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {progress.steps.map((step, i) => {
          const label = s.steps[step.id];
          const next = step.id === progress.next;
          return (
            <li key={step.id}>
              <div
                className={cn(
                  "flex h-full flex-col gap-2 rounded-lg border p-3 max-sm:py-2.5",
                  step.done ? "border-transparent bg-muted/60" : next ? "border-primary/50 bg-primary-soft/50" : "bg-card",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      step.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {step.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {step.done ? (
                    <span className="text-sm font-medium text-muted-foreground line-through decoration-muted-foreground/50">{label.label}</span>
                  ) : (
                    <Link href={step.href} className="min-w-0 flex-1 text-sm font-medium underline-offset-4 hover:underline">
                      {label.label}
                    </Link>
                  )}
                </div>
                {step.done ? null : (
                  // On phones only the next step shows its details; the others are one tappable line.
                  <div className={cn("grid gap-2", !next && "max-sm:hidden")}>
                    <p className="text-xs text-muted-foreground">{label.hint}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2">
                      <Button asChild size="sm" variant={next ? "default" : "outline"}>
                        <Link href={step.href}>
                          {s.start}
                          <ChevronRight />
                        </Link>
                      </Button>
                      {step.id === "debts" ? (
                        <Button size="sm" variant="ghost" onClick={() => setSetup({ noDebts: true })}>
                          {s.noDebts}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
