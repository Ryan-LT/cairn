"use client";

import { useCallback, useEffect, useState } from "react";

import type { ActivityEntry } from "../lib/describe";

const PAGE_SIZE = 50;

/** `refreshing`: a new query is loading while the previous results stay on screen. */
export type ActivityStatus = "loading" | "refreshing" | "ready" | "unavailable" | "error";

export type ActivitySummary = { total: number; oldest: string | null };

export type ActivityParams = {
  types: readonly string[];
  entity: string | null;
  actions: readonly string[];
  search: string;
  /** ISO instant: only entries saved before it ("jump to a month"). */
  until: string | null;
};

type Page = { available: boolean; entries: ActivityEntry[]; nextBefore: string | null; summary: ActivitySummary | null };

async function fetchPage(params: ActivityParams, before: string | null, signal?: AbortSignal): Promise<Page> {
  const q = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (params.types.length) q.set("types", params.types.join(","));
  if (params.actions.length) q.set("actions", params.actions.join(","));
  if (params.entity) q.set("entity", params.entity);
  if (params.search.trim()) q.set("q", params.search.trim());
  if (params.until) q.set("until", params.until);
  if (before) q.set("before", before);
  const res = await fetch(`/api/activity?${q}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`activity ${res.status}`);
  return (await res.json()) as Page;
}

type Loaded = {
  /** The query these entries belong to; a different query means "loading". */
  key: string;
  status: Exclude<ActivityStatus, "loading" | "refreshing">;
  entries: ActivityEntry[];
  nextBefore: string | null;
  summary: ActivitySummary | null;
  loadingMore: boolean;
};

/**
 * The change log from the server, newest first, a page at a time. Each query
 * (filters, search, month) starts over; a page that arrives after the query
 * changed is dropped, so results never mix.
 */
export function useActivity(params: ActivityParams & { enabled: boolean }) {
  const { enabled, ...query } = params;
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([query.types, query.entity, query.actions, query.search.trim(), query.until, attempt]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const current = loaded?.key === key ? loaded : null;

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const [types, entity, actions, search, until] = JSON.parse(key) as [string[], string | null, string[], string, string | null];
    fetchPage({ types, entity, actions, search, until }, null, ctrl.signal)
      .then((page) =>
        setLoaded({
          key,
          status: page.available ? "ready" : "unavailable",
          entries: page.entries,
          nextBefore: page.nextBefore,
          summary: page.summary,
          loadingMore: false,
        }),
      )
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        console.error(e);
        setLoaded({ key, status: "error", entries: [], nextBefore: null, summary: null, loadingMore: false });
      });
    return () => ctrl.abort();
  }, [key, enabled]);

  const loadMore = useCallback(async () => {
    if (!current || !current.nextBefore || current.loadingMore) return;
    const forKey = current.key;
    const [types, entity, actions, search, until] = JSON.parse(forKey) as [string[], string | null, string[], string, string | null];
    setLoaded((prev) => (prev?.key === forKey ? { ...prev, loadingMore: true } : prev));
    try {
      const page = await fetchPage({ types, entity, actions, search, until }, current.nextBefore);
      setLoaded((prev) =>
        prev?.key === forKey
          ? { ...prev, entries: [...prev.entries, ...page.entries], nextBefore: page.nextBefore, loadingMore: false }
          : prev,
      );
    } catch (e) {
      console.error(e);
      // Keep what's shown; the button (or the next scroll) tries again.
      setLoaded((prev) => (prev?.key === forKey ? { ...prev, loadingMore: false } : prev));
      throw e;
    }
  }, [current]);

  /** Fetch again from the top (after an error). */
  const reload = () => setAttempt((n) => n + 1);

  // While a new query loads, keep the last results on screen (dimmed) instead of flashing a skeleton.
  const previous = !current && loaded?.status === "ready" ? loaded : null;
  return {
    entries: (current ?? previous)?.entries ?? [],
    status: current?.status ?? (previous ? "refreshing" : "loading"),
    summary: (current ?? previous)?.summary ?? null,
    hasMore: Boolean(current?.nextBefore),
    loadingMore: current?.loadingMore ?? false,
    loadMore,
    reload,
  };
}
