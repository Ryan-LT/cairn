"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { NumericFormat } from "react-number-format";

import {
  DEFAULT_MILESTONE_AGE,
  DEFAULT_MILESTONE_USD,
  MAX_MILESTONE_AGE,
  MIN_MILESTONE_AGE,
  type MilestoneSettings,
} from "@/entities/milestone";
import { useI18n } from "@/shared/i18n";
import { Button } from "@/shared/ui/kit/button";
import { DatePicker } from "@/shared/ui/kit/date-picker";
import { Input } from "@/shared/ui/kit/input";
import { Label } from "@/shared/ui/kit/label";
import { FieldError } from "@/shared/ui/field-error";

type Draft = { birthDate: string; targetUsd: number | undefined; targetAge: number | undefined };

function toDraft(value: MilestoneSettings | undefined): Draft {
  return {
    birthDate: value?.birthDate ?? "",
    targetUsd: value?.targetUsd ?? DEFAULT_MILESTONE_USD,
    targetAge: value?.targetAge ?? DEFAULT_MILESTONE_AGE,
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return a.birthDate === b.birthDate && a.targetUsd === b.targetUsd && a.targetAge === b.targetAge;
}

/** Birth date, USD target and target age for the dashboard milestone. Explicit save. */
export function MilestoneForm({
  value,
  onSave,
}: {
  value: MilestoneSettings | undefined;
  onSave: (next: MilestoneSettings) => void;
}) {
  const { t } = useI18n();
  const m = t.settings.milestone;
  const saved = toDraft(value);
  const [draft, setDraft] = useState(saved);
  const [synced, setSynced] = useState(saved);
  if (!sameDraft(synced, saved)) {
    // Adopt changes that arrive from another device / background sync.
    setSynced(saved);
    setDraft(saved);
  }

  const ageValid =
    draft.targetAge !== undefined && draft.targetAge >= MIN_MILESTONE_AGE && draft.targetAge <= MAX_MILESTONE_AGE;
  const targetValid = draft.targetUsd !== undefined && draft.targetUsd > 0;
  const dirty = !sameDraft(draft, saved);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!dirty || !ageValid || !targetValid) return;
        onSave({
          ...(draft.birthDate ? { birthDate: draft.birthDate } : {}),
          targetUsd: draft.targetUsd,
          targetAge: draft.targetAge,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="milestone-birth-date">{m.birthDate}</Label>
          <DatePicker
            id="milestone-birth-date"
            value={draft.birthDate}
            onChange={(birthDate) => setDraft((d) => ({ ...d, birthDate }))}
            placeholder={m.birthDatePlaceholder}
            clearable
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="milestone-target">{m.target}</Label>
          <NumericFormat
            id="milestone-target"
            customInput={Input}
            thousandSeparator=","
            decimalScale={0}
            prefix="$"
            allowNegative={false}
            value={draft.targetUsd ?? ""}
            onValueChange={(v) => setDraft((d) => ({ ...d, targetUsd: v.floatValue }))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="$1,000,000"
            aria-invalid={!targetValid}
            className="tabular-nums"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="milestone-age">{m.targetAge}</Label>
          <Input
            id="milestone-age"
            type="number"
            inputMode="numeric"
            min={MIN_MILESTONE_AGE}
            max={MAX_MILESTONE_AGE}
            step={1}
            value={draft.targetAge ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? undefined : Math.trunc(Number(e.target.value));
              setDraft((d) => ({ ...d, targetAge: Number.isFinite(n) ? n : undefined }));
            }}
            aria-invalid={!ageValid}
            className="tabular-nums"
          />
        </div>
      </div>
      <FieldError>{!ageValid ? m.ageRange({ min: MIN_MILESTONE_AGE, max: MAX_MILESTONE_AGE }) : null}</FieldError>
      <div className="flex gap-2">
        <Button type="submit" disabled={!dirty || !ageValid || !targetValid}>
          <Check />
          {t.common.save}
        </Button>
        {dirty ? (
          <Button type="button" variant="ghost" onClick={() => setDraft(saved)}>
            {t.common.reset}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
