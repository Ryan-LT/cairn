/**
 * Before the app was renamed to Cairn, every localStorage key started with
 * `wealthtracker:`. Move them to `cairn:` so the device cache (which can hold
 * edits not yet synced), rates and preferences carry over. Runs once on import,
 * before any module reads its key; a key already under the new name wins.
 */
const OLD_PREFIX = "wealthtracker:";
const NEW_PREFIX = "cairn:";

export function migrateLegacyStorageKeys(storage: Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">): void {
  try {
    const legacy: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(OLD_PREFIX)) legacy.push(key);
    }
    for (const key of legacy) {
      const next = NEW_PREFIX + key.slice(OLD_PREFIX.length);
      const value = storage.getItem(key);
      if (value !== null && storage.getItem(next) === null) storage.setItem(next, value);
      storage.removeItem(key);
    }
  } catch {
    // Storage unavailable or full — the old keys stay and are retried next load.
  }
}

if (typeof window !== "undefined") {
  try {
    migrateLegacyStorageKeys(window.localStorage);
  } catch {
    // localStorage blocked (private mode).
  }
}
