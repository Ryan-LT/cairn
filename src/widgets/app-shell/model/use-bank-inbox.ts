"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { BANK_INBOX_SYNC_EVENT, syncBankInbox } from "@/entities/ledger";
import { useI18n } from "@/shared/i18n";
import { onAppForeground } from "@/shared/lib/app-foreground";
import { useCurrency } from "@/shared/lib/currency/provider";
import { readSessionUser } from "@/shared/lib/session-user";
import { useInitialLoadDone } from "@/shared/storage";

import { useOptimisticNavigation } from "./navigation";

/** New bank transactions are checked this often while the app is open. */
const POLL_MS = 2 * 60_000;

/**
 * Brings webhook transactions into the ledger from any page: a full check
 * once data has loaded, on returning to the app and on "Sync now", and a
 * cheap check for new ones every two minutes while the app is visible.
 */
export function useBankInbox(): void {
  const loaded = useInitialLoadDone();
  const { t } = useI18n();
  const { navigate } = useOptimisticNavigation();
  const rate = useCurrency()?.rates.vndPerUsd ?? null;
  const latest = useRef({ t, navigate, rate });
  useEffect(() => {
    latest.current = { t, navigate, rate };
  });

  useEffect(() => {
    // Signed out / local mode: there is no inbox.
    if (!loaded || !readSessionUser()) return;
    const check = async (full: boolean) => {
      const added = await syncBankInbox({ full, vndPerUsd: latest.current.rate });
      if (!added) return;
      const { t: msg, navigate: go } = latest.current;
      toast.success(msg.connect.inbox.added({ count: added }), {
        action: { label: msg.connect.inbox.view, onClick: () => go("/cashflow/history") },
      });
    };
    void check(true);
    const offForeground = onAppForeground(() => void check(true));
    const onRequest = () => void check(true);
    window.addEventListener(BANK_INBOX_SYNC_EVENT, onRequest);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) void check(false);
    }, POLL_MS);
    return () => {
      offForeground();
      window.removeEventListener(BANK_INBOX_SYNC_EVENT, onRequest);
      clearInterval(timer);
    };
  }, [loaded]);
}
