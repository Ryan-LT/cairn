"use client";

import { Coins, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { useId, useMemo, useState } from "react";

import {
  addableSeedOptions,
  appendGoalSeedLine,
  seedLineAllocationView,
  setSeedLineAllIn,
  sourceAvailability,
  type GoalProfile,
  type GoalSeedLine,
  type GoalStartingOption,
} from "@/entities/goal";
import { CategoryBadge, LiquidityBadge } from "@/entities/settings-asset/ui";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { MoneyInput } from "@/shared/ui/form";
import { Badge } from "@/shared/ui/kit/badge";
import { Button } from "@/shared/ui/kit/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/kit/command";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Label } from "@/shared/ui/kit/label";
import { Switch } from "@/shared/ui/kit/switch";
import { Money } from "@/shared/ui/money";

export type AllocateSourcesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The plan (or income source wrapped as a plan) being edited. */
  profile: GoalProfile;
  /** Other plans whose reservations cap what this one can take. */
  savedPlans: GoalProfile[];
  seedOptions: GoalStartingOption[];
  applyLabel?: string;
  /** What the allocation is for, used in labels ("plan", "income source"); pass it translated. Defaults to "plan". */
  subject?: string;
  /** Offer "all in" on tracked sources (goal plans). */
  allowAllIn?: boolean;
  onApply: (lines: GoalSeedLine[]) => void | Promise<void>;
};

/** Allocate amounts from tracked sources (capped by what other plans already reserve). */
export function AllocateSourcesDialog(props: AllocateSourcesDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="lg">
        <AllocationEditor key={props.profile.id || "new"} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function AllocationEditor({
  onOpenChange,
  title,
  description,
  profile,
  savedPlans,
  seedOptions,
  applyLabel,
  subject: subjectProp,
  allowAllIn = false,
  onApply,
}: AllocateSourcesDialogProps) {
  const { t } = useI18n();
  const a = t.goals.allocate;
  const subject = subjectProp ?? a.subjectPlan;
  // Mounted fresh on every open (Radix unmounts closed content).
  const [lines, setLines] = useState<GoalSeedLine[]>(() => (profile.seedLines ?? []).map((l) => ({ ...l })));
  const [pickerOpen, setPickerOpen] = useState(lines.length === 0);
  const [busy, setBusy] = useState(false);

  const draft = useMemo(() => ({ ...profile, seedLines: lines }), [profile, lines]);
  const addable = useMemo(() => addableSeedOptions(seedOptions, lines), [seedOptions, lines]);
  const total = lines.reduce((s, l) => s + seedLineAllocationView(l, seedOptions, savedPlans, draft).effective, 0);

  function add(key: string) {
    const next = appendGoalSeedLine(draft, key, seedOptions, savedPlans);
    if (next?.seedLines) setLines(next.seedLines);
    setPickerOpen(false);
  }

  async function apply() {
    setBusy(true);
    try {
      await onApply(lines);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        {lines.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {a.noSources}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lines.map((line) => (
              <AllocationLineRow
                key={line.id}
                view={seedLineAllocationView(line, seedOptions, savedPlans, draft)}
                subject={subject}
                amount={line.amount}
                allowAllIn={allowAllIn}
                onAllInChange={(on) => setLines((prev) => setSeedLineAllIn(prev, line.id, on, seedOptions, savedPlans, { ...profile, seedLines: prev }))}
                onAmountChange={(amount) => setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, amount } : l)))}
                onRemove={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
              />
            ))}
          </ul>
        )}

        {addable.length > 0 ? (
          pickerOpen ? (
            <div className="rounded-md border">
              <Command>
                <CommandInput placeholder={a.findSource} autoFocus={lines.length > 0} />
                <CommandList className="max-h-72">
                  <CommandEmpty>{a.noMatch}</CommandEmpty>
                  <CommandGroup>
                    {addable.map((option) => (
                      <SourceOptionItem
                        key={option.key}
                        option={option}
                        savedPlans={savedPlans}
                        draft={draft}
                        onPick={() => add(option.key)}
                      />
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
          ) : (
            <Button type="button" variant="outline" className="self-start" onClick={() => setPickerOpen(true)}>
              <Plus />
              {a.addSource}
            </Button>
          )
        ) : (
          <p className="text-xs text-muted-foreground">{a.allAdded}</p>
        )}
      </DialogBody>
      <DialogFooter className="sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground max-sm:order-last max-sm:text-center">
          {a.countsTowardTotal({ subject })} <Money value={total} className="font-semibold text-foreground" />
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {applyLabel ?? t.common.apply}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function SourceOptionItem({
  option,
  savedPlans,
  draft,
  onPick,
}: {
  option: GoalStartingOption;
  savedPlans: GoalProfile[];
  draft: GoalProfile;
  onPick: () => void;
}) {
  const { t } = useI18n();
  const m = t.goals.allocate;
  if (option.isCustom) {
    return (
      <CommandItem value={`custom amount extra cash ${m.customAmount}`} onSelect={onPick} className="items-start gap-3 py-2">
        <Coins className="mt-0.5" />
        <div>
          <p className="font-medium">{m.customAmount}</p>
          <p className="text-xs text-muted-foreground">{m.customHint}</p>
        </div>
      </CommandItem>
    );
  }
  const a = sourceAvailability(option, savedPlans, draft);
  return (
    <CommandItem value={`${option.label} ${option.category ?? ""}`} onSelect={onPick} className="items-start gap-3 py-2">
      <Wallet className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-medium">{option.label}</span>
          {option.category ? <CategoryBadge category={option.category} /> : null}
          {option.liquidity ? <LiquidityBadge liquidity={option.liquidity} /> : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          <Money
            value={a.remaining}
            className={cn("font-medium", a.empty ? "" : a.fullyReserved ? "text-danger" : "text-foreground")}
          />
          {m.availableOf}
          <Money value={a.live} />
          {m.live}
          {a.usage.length > 0 ? m.reservedBy({ names: a.usage.map((u) => u.planName).join(", ") }) : ""}
        </p>
      </div>
    </CommandItem>
  );
}

function AllocationLineRow({
  view,
  subject,
  amount,
  allowAllIn,
  onAllInChange,
  onAmountChange,
  onRemove,
}: {
  view: ReturnType<typeof seedLineAllocationView>;
  subject: string;
  amount: number;
  allowAllIn: boolean;
  onAllInChange: (allIn: boolean) => void;
  onAmountChange: (amount: number) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const m = t.goals.allocate;
  const inputId = useId();
  const allInId = useId();
  const blocked = !view.allIn && view.allInElsewhere !== null;
  return (
    <li className="rounded-md border bg-card">
      <div className="flex items-start justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {view.isCustom ? <Coins className="size-4 text-muted-foreground" /> : <Wallet className="size-4 text-muted-foreground" />}
          <span className="truncate text-sm font-medium">{view.title}</span>
          {view.category ? <CategoryBadge category={view.category} /> : null}
          {view.liquidity ? <LiquidityBadge liquidity={view.liquidity} /> : null}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={m.remove({ name: view.title })} onClick={onRemove} className="-my-1 text-muted-foreground hover:text-danger">
          <Trash2 />
        </Button>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor={inputId}>{view.isCustom ? m.amount : m.allocateFromSource}</Label>
          {/* All in: the amount follows the source, so it isn't typed. */}
          <MoneyInput
            id={inputId}
            value={view.allIn ? view.effective : amount}
            onChange={onAmountChange}
            min={0}
            max={view.isCustom ? undefined : view.maxAlloc}
            disabled={view.allIn}
          />
        </div>
        {view.isCustom ? (
          <p className="self-center text-xs text-muted-foreground">{m.customHintSentence}</p>
        ) : (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 self-center text-xs">
            <dt className="text-muted-foreground">{m.liveBalance}</dt>
            <dd className="text-right">
              <Money value={view.live} />
            </dd>
            <dt className="text-muted-foreground">{m.stillAvailable({ subject })}</dt>
            <dd className={cn("text-right", view.availabilityTone === "danger" && "text-danger", view.availabilityTone === "warning" && "text-warning")}>
              <Money value={view.availableToPlan} />
            </dd>
            <dt className="text-muted-foreground">{m.countsToward({ subject })}</dt>
            <dd className="flex items-center justify-end gap-1.5 font-medium">
              {view.over ? <Badge variant="danger">{m.capped}</Badge> : null}
              <Money value={view.effective} />
            </dd>
          </dl>
        )}
      </div>
      {allowAllIn && !view.isCustom ? (
        <div className={cn("flex items-start justify-between gap-3 border-t px-3 py-2.5", view.allIn && "bg-primary-soft/40")}>
          <div className="grid min-w-0 gap-0.5">
            <Label htmlFor={allInId} className={cn("text-sm", blocked && "text-muted-foreground")}>
              {m.allIn}
            </Label>
            <p className={cn("text-xs text-muted-foreground", blocked && "text-warning")}>{blocked ? m.allInTaken({ name: view.allInElsewhere! }) : m.allInHint}</p>
          </div>
          <Switch id={allInId} checked={view.allIn} disabled={blocked} onCheckedChange={onAllInChange} />
        </div>
      ) : null}
      {view.usage.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2 text-xs">
          <span className="text-muted-foreground">{m.alsoReserved}</span>
          {view.usage.map((u) => (
            <Badge key={u.planId} variant="outline" className="gap-1.5 font-normal">
              <span className="max-w-40 truncate font-medium">{u.planName}</span>
              {u.allIn ? <span className="text-primary">{m.allInBadge}</span> : null}
              <Money value={u.amount} className="text-muted-foreground" />
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  );
}
