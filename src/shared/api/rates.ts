import { getSql, tryGetSql } from "@/shared/api/db";
import { ensureSchema } from "@/shared/api/lazy-schema";
import { worldPricePerChi, type GoldPrices, type GoldProductId } from "@/shared/lib/currency/gold";
import type { RatesSnapshot } from "@/shared/lib/currency/rates";

/**
 * Live USD/VND and gold prices for Vietnam, from public sources, with
 * fallbacks:
 * - USD: Vietcombank (the transfer rate Vietnamese banks quote), then
 *   ExchangeRate-API (keyed if `EXCHANGERATE_API_KEY` is set, else its open
 *   endpoint), then the last good value. `USD_VND_RATE` overrides all.
 * - Gold: PNJ's price list (VND per chỉ, every purity), then vang.today (SJC
 *   bars and rings), then the world price converted (approximate: no local
 *   premium), then the last good value. Only quoted products are returned;
 *   the device estimates the rest from purity (`completeGoldPrices`).
 * A snapshot is reused for 10 minutes per server and kept in the database as
 * the fallback when every source is down.
 */

const TTL_MS = 10 * 60_000;
const TIMEOUT_MS = 4500;
const UA = "Mozilla/5.0 (compatible; CairnWealth/1.0; +https://cairnwealth.vercel.app)";

/** Sane bounds, so a broken feed can't value everything at zero or a billion. */
const USD_BOUNDS = [10_000, 100_000] as const;
const CHI_BOUNDS = [500_000, 200_000_000] as const;

const inRange = (n: number, [lo, hi]: readonly [number, number]) => Number.isFinite(n) && n >= lo && n <= hi;

/** "25,720.00" / "25720.00" / 25720 → 25720. */
export function parseLooseNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return Number.NaN;
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() === "" ? Number.NaN : n;
}

/** Vietcombank `/api/exchangerates?date=` JSON → the USD row. */
export function parseVietcombank(json: unknown): { rate: number; buy?: number; sell?: number; at?: string } | null {
  const data = (json as { Data?: unknown; UpdatedDate?: unknown } | null)?.Data;
  if (!Array.isArray(data)) return null;
  const row = data.find((r) => (r as { currencyCode?: unknown })?.currencyCode === "USD") as Record<string, unknown> | undefined;
  if (!row) return null;
  const rate = parseLooseNumber(row.transfer);
  if (!inRange(rate, USD_BOUNDS)) return null;
  const buy = parseLooseNumber(row.cash);
  const sell = parseLooseNumber(row.sell);
  const updated = (json as { UpdatedDate?: unknown }).UpdatedDate;
  const at = typeof updated === "string" && !Number.isNaN(Date.parse(updated)) ? new Date(updated).toISOString() : undefined;
  return { rate, buy: inRange(buy, USD_BOUNDS) ? buy : undefined, sell: inRange(sell, USD_BOUNDS) ? sell : undefined, at };
}

/** ExchangeRate-API (`conversion_rates` keyed, `rates` open) → VND per USD. */
export function parseExchangeRateApi(json: unknown): { rate: number; at?: string } | null {
  const d = json as { result?: unknown; base_code?: unknown; conversion_rates?: Record<string, unknown>; rates?: Record<string, unknown>; time_last_update_unix?: unknown } | null;
  if (!d || d.result !== "success" || (d.base_code && d.base_code !== "USD")) return null;
  const rate = parseLooseNumber((d.conversion_rates ?? d.rates)?.VND);
  if (!inRange(rate, USD_BOUNDS)) return null;
  const unix = typeof d.time_last_update_unix === "number" ? d.time_last_update_unix : null;
  return { rate, at: unix ? new Date(unix * 1000).toISOString() : undefined };
}

/** PNJ product codes → our products. Prices are thousand VND per chỉ. */
const PNJ_CODES: Record<string, GoldProductId> = {
  SJC: "sjc_bar",
  N24K: "ring_9999",
  "24K": "k24",
  "999": "k999",
  "99": "k99",
  "22K": "k22",
  "75": "k18",
  "68": "k16",
  "65": "k15",
  "61": "k14_6",
  "58.5": "k14",
  "41": "k10",
  "37.5": "k9",
  "33": "k8",
};

/** "13/10/2026 13:54:19" (Vietnam time) → ISO. */
export function parseVnDateTime(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v.trim());
  if (!m) return undefined;
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${s.padStart(2, "0")}+07:00`;
  return Number.isNaN(Date.parse(iso)) ? undefined : new Date(iso).toISOString();
}

export function parsePnj(json: unknown): { prices: GoldPrices; at?: string } | null {
  const d = json as { data?: unknown; updateDate?: unknown } | null;
  if (!d || !Array.isArray(d.data)) return null;
  const prices: GoldPrices = {};
  for (const row of d.data as Record<string, unknown>[]) {
    const id = PNJ_CODES[String(row?.masp ?? "")];
    if (!id) continue;
    const buy = parseLooseNumber(row.giamua) * 1000;
    const sell = parseLooseNumber(row.giaban) * 1000;
    if (!inRange(buy, CHI_BOUNDS)) continue;
    prices[id] = { buy, sell: inRange(sell, CHI_BOUNDS) ? sell : buy };
  }
  // Without the 999.9 benchmarks the list isn't usable.
  if (!prices.sjc_bar && !prices.ring_9999 && !prices.k24) return null;
  return { prices, at: parseVnDateTime(d.updateDate) };
}

/** vang.today codes → our products. Prices are VND per lượng (10 chỉ). */
const VANG_TODAY_CODES: Record<string, GoldProductId> = { SJL1L10: "sjc_bar", SJ9999: "ring_9999" };

export function parseVangToday(json: unknown): { prices: GoldPrices; at?: string; worldUsdPerOunce?: number } | null {
  const d = json as { success?: unknown; prices?: Record<string, Record<string, unknown>>; timestamp?: unknown } | null;
  if (!d || d.success !== true || !d.prices || typeof d.prices !== "object") return null;
  const prices: GoldPrices = {};
  for (const [code, id] of Object.entries(VANG_TODAY_CODES)) {
    const row = d.prices[code];
    if (!row || row.currency !== "VND") continue;
    const buy = parseLooseNumber(row.buy) / 10;
    const sell = parseLooseNumber(row.sell) / 10;
    if (!inRange(buy, CHI_BOUNDS)) continue;
    prices[id] = { buy: Math.round(buy), sell: Math.round(inRange(sell, CHI_BOUNDS) ? sell : buy) };
  }
  if (!prices.sjc_bar && !prices.ring_9999) return null;
  const world = parseLooseNumber(d.prices.XAUUSD?.buy);
  const unix = typeof d.timestamp === "number" ? d.timestamp : null;
  return { prices, at: unix ? new Date(unix * 1000).toISOString() : undefined, worldUsdPerOunce: world > 100 ? world : undefined };
}

export function parseGoldApi(json: unknown): number | null {
  const price = parseLooseNumber((json as { price?: unknown } | null)?.price);
  return price > 100 && price < 100_000 ? price : null;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} HTTP ${res.status}`);
  return res.json();
}

/** Today in Vietnam, `YYYY-MM-DD`. */
function vnToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

async function fetchUsd(): Promise<RatesSnapshot["usd"]> {
  const now = new Date().toISOString();
  const env = Number(process.env.USD_VND_RATE?.trim());
  if (inRange(env, USD_BOUNDS)) return { rate: env, source: "env", at: now };
  try {
    const vcb = parseVietcombank(await getJson(`https://www.vietcombank.com.vn/api/exchangerates?date=${vnToday()}`));
    if (vcb) return { rate: vcb.rate, buy: vcb.buy, sell: vcb.sell, source: "vietcombank", at: vcb.at ?? now };
  } catch (e) {
    console.warn("[wealthtracker] Vietcombank rate unavailable", String(e));
  }
  const key = process.env.EXCHANGERATE_API_KEY?.trim();
  try {
    const url = key ? `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD` : "https://open.er-api.com/v6/latest/USD";
    const er = parseExchangeRateApi(await getJson(url));
    if (er) return { rate: er.rate, source: key ? "exchangerate-api" : "open-er-api", at: er.at ?? now };
  } catch (e) {
    console.warn("[wealthtracker] ExchangeRate-API unavailable", String(e));
  }
  return null;
}

async function fetchGold(usdRate: number | null): Promise<RatesSnapshot["gold"]> {
  const now = new Date().toISOString();
  const [pnj, vt] = await Promise.allSettled([getJson("https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00"), getJson("https://www.vang.today/api/prices")]);
  const fromVt = vt.status === "fulfilled" ? parseVangToday(vt.value) : null;
  const fromPnj = pnj.status === "fulfilled" ? parsePnj(pnj.value) : null;
  if (fromPnj) {
    // PNJ has every purity; vang.today's SJC-brand bar price fills in if PNJ lacks it.
    const prices = { ...fromPnj.prices };
    if (!prices.sjc_bar && fromVt?.prices.sjc_bar) prices.sjc_bar = fromVt.prices.sjc_bar;
    return { prices, source: "pnj", at: fromPnj.at ?? now, worldUsdPerOunce: fromVt?.worldUsdPerOunce };
  }
  if (fromVt) return { prices: fromVt.prices, source: "vang-today", at: fromVt.at ?? now, worldUsdPerOunce: fromVt.worldUsdPerOunce };
  if (pnj.status === "rejected") console.warn("[wealthtracker] PNJ gold unavailable", String(pnj.reason));
  if (vt.status === "rejected") console.warn("[wealthtracker] vang.today unavailable", String(vt.reason));
  if (!usdRate) return null;
  try {
    const ounce = parseGoldApi(await getJson("https://api.gold-api.com/price/XAU"));
    if (!ounce) return null;
    const pure = Math.round(worldPricePerChi(ounce, usdRate));
    // Only the pure-gold price is known; other purities are estimated on the device.
    const prices: GoldPrices = { ring_9999: { buy: pure, sell: pure } };
    return { prices, source: "world", at: now, worldUsdPerOunce: ounce };
  } catch (e) {
    console.warn("[wealthtracker] world gold price unavailable", String(e));
    return null;
  }
}

const CACHE_ID = "vn";
let memory: { snapshot: RatesSnapshot; at: number } | null = null;
let inFlight: Promise<RatesSnapshot> | null = null;

async function readStored(): Promise<RatesSnapshot | null> {
  if (!tryGetSql() || !(await ensureSchema("rates"))) return null;
  try {
    const rows = (await getSql()`SELECT payload FROM wealthtracker_rates_cache WHERE id = ${CACHE_ID}`) as { payload: RatesSnapshot }[];
    return rows[0]?.payload ?? null;
  } catch {
    return null;
  }
}

async function writeStored(snapshot: RatesSnapshot): Promise<void> {
  if (!tryGetSql() || !(await ensureSchema("rates"))) return;
  try {
    await getSql()`
      INSERT INTO wealthtracker_rates_cache (id, payload, fetched_at) VALUES (${CACHE_ID}, ${JSON.stringify(snapshot)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at
    `;
  } catch (e) {
    console.warn("[wealthtracker] could not keep rates", String(e));
  }
}

async function refresh(): Promise<RatesSnapshot> {
  const usd = await fetchUsd();
  const gold = await fetchGold(usd?.rate ?? null);
  let snapshot: RatesSnapshot = { usd, gold, fetchedAt: new Date().toISOString() };
  if (usd && gold) {
    await writeStored(snapshot);
    return snapshot;
  }
  // Something is down: fill the gap with the last good value (marked as such).
  const stored = await readStored();
  snapshot = {
    usd: usd ?? (stored?.usd ? { ...stored.usd, source: "cache" } : null),
    gold: gold ?? (stored?.gold ? { ...stored.gold, source: "cache" } : null),
    fetchedAt: snapshot.fetchedAt,
  };
  if (usd || gold) await writeStored({ ...snapshot, usd: usd ?? stored?.usd ?? null, gold: gold ?? stored?.gold ?? null });
  return snapshot;
}

export async function resolveRates(): Promise<RatesSnapshot> {
  if (memory && Date.now() - memory.at < TTL_MS) return memory.snapshot;
  inFlight ??= refresh()
    .then((snapshot) => {
      // Cache a partial result briefly only, so a recovered source shows up soon.
      memory = { snapshot, at: snapshot.usd && snapshot.gold ? Date.now() : Date.now() - TTL_MS + 60_000 };
      return snapshot;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

