"use client";

import { useCallback, useSyncExternalStore } from "react";

import { readSessionUser } from "@/shared/lib/session-user";

import { isStoredKey, type StoredKey } from "./table-keys";

/** Keys of `source` the store keeps (fixed tables and monthly ledger tables). */
function storedKeysIn(source: object): StoredKey[] {
  return Object.keys(source).filter(isStoredKey);
}

const tablesUrl = "/api/tables";
/** Device cache, one per account: `wealthtracker:tables:v1:<userId>` (`:local` without login). */
const LOCAL_CACHE_PREFIX = "wealthtracker:tables:v1";
/** Before multi-account login the cache had no account suffix; dropped on first load. */
const LEGACY_LOCAL_CACHE_KEY = LOCAL_CACHE_PREFIX;
/** PUT header naming the account the pending edits belong to (checked against the session). */
const USER_HEADER = "X-WT-User";

type Listener = () => void;

const listeners = new Set<Listener>();

/** In-memory table values (browser). Filled from Neon on hydrate; updated by writes. */
const valueCache = new Map<string, unknown>();

/** Keys changed since last successful persist (or waiting for first flush after hydrate). */
const dirty = new Set<string>();

let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** Consecutive failed PUTs; drives retry backoff (400 ms doubling up to 30 s). */
let flushFailures = 0;
const FLUSH_DEBOUNCE_MS = 400;
const FLUSH_MAX_BACKOFF_MS = 30_000;
let flushInFlight: Promise<boolean> | null = null;
let hydrateState: "pending" | "ok" | "error" = "pending";
let hydratePromise: Promise<void> | null = null;
let syncInFlight: Promise<void> | null = null;
/** Server syncs in flight (drives the top progress bar). */
let syncsInFlight = 0;
let localCacheLoaded = false;
let lastSyncedAt: number | null = null;
let initialLoadDone = false;
/**
 * Account this page's data belongs to, fixed at first load. Signing in or out
 * reloads the page, so a tab never mixes two accounts' data.
 */
let owner: string | null = null;
/** Set once this account's device cache has been cleared on sign-out. */
let disposed = false;
/** Server refused this tab's edits because the session is another account's; stop retrying. */
let accountBlocked = false;
/** The session expired or was revoked (password changed elsewhere); the page is leaving for /login. */
let signedOut = false;

function ownerId(): string | null {
  if (owner === null) owner = readSessionUser()?.id ?? "";
  return owner || null;
}

/**
 * A 401 while signed in: the session expired or was revoked (e.g. the password
 * changed on another device). Unsynced edits stay in this account's device
 * cache and sync after the next sign-in. The cookies are cleared first, since
 * a validly signed but revoked cookie would bounce /login back to the app.
 */
function handleSignedOut(): void {
  if (signedOut || !readSessionUser()) return;
  signedOut = true;
  persistLocalCache();
  const from = `${window.location?.pathname ?? "/"}`;
  void fetch("/api/auth/logout", { method: "POST" })
    .catch(() => undefined)
    .finally(() => window.location?.replace?.(`/login?from=${encodeURIComponent(from)}`));
}

function localCacheKey(userId = ownerId()): string {
  return `${LOCAL_CACHE_PREFIX}:${userId ?? "local"}`;
}

/**
 * The session now belongs to another account (signed in elsewhere in this
 * browser): reload so this tab shows that account. Edits stay in this
 * account's device cache and sync on its next sign-in.
 */
function handleAccountMismatch(): void {
  const current = readSessionUser()?.id ?? null;
  if (current && current !== ownerId() && typeof window.location?.reload === "function") {
    window.location.reload();
  }
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.fetch !== "undefined";
}

type StoredShape = {
  tables?: Partial<Record<StoredKey, unknown>>;
  lastSyncedAt?: number | null;
  /** Tables edited on this device but not yet saved to the server. */
  dirty?: string[];
};

function loadLocalCache(): void {
  if (localCacheLoaded) return;
  localCacheLoaded = true;
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(LEGACY_LOCAL_CACHE_KEY);
    const raw = window.localStorage.getItem(localCacheKey());
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredShape & Partial<Record<StoredKey, unknown>>;
    if (!parsed || typeof parsed !== "object") return;
    // Detect shape: new envelope has a `tables` object; legacy stored table keys directly.
    const tables =
      parsed.tables && typeof parsed.tables === "object" && !Array.isArray(parsed.tables)
        ? parsed.tables
        : (parsed as Partial<Record<StoredKey, unknown>>);
    for (const key of storedKeysIn(tables)) {
      if (tables[key] !== undefined) {
        valueCache.set(key, tables[key]);
      }
    }
    if (typeof parsed.lastSyncedAt === "number") {
      lastSyncedAt = parsed.lastSyncedAt;
    }
    // Unsynced edits survive a reload or app restart; the next sync keeps and pushes them.
    if (Array.isArray(parsed.dirty)) {
      for (const key of parsed.dirty) {
        if (typeof key === "string" && isStoredKey(key) && valueCache.has(key)) dirty.add(key);
      }
    }
  } catch {
    // Corrupt cache — ignore.
  }
}

function persistLocalCache(): void {
  if (!isBrowser() || disposed) return;
  try {
    const tables: Record<string, unknown> = {};
    for (const [key, value] of valueCache) {
      if (isStoredKey(key)) tables[key] = value;
    }
    const envelope: StoredShape = { tables, lastSyncedAt, dirty: [...dirty] };
    window.localStorage.setItem(localCacheKey(), JSON.stringify(envelope));
  } catch {
    // Quota or serialization error — non-fatal.
  }
}

function subscribe(listener: Listener): () => void {
  loadLocalCache();
  listeners.add(listener);
  void ensureHydrated();
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  familyVersion += 1;
  listeners.forEach((l) => l());
}

function syncFromServer(): Promise<void> {
  if (!isBrowser()) {
    return Promise.resolve();
  }
  if (syncInFlight) {
    return syncInFlight;
  }
  syncsInFlight += 1;
  queueMicrotask(notify);
  syncInFlight = (async () => {
    try {
      const res = await fetch(tablesUrl, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) handleSignedOut();
        throw new Error(`GET ${tablesUrl} ${res.status}`);
      }
      const data = (await res.json()) as { userId?: string; tables?: Partial<Record<StoredKey, unknown>> };
      if (data.userId !== undefined && data.userId !== ownerId()) {
        handleAccountMismatch();
        throw new Error("Tables belong to a different account");
      }
      const remote = data.tables ?? {};
      for (const key of storedKeysIn(remote)) {
        if (dirty.has(key)) {
          continue;
        }
        if (remote[key] !== undefined) {
          valueCache.set(key, remote[key]);
        }
      }
      hydrateState = "ok";
      lastSyncedAt = Date.now();
      initialLoadDone = true;
      persistLocalCache();
    } catch {
      if (valueCache.size > 0) {
        hydrateState = "ok";
        initialLoadDone = true;
      } else if (hydrateState === "pending") {
        hydrateState = "error";
      }
    } finally {
      syncsInFlight -= 1;
      notify();
      if (dirty.size > 0) {
        scheduleFlush();
      }
    }
  })().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

function ensureHydrated(): Promise<void> {
  if (!isBrowser()) {
    return Promise.resolve();
  }
  if (hydratePromise) {
    return hydratePromise;
  }
  hydratePromise = syncFromServer();
  return hydratePromise;
}

/** `retry`: back off after failures; user writes always use the short debounce. */
function scheduleFlush(retry = false): void {
  if (!isBrowser() || disposed || accountBlocked || signedOut) {
    return;
  }
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  const delay = retry
    ? Math.min(FLUSH_MAX_BACKOFF_MS, FLUSH_DEBOUNCE_MS * 2 ** flushFailures)
    : FLUSH_DEBOUNCE_MS;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushDirty();
  }, delay);
}

/** Resolves `true` when the attempted keys were persisted. */
async function flushDirty(): Promise<boolean> {
  if (dirty.size === 0) {
    return true;
  }
  if (accountBlocked || signedOut) {
    return false;
  }
  if (flushInFlight) {
    return flushInFlight;
  }

  const keysToFlush = [...dirty];
  const tables: Record<string, unknown> = {};
  for (const k of keysToFlush) {
    tables[k] = valueCache.get(k);
  }

  flushInFlight = (async () => {
    try {
      const userId = ownerId();
      const res = await fetch(tablesUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(userId ? { [USER_HEADER]: userId } : {}) },
        body: JSON.stringify({ tables }),
        cache: "no-store",
      });
      if (res.status === 401) handleSignedOut();
      if (res.status === 409) {
        // Keep the edits in this account's device cache; they sync on its next sign-in.
        accountBlocked = true;
        handleAccountMismatch();
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? `PUT ${tablesUrl} ${res.status}`);
      }
      for (const k of keysToFlush) {
        // A table edited again while this PUT was in flight stays dirty.
        if (valueCache.get(k) === tables[k]) dirty.delete(k);
      }
      flushFailures = 0;
      persistLocalCache();
      return true;
    } catch (e) {
      console.error("[wealthtracker] persist to Neon failed", e);
      flushFailures = Math.min(flushFailures + 1, 10);
      return false;
    } finally {
      flushInFlight = null;
      if (dirty.size > 0) {
        scheduleFlush(flushFailures > 0);
      }
    }
  })();

  return flushInFlight;
}

/**
 * Wait for pending debounced writes to reach the server. Resolves `false` (instead
 * of retrying forever) when a write fails, e.g. offline; the regular debounced
 * retry keeps going in the background.
 */
/**
 * Remove the signed-in account's tables from this device (sign-out). Unsynced
 * edits are lost, so call it only after {@link flushTablesNow} succeeded.
 */
export function clearLocalTables(): void {
  if (!isBrowser()) return;
  disposed = true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  try {
    window.localStorage.removeItem(localCacheKey());
  } catch {
    // Storage blocked — nothing to clear.
  }
}

export async function flushTablesNow(): Promise<boolean> {
  if (!isBrowser()) return true;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (dirty.size > 0) {
    const ok = await flushDirty();
    if (!ok) return false;
  }
  return true;
}

function readSnapshot<T>(name: string, seed: T): T {
  loadLocalCache();
  if (valueCache.has(name)) {
    return valueCache.get(name) as T;
  }
  return seed;
}

export function readTable<T>(name: string, seed: T): T {
  return readSnapshot(name, seed);
}

export function writeTable<T>(name: string, value: T): void {
  if (!isBrowser()) {
    return;
  }
  valueCache.set(name, value);
  dirty.add(name);
  persistLocalCache();
  notify();
  scheduleFlush();
}

/**
 * SSR-safe table hook backed by Neon (via `/api/tables`).
 *
 * Hydrates from Postgres on first client subscribe; updates debounce-save to Neon.
 * The third flag is `hydrated`: `false` until the initial load attempt finishes.
 */
export function useTable<T>(name: string, seed: T) {
  const getSnapshot = useCallback(() => readSnapshot(name, seed), [name, seed]);
  const getServerSnapshot = useCallback(() => seed, [seed]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const loadFinished = useSyncExternalStore(
    subscribe,
    () => hydrateState !== "pending",
    () => false,
  );

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const current = readSnapshot(name, seed);
      const computed =
        typeof next === "function" ? (next as (prev: T) => T)(current) : next;
      writeTable(name, computed);
    },
    [name, seed],
  );

  return [value, update, loadFinished] as const;
}

/** Version bumped on every change, so family snapshots are rebuilt only when something changed. */
let familyVersion = 0;
const familyCache = new Map<string, { version: number; value: Record<string, unknown> }>();

function readFamily(prefix: string): Record<string, unknown> {
  loadLocalCache();
  const cached = familyCache.get(prefix);
  if (cached && cached.version === familyVersion) return cached.value;
  const value: Record<string, unknown> = {};
  for (const [key, v] of [...valueCache.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (key.startsWith(prefix)) value[key] = v;
  }
  // Same content as before: keep the old object so readers don't re-render.
  if (cached && sameShallow(cached.value, value)) {
    familyCache.set(prefix, { version: familyVersion, value: cached.value });
    return cached.value;
  }
  familyCache.set(prefix, { version: familyVersion, value });
  return value;
}

function sameShallow(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

const EMPTY_FAMILY: Record<string, unknown> = {};

/** Every table whose key starts with `prefix` (e.g. the monthly ledger tables), as `{ key: value }`. */
export function useTableFamily(prefix: string): Record<string, unknown> {
  const getSnapshot = useCallback(() => readFamily(prefix), [prefix]);
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_FAMILY);
}

/** Non-hook read of a table family (backups). */
export function readTableFamily(prefix: string): Record<string, unknown> {
  return readFamily(prefix);
}

/**
 * Global hydration flag. `false` until the current Neon fetch resolves (success,
 * offline cache fallback, or error). Returns `false` again while a foreground
 * re-sync is in flight.
 *
 * Mounting this hook also kicks off hydration, so it can gate the first
 * render before any `useTable` subscribes.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hydrateState !== "pending",
    () => false,
  );
}

/**
 * Last successful hydrate-from-server timestamp (epoch ms). `null` until the
 * first network sync completes. Restored from localStorage on cold start.
 */
export function useLastSyncedAt(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => lastSyncedAt,
    () => null,
  );
}

/**
 * Force a re-fetch from Neon. Resets hydration until the request finishes so the
 * shell can show a loading screen. Use only for the initial bootstrap.
 */
export function refetchTables(): Promise<void> {
  if (!isBrowser()) {
    return Promise.resolve();
  }
  hydrateState = "pending";
  hydratePromise = null;
  syncInFlight = null;
  notify();
  return syncFromServer();
}

/**
 * Re-fetch from Neon without resetting hydration — keeps the UI visible while
 * syncing in the background (e.g. PWA foreground resume).
 */
export function backgroundRefetchTables(): Promise<void> {
  if (!isBrowser()) {
    return Promise.resolve();
  }
  hydratePromise = null;
  syncInFlight = null;
  return syncFromServer();
}

/** `true` while tables are being fetched from the server (first load or background resync). */
export function useSyncing(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => syncsInFlight > 0,
    () => false,
  );
}

/**
 * `true` when this device has a cached copy of the tables, so the app can render
 * right away and sync in the background. Always `false` during server rendering.
 */
export function useHasLocalData(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      loadLocalCache();
      return valueCache.size > 0;
    },
    () => false,
  );
}

/** `true` after the first successful hydrate (network or local cache fallback). */
export function useInitialLoadDone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => initialLoadDone,
    () => false,
  );
}
