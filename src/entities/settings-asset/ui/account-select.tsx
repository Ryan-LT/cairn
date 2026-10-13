"use client";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatMoneyCompact } from "@/shared/lib/format";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

import { isAccountAsset } from "@/entities/ledger/lib/balances";

import { useSettingsAssets } from "../api/use-settings-assets";
import { resolveAssetCategoryEmoji } from "../config/categories";

const NONE = "_none";

/**
 * Pick the account (an asset in đồng or dollars) money comes out of or goes
 * into; "no account" leaves balances alone. Gold can't be an account.
 */
export function AccountSelect({
  value,
  onChange,
  id,
  className,
  "aria-label": ariaLabel,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const { t } = useI18n();
  const a = t.ledger.account;
  const [assets] = useSettingsAssets();
  const accounts = assets.filter(isAccountAsset);
  const missing = value && !accounts.some((x) => x.id === value);

  return (
    <Select value={value ?? NONE} onValueChange={(v) => onChange(v === NONE ? undefined : v)}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value={NONE}>{a.none}</SelectItem>
        {accounts.length ? <SelectSeparator /> : null}
        {accounts.map((x) => (
          <SelectItem key={x.id} value={x.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden>{resolveAssetCategoryEmoji(x.category)}</span>
              <span className="truncate">{x.name}</span>
              <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums" data-private>
                {formatMoneyCompact(x.currentValue)}
              </span>
            </span>
          </SelectItem>
        ))}
        {missing ? (
          <SelectItem value={value} disabled>
            {a.deleted}
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
