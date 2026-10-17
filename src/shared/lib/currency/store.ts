"use client";

import "@/shared/lib/legacy-storage";
import type { RatesSnapshot } from "./rates";

/**
 * Live rates on this device: shown at once from the last copy kept on the
 * device, refreshed from `/api/rates`. Plain module state shared by every
 * reader (`useSyncExternalStore`).
 */

const CACHE_KEY = "cairn:rates:v1";
const STALE_MS = 30 * 60_000;

type State = { snapshot: RatesSnapshot | null; loading: boolean; error: boolean; loadedAt: number | null };

let state: State = { snapshot: null, loading: false, error: false, loadedAt: null };
let primed = false;
const listeners = new Set<() => void>();

function emit(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function prime() {
  if (primed || typeof window === "undefined") return;
  primed = true;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RatesSnapshot) : null;
    if (parsed && typeof parsed === "object" && "fetchedAt" in parsed) state = { ...state, snapshot: parsed };
  } catch {
    // Private mode or bad data: start empty.
  }
}

export function subscribeRates(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRatesState(): State {
  prime();
  return state;
}

const SERVER_STATE: State = { snapshot: null, loading: false, error: false, loadedAt: null };
export function getServerRatesState(): State {
  return SERVER_STATE;
}

let inFlight: Promise<void> | null = null;

/** Fetch fresh rates (skipped while a recent fetch is still fresh, unless forced). */
export function loadRates(force = false): Promise<void> {
  prime();
  if (!force && state.loadedAt && Date.now() - state.loadedAt < STALE_MS) return Promise.resolve();
  if (inFlight) return inFlight;
  emit({ loading: true });
  inFlight = fetch("/api/rates", { cache: force ? "no-store" : "default" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`rates ${res.status}`);
      const snapshot = (await res.json()) as RatesSnapshot;
      // Keep what we had for a part that is missing now.
      const merged: RatesSnapshot = { ...snapshot, usd: snapshot.usd ?? state.snapshot?.usd ?? null, gold: snapshot.gold ?? state.snapshot?.gold ?? null };
      emit({ snapshot: merged, loading: false, error: false, loadedAt: Date.now() });
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
      } catch {
        // Storage full or blocked: fine, it's only a head start.
      }
    })
    .catch((e: unknown) => {
      console.warn("[cairn] rates unavailable", e);
      emit({ loading: false, error: true });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
