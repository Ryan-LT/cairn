import { activeMessages } from "@/shared/i18n/active";
import type { AssetHolding } from "@/shared/lib/currency/holding";
/** How quickly catalog asset value can be accessed (withdraw / spend). */
export type SettingsAssetLiquidity = "instant" | "not_instant";

export type SettingsAsset = {
  id: string;
  name: string;
  category: string;
  currentValue: number;
  /**
   * Liquidity / access speed. Omitted in older saves — treat as
   * {@link resolveSettingsAssetLiquidity} default.
   */
  liquidity?: SettingsAssetLiquidity;
  /** `YYYY-MM-DD` the value was last changed (unset in older saves). */
  updatedAt?: string;
  /**
   * Held in US dollars or gold: the value follows today's rate (see
   * `useSettingsAssets`); `currentValue` keeps the VND value at the last save.
   */
  holding?: AssetHolding;
};

export const SETTINGS_ASSETS_SEED: SettingsAsset[] = [];

export function resolveSettingsAssetLiquidity(
  value: SettingsAsset["liquidity"],
): SettingsAssetLiquidity {
  return value === "not_instant" ? "not_instant" : "instant";
}

export function settingsAssetLiquidityLabel(
  value: SettingsAsset["liquidity"],
): string {
  const m = activeMessages().domain.liquidity;
  return resolveSettingsAssetLiquidity(value) === "instant" ? m.instant : m.notInstant;
}

export const SETTINGS_ASSET_LIQUIDITY_DEFAULT: SettingsAssetLiquidity = "instant";
