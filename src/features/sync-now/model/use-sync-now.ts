"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { requestBankInboxSync } from "@/entities/ledger";
import { useI18n } from "@/shared/i18n";
import { backgroundRefetchTables, flushTablesNow } from "@/shared/storage/store";

/** Push pending edits, then pull the latest tables — without the full-screen loader. */
export function useSyncNow() {
  const { t } = useI18n();
  const [syncing, setSyncing] = useState(false);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const pushed = await flushTablesNow();
      if (!pushed) {
        toast.error(t.shell.sync.unreachable, {
          description: t.shell.sync.savedLocally,
        });
        return;
      }
      await backgroundRefetchTables();
      requestBankInboxSync();
      toast.success(t.shell.sync.synced);
    } finally {
      setSyncing(false);
    }
  }, [t]);

  return { syncNow, syncing };
}
