import { tryGetSql } from "@/shared/api/db";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type Sql = NonNullable<ReturnType<typeof tryGetSql>>;

export type UsdVndRateSource = "env" | "cache" | "exchangerate-api" | "stale_cache";

export type ResolvedUsdVndRate = {
  vndPerUsd: number;
  source: UsdVndRateSource;
  /** When we last wrote this row or received API data (ISO). */
  fetchedAtIso: string | null;
  /** Provider's `time_last_update_utc` when from API/cache (ISO). */
  apiLastUpdateIso: string | null;
};

/** Matches https://www.exchangerate-api.com/docs/standard-requests success payload. */
type ExchangeRateApiSuccess = {
  result: "success";
  time_last_update_unix?: number;
  time_last_update_utc?: string;
  time_next_update_unix?: number;
  time_next_update_utc?: string;
  base_code?: string;
  conversion_rates?: Record<string, number>;
};

type ExchangeRateApiError = {
  result: "error";
  "error-type"?: string;
};

function parseApiLastUpdate(iso?: string): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseApiInstant(
  utc?: string,
  unix?: number,
): Date | null {
  if (typeof unix === "number" && Number.isFinite(unix) && unix > 0) {
    const d = new Date(unix * 1000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return parseApiLastUpdate(utc);
}

async function fetchVndPerUsdFromExchangeRateApi(apiKey: string): Promise<{
  vndPerUsd: number;
  apiLastUpdate: Date | null;
  apiNextUpdate: Date | null;
}> {
  const url = `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/latest/USD`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`ExchangeRate-API HTTP ${res.status}`);
  }
  const data = (await res.json()) as ExchangeRateApiSuccess | ExchangeRateApiError;
  if (data.result === "error") {
    throw new Error(`ExchangeRate-API: ${data["error-type"] ?? "unknown error"}`);
  }
  if (data.base_code != null && data.base_code !== "" && data.base_code !== "USD") {
    throw new Error(`ExchangeRate-API: unexpected base_code ${data.base_code}`);
  }
  const vnd = data.conversion_rates?.VND;
  if (typeof vnd !== "number" || !Number.isFinite(vnd) || vnd <= 0) {
    throw new Error("ExchangeRate-API: missing or invalid VND rate");
  }
  const apiLastUpdate = parseApiInstant(data.time_last_update_utc, data.time_last_update_unix);
  const apiNextUpdate = parseApiInstant(data.time_next_update_utc, data.time_next_update_unix);
  return {
    vndPerUsd: vnd,
    apiLastUpdate,
    apiNextUpdate,
  };
}

type CacheRow = {
  rate: number;
  fetched_at: string;
  api_time_last_update_utc: string | null;
  api_time_next_update_utc: string | null;
};

async function readCache(sql: Sql): Promise<CacheRow | null> {
  const rows = (await sql`
    SELECT
      rate::float8 AS rate,
      fetched_at::text AS fetched_at,
      api_time_last_update_utc::text AS api_time_last_update_utc,
      api_time_next_update_utc::text AS api_time_next_update_utc
    FROM cairn_fx_cache
    WHERE base_code = 'USD'
      AND quote_code = 'VND'
    LIMIT 1
  `) as CacheRow[];
  return rows[0] ?? null;
}

/** Use provider next-update when present; otherwise fall back to max age since fetch. */
function isCacheFresh(row: CacheRow, nowMs: number): boolean {
  const nextRaw = row.api_time_next_update_utc?.trim();
  if (nextRaw) {
    const next = new Date(nextRaw).getTime();
    if (!Number.isNaN(next) && nowMs < next) {
      return true;
    }
  }
  const age = nowMs - new Date(row.fetched_at).getTime();
  return age >= 0 && age < CACHE_TTL_MS;
}

async function upsertCache(
  sql: Sql,
  vndPerUsd: number,
  apiLastUpdate: Date | null,
  apiNextUpdate: Date | null,
): Promise<void> {
  await sql`
    INSERT INTO cairn_fx_cache (
      base_code,
      quote_code,
      rate,
      fetched_at,
      provider,
      api_time_last_update_utc,
      api_time_next_update_utc
    )
    VALUES (
      'USD',
      'VND',
      ${vndPerUsd},
      now(),
      'exchangerate-api',
      ${apiLastUpdate},
      ${apiNextUpdate}
    )
    ON CONFLICT (base_code, quote_code)
    DO UPDATE SET
      rate = EXCLUDED.rate,
      fetched_at = EXCLUDED.fetched_at,
      provider = EXCLUDED.provider,
      api_time_last_update_utc = EXCLUDED.api_time_last_update_utc,
      api_time_next_update_utc = EXCLUDED.api_time_next_update_utc
  `;
}

function rowToResolved(
  row: CacheRow,
  source: UsdVndRateSource,
): ResolvedUsdVndRate {
  return {
    vndPerUsd: row.rate,
    source,
    fetchedAtIso: new Date(row.fetched_at).toISOString(),
    apiLastUpdateIso: row.api_time_last_update_utc
      ? new Date(row.api_time_last_update_utc).toISOString()
      : null,
  };
}

/**
 * Resolves VND per 1 USD: manual env override, then DB cache while `time_next_update_utc` is in the future
 * (or ≤24h since fetch if that column is unset), else ExchangeRate-API (then DB write).
 * Stale DB rows are used only if the API key is missing or the live request fails.
 */
export async function resolveUsdVndRate(): Promise<ResolvedUsdVndRate | null> {
  const envManual = process.env.USD_VND_RATE?.trim();
  if (envManual) {
    const n = Number(envManual);
    if (Number.isFinite(n) && n > 0) {
      return {
        vndPerUsd: n,
        source: "env",
        fetchedAtIso: null,
        apiLastUpdateIso: null,
      };
    }
  }

  const sql = tryGetSql();
  const apiKey = process.env.EXCHANGERATE_API_KEY?.trim();

  let cached: CacheRow | null = null;
  if (sql) {
    try {
      cached = await readCache(sql);
    } catch {
      cached = null;
    }
  }

  const now = Date.now();
  if (cached && isCacheFresh(cached, now)) {
    return rowToResolved(cached, "cache");
  }

  if (apiKey) {
    try {
      const { vndPerUsd, apiLastUpdate, apiNextUpdate } =
        await fetchVndPerUsdFromExchangeRateApi(apiKey);
      if (sql) {
        try {
          await upsertCache(sql, vndPerUsd, apiLastUpdate, apiNextUpdate);
          const refreshed = await readCache(sql);
          if (refreshed) {
            return rowToResolved(refreshed, "exchangerate-api");
          }
        } catch {
          /* persist failed — still return live API value */
        }
      }
      return {
        vndPerUsd,
        source: "exchangerate-api",
        fetchedAtIso: new Date().toISOString(),
        apiLastUpdateIso: apiLastUpdate?.toISOString() ?? null,
      };
    } catch {
      /* use stale cache below */
    }
  }

  if (cached) {
    return rowToResolved(cached, "stale_cache");
  }

  return null;
}
