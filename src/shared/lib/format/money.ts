import { displayCurrency } from "@/shared/lib/currency/display";

import { formatLocale } from "./locale";
import { formatNumber, MINUS, signPrefix, type SignDisplay } from "./number";

const SYMBOL = "₫";

export type MoneyFormatOptions = {
  signDisplay?: SignDisplay;
  /** Append " ₫" (default true). */
  symbol?: boolean;
  /**
   * Amounts are VND. `display` (default) shows them in the chosen display
   * currency (USD at today's rate); `VND` always shows đồng (inputs, exports).
   */
  currency?: "display" | "VND";
};

/** Rate to show `amount` (VND) in USD, or null to show đồng. */
function usdRate(opts: MoneyFormatOptions): number | null {
  if (opts.currency === "VND") return null;
  const d = displayCurrency();
  return d.currency === "USD" ? d.vndPerUsd : null;
}

/** `$1.234`, `$12,50`, `−$25` (cents only under $100). */
export function formatUsdAmount(usd: number, opts: { signDisplay?: SignDisplay; symbol?: boolean } = {}): string {
  const { signDisplay = "auto", symbol = true } = opts;
  if (!Number.isFinite(usd)) return symbol ? "$—" : "—";
  const abs = Math.abs(usd);
  const digits = abs < 100 && Math.round(abs * 100) % 100 !== 0 ? 2 : 0;
  const zero = Number(abs.toFixed(digits)) === 0;
  const sign = signPrefix(usd < 0 && !zero, zero, signDisplay);
  const n = formatNumber(abs, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  return symbol ? `${sign}$${n}` : `${sign}${n}`;
}

const USD_UNITS = [
  { value: 1e12, suffix: "T" },
  { value: 1e9, suffix: "B" },
  { value: 1e6, suffix: "M" },
  { value: 1e3, suffix: "K" },
] as const;

/** `$4,82M`, `$32,5K`, `$850` — the dollar sign stays even on chart axes, so the unit is never ambiguous. */
function formatUsdCompact3(usd: number, signDisplay: SignDisplay): string {
  if (!Number.isFinite(usd)) return "$—";
  const abs = Math.abs(usd);
  if (abs < 1000) return formatUsdAmount(Math.round(usd), { signDisplay });
  const sign = signPrefix(usd < 0, false, signDisplay);
  let i = USD_UNITS.findIndex((u) => abs >= u.value);
  let rounded = roundSignificant(abs / USD_UNITS[i].value, 3);
  if (rounded >= 1000 && i > 0) {
    i -= 1;
    rounded = roundSignificant(abs / USD_UNITS[i].value, 3);
  }
  const intDigits = Math.floor(rounded).toString().length;
  return `${sign}$${formatNumber(rounded, { maximumFractionDigits: Math.max(0, 3 - intDigits) })}${USD_UNITS[i].suffix}`;
}

/** Full VND amount: `1.245.670.000 ₫`, `−25.000 ₫`, `+1.000 ₫` (or USD when that's the display currency). */
export function formatMoney(amount: number, opts: MoneyFormatOptions = {}): string {
  const { signDisplay = "auto", symbol = true } = opts;
  const rate = usdRate(opts);
  if (rate) return formatUsdAmount(amount / rate, { signDisplay, symbol });
  if (!Number.isFinite(amount)) return symbol ? `— ${SYMBOL}` : "—";
  const n = formatNumber(Math.round(amount), { signDisplay });
  return symbol ? `${n} ${SYMBOL}` : n;
}

const UNITS = [
  { value: 1e12, suffix: { en: "T", vi: " nghìn tỷ" } },
  { value: 1e9, suffix: { en: "B", vi: " tỷ" } },
  { value: 1e6, suffix: { en: "M", vi: " tr" } },
  { value: 1e3, suffix: { en: "K", vi: "K" } },
] as const;

/**
 * Compact VND for KPI tiles and chart axes, 3 significant digits:
 * `4,82B ₫`, `32,5M ₫`, `850K ₫` (Vietnamese: `4,82 tỷ ₫`, `32,5 tr ₫`, `850K ₫`).
 * Always pair with the full value (tooltip/label).
 */
export function formatMoneyCompact(amount: number, opts: MoneyFormatOptions = {}): string {
  const { signDisplay = "auto", symbol = true } = opts;
  const rate = usdRate(opts);
  if (rate) return formatUsdCompact3(amount / rate, signDisplay);
  if (!Number.isFinite(amount)) return symbol ? `— ${SYMBOL}` : "—";
  const abs = Math.abs(amount);
  const zero = Math.round(abs) === 0;
  const sign = signPrefix(amount < 0 && !zero, zero, signDisplay);

  let body: string;
  if (abs < 1000) {
    body = formatNumber(Math.round(abs));
  } else {
    let unitIndex = UNITS.findIndex((u) => abs >= u.value);
    let scaled = abs / UNITS[unitIndex].value;
    let rounded = roundSignificant(scaled, 3);
    // 999,95M rounds to 1000M → promote to 1B.
    if (rounded >= 1000 && unitIndex > 0) {
      unitIndex -= 1;
      scaled = abs / UNITS[unitIndex].value;
      rounded = roundSignificant(scaled, 3);
    }
    const intDigits = Math.floor(rounded).toString().length;
    body = `${formatNumber(rounded, { maximumFractionDigits: Math.max(0, 3 - intDigits) })}${UNITS[unitIndex].suffix[formatLocale()]}`;
  }
  return symbol ? `${sign}${body} ${SYMBOL}` : `${sign}${body}`;
}

function roundSignificant(value: number, digits: number): number {
  if (value === 0) return 0;
  const magnitude = Math.floor(Math.log10(value)) + 1;
  const factor = 10 ** (digits - magnitude);
  return Math.round(value * factor) / factor;
}

/** USD for the milestone: `$1,000,000` (US convention). */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return "$—";
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  return amount < 0 ? `${MINUS}${formatted}` : formatted;
}

/** `$1M`, `$250K`. */
export function formatUsdCompact(amount: number): string {
  if (!Number.isFinite(amount)) return "$—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(amount);
}
