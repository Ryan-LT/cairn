import type { Currency } from "./rates";

/**
 * The currency amounts are shown in. Set during render by the currency
 * provider (like the formatters' language), so `formatMoney` stays a plain
 * function. Amounts are always stored and computed in VND; only the text
 * changes. Without a known rate, amounts stay in VND.
 */
type DisplayState = { currency: Currency; vndPerUsd: number | null };

let state: DisplayState = { currency: "VND", vndPerUsd: null };

export function setDisplayCurrency(next: DisplayState): void {
  state = next;
}

/** `USD` only when a rate is known; otherwise `VND`. */
export function displayCurrency(): { currency: Currency; vndPerUsd: number } | { currency: "VND"; vndPerUsd: number | null } {
  return state.currency === "USD" && state.vndPerUsd ? { currency: "USD", vndPerUsd: state.vndPerUsd } : { currency: "VND", vndPerUsd: state.vndPerUsd };
}
