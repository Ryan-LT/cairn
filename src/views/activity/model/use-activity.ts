"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ActivityEntry } from "../lib/describe";

const PAGE_SIZE = 50;

export type ActivityStatus = "loading" | "ready" | "unavailable" | "error";

type Page = { available: boolean; entries: ActivityEntry[]; nextBefore: string | null };

async function fetchPage(params: { types: readonly string[]; entity: string | null; before: string | null }, signal: AbortSignal): Promise<Page> {
  const q = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (params.types.length) q.set("types", params.types.join(","));
  if (params.entity) q.set("entity", params.entity);
  if (params.before) q.set("before", params.before);
  const res = await fetch(`/api/activity?${q}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`activity ${res.status}`);
  return (await res.json()) as Page;
}

/** The change log from the server, newest first, a page at a time. */
export function useActivity({ types, entity, enabled }: { types: readonly string[]; entity: string | null; enabled: boolean }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [status, setStatus] = useState<ActivityStatus>("loading");
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const typesKey = types.join(",");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    abort.current?.abort();
    abort.current = ctrl;
    fetchPage({ types: typesKey ? typesKey.split(",") : [], entity, before: null }, ctrl.signal)
      .then((page) => {
        setEntries(page.entries);
        setNextBefore(page.nextBefore);
        setStatus(page.available ? "ready" : "unavailable");
      })
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) {
          console.error(e);
          setStatus("error");
        }
      });
    return () => ctrl.abort();
  }, [typesKey, entity, enabled, attempt]);

  const loadMore = useCallback(async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage({ types: typesKey ? typesKey.split(",") : [], entity, before: nextBefore }, new AbortController().signal);
      setEntries((prev) => [...prev, ...page.entries]);
      setNextBefore(page.nextBefore);
    } catch (e) {
      console.error(e);
      setStatus("error");
    } finally {
      setLoadingMore(false);
    }
  }, [nextBefore, loadingMore, typesKey, entity]);

  /** Start over (filter change shows the spinner again; retry after an error). */
  const reload = useCallback(() => {
    setStatus("loading");
    setEntries([]);
    setAttempt((n) => n + 1);
  }, []);

  return { entries, status, hasMore: nextBefore !== null, loadingMore, loadMore, reload };
}
