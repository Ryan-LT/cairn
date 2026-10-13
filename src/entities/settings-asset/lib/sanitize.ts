import { isDefaultAssetCategory } from "@/entities/settings-asset/config/categories";
import {
  resolveSettingsAssetLiquidity,
  SETTINGS_ASSET_LIQUIDITY_DEFAULT,
  type SettingsAsset,
} from "@/entities/settings-asset/model";
import { moveItem } from "@/shared/lib/array";
import { sanitizeHolding } from "@/shared/lib/currency/holding";

export function createSettingsAssetDraft(now: number = Date.now()): SettingsAsset {
  return {
    id: `asset-${now}`,
    name: "",
    category: "Cash",
    currentValue: 0,
    liquidity: SETTINGS_ASSET_LIQUIDITY_DEFAULT,
  };
}

/** Shape persisted on save: trimmed name, category fallback "Cash", explicit liquidity. */
export function sanitizeSettingsAsset(draft: SettingsAsset): SettingsAsset {
  const { holding: rawHolding, ...rest } = draft;
  const holding = sanitizeHolding(rawHolding);
  return {
    ...rest,
    name: draft.name.trim(),
    category: draft.category.trim() || "Cash",
    currentValue: Math.max(0, Number.isFinite(draft.currentValue) ? Math.round(draft.currentValue) : 0),
    liquidity: resolveSettingsAssetLiquidity(draft.liquidity),
    ...(holding ? { holding } : {}),
  };
}

/** Non-default category that should be remembered in preferences, if any. */
export function customCategoryToRegister(category: string): string | null {
  const trimmed = category.trim();
  return trimmed && !isDefaultAssetCategory(trimmed) ? trimmed : null;
}

/** Category options plus the current (possibly unknown) value, sorted A–Z. */
export function categorySelectOptions(options: string[], current?: string): string[] {
  const list = [...options];
  const seen = new Set(list.map((c) => c.trim()).filter(Boolean));
  const cur = current?.trim();
  if (cur && !seen.has(cur)) list.push(cur);
  return list.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/**
 * Drop `activeId` onto `overId` within the list as currently displayed. The
 * result becomes the new stored order (any active sort is then cleared).
 */
export function reorderVisible(
  displayed: SettingsAsset[],
  activeId: string,
  overId: string,
): SettingsAsset[] | null {
  if (activeId === overId) return null;
  const from = displayed.findIndex((a) => a.id === activeId);
  const to = displayed.findIndex((a) => a.id === overId);
  if (from === -1 || to === -1) return null;
  return moveItem(displayed, from, to);
}
