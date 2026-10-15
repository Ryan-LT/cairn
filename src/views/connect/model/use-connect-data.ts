"use client";

import { useCallback, useEffect, useState } from "react";

import type { InboxTxn, WebhookProvider } from "@/entities/ledger";
import type { ShareLink } from "@/features/share-report";

export type WebhookKey = { id: string; name: string; hint: string; defaultAccountId: string | null; createdAt: string; lastUsedAt: string | null };
export type ReceivedTxn = { id: string; provider: WebhookProvider; txn: InboxTxn; receivedAt: string; acked: boolean; dismissed: boolean; keyName: string | null };

export type LoadStatus = "loading" | "ready" | "unavailable" | "error";

/** GET a list endpoint; `reload` fetches it again (after a change). */
function useServerList<T>(url: string, pick: (data: Record<string, unknown>) => T, empty: T) {
  const [state, setState] = useState<{ status: LoadStatus; data: T }>({ status: "loading", data: empty });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Record<string, unknown>;
        setState({ status: data.available === false ? "unavailable" : "ready", data: pick(data) });
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setState((s) => ({ ...s, status: "error" }));
      });
    return () => ctrl.abort();
    // `pick` and `empty` are stable per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, attempt]);

  return { ...state, reload, setData: (fn: (d: T) => T) => setState((s) => ({ ...s, data: fn(s.data) })) };
}

const EMPTY_KEYS = { keys: [] as WebhookKey[], recent: [] as ReceivedTxn[] };

export function useWebhookKeys() {
  return useServerList("/api/webhooks/tokens", (d) => ({ keys: (d.keys ?? []) as WebhookKey[], recent: (d.recent ?? []) as ReceivedTxn[] }), EMPTY_KEYS);
}

const EMPTY_SHARES: ShareLink[] = [];

export function useShareLinks() {
  return useServerList("/api/shares", (d) => (d.shares ?? []) as ShareLink[], EMPTY_SHARES);
}

export async function sendJson(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<Response> {
  return fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
