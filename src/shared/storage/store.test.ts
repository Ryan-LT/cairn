import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FetchMock = ReturnType<typeof vi.fn>;

function installBrowser(fetchImpl: FetchMock, storage = new Map<string, string>(), opts: { userId?: string } = {}) {
  vi.stubGlobal("window", {
    fetch: fetchImpl,
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
    location: { reload: vi.fn(), replace: vi.fn(), pathname: "/debts" },
  });
  vi.stubGlobal("fetch", fetchImpl);
  if (opts.userId) signInAs(opts.userId);
  return storage;
}

/** Sets the readable `wt_user` cookie the login route writes. */
function signInAs(userId: string) {
  const value = Buffer.from(JSON.stringify({ id: userId, name: userId })).toString("base64url");
  vi.stubGlobal("document", { cookie: `theme=dark; wt_user=${value}` });
}

const ok = (body: unknown) => ({ ok: true, json: async () => body });

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("flushTablesNow", () => {
  it("resolves false instead of looping forever when the server is unreachable", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    installBrowser(fetchMock);
    const store = await import("@/shared/storage/store");
    store.writeTable("debts", [{ id: "d1" }]);
    await expect(store.flushTablesNow()).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("PUTs only dirty tables and resolves true", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    installBrowser(fetchMock);
    const store = await import("@/shared/storage/store");
    store.writeTable("personalLoans", [{ id: "loan-1" }]);
    await expect(store.flushTablesNow()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tables");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ tables: { personalLoans: [{ id: "loan-1" }] } });
    await expect(store.flushTablesNow()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("retry backoff", () => {
  it("backs off failed retries but flushes user edits after the short debounce", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    installBrowser(fetchMock);
    const store = await import("@/shared/storage/store");
    store.writeTable("debts", [{ id: "d1" }]);
    await vi.advanceTimersByTimeAsync(400); // debounce → attempt 1 fails
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(799); // retry waits 800 ms
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // attempt 2 fails
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1_599); // next retry waits 1600 ms
    expect(fetchMock).toHaveBeenCalledTimes(2);
    store.writeTable("debts", [{ id: "d2" }]); // new edit → short debounce again
    await vi.advanceTimersByTimeAsync(400);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("unsynced edits", () => {
  it("survive a reload and win over the server copy on the next sync", async () => {
    const storage = installBrowser(vi.fn().mockRejectedValue(new TypeError("offline")));
    let store = await import("@/shared/storage/store");
    store.writeTable("personalLoans", [{ id: "offline-edit" }]);
    await expect(store.flushTablesNow()).resolves.toBe(false);

    // Reload: fresh module state, same localStorage, server reachable again.
    vi.resetModules();
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? ok({ ok: true })
        : ok({ tables: { personalLoans: [{ id: "server" }], debts: [{ id: "server-debt" }] } }),
    );
    installBrowser(fetchMock, storage);
    store = await import("@/shared/storage/store");
    expect(store.readTable("personalLoans", [])).toEqual([{ id: "offline-edit" }]);
    await store.backgroundRefetchTables();
    expect(store.readTable("personalLoans", [])).toEqual([{ id: "offline-edit" }]);
    expect(store.readTable("debts", [])).toEqual([{ id: "server-debt" }]);
    await expect(store.flushTablesNow()).resolves.toBe(true);
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ tables: { personalLoans: [{ id: "offline-edit" }] } });
    expect(JSON.parse(storage.get("cairn:tables:v1:local") ?? "{}").dirty).toEqual([]);
  });

  it("stay dirty when the table is edited again while its PUT is in flight", async () => {
    let release!: () => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(ok({ ok: true })))))
      .mockResolvedValue(ok({ ok: true }));
    installBrowser(fetchMock);
    const store = await import("@/shared/storage/store");
    store.writeTable("debts", [{ id: "first" }]);
    const flushed = store.flushTablesNow();
    store.writeTable("debts", [{ id: "second" }]);
    release();
    await expect(flushed).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as RequestInit).body)));
    expect(bodies.at(-1)).toEqual({ tables: { debts: [{ id: "second" }] } });
  });
});

describe("per-account cache", () => {
  it("keys the device cache by account and drops the legacy shared cache", async () => {
    const storage = new Map([["cairn:tables:v1", JSON.stringify({ tables: { debts: [{ id: "legacy" }] } })]]);
    const fetchMock = vi.fn().mockResolvedValue(ok({ ok: true }));
    installBrowser(fetchMock, storage, { userId: "user-a" });
    const store = await import("@/shared/storage/store");
    expect(store.readTable("debts", [])).toEqual([]);
    expect(storage.has("cairn:tables:v1")).toBe(false);

    store.writeTable("debts", [{ id: "a-debt" }]);
    await expect(store.flushTablesNow()).resolves.toBe(true);
    expect(JSON.parse(storage.get("cairn:tables:v1:user-a") ?? "{}").tables).toEqual({ debts: [{ id: "a-debt" }] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-WT-User"]).toBe("user-a");

    // Another account on the same device starts empty.
    vi.resetModules();
    installBrowser(vi.fn().mockRejectedValue(new TypeError("offline")), storage, { userId: "user-b" });
    const storeB = await import("@/shared/storage/store");
    expect(storeB.readTable("debts", [])).toEqual([]);
  });

  it("ignores tables the server returns for a different account", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ userId: "user-b", tables: { debts: [{ id: "b-debt" }] } }));
    installBrowser(fetchMock, new Map(), { userId: "user-a" });
    const store = await import("@/shared/storage/store");
    await store.backgroundRefetchTables();
    expect(store.readTable("debts", [])).toEqual([]);
  });

  it("stops pushing and keeps edits when the session is another account's (409)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "different account" }) });
    const storage = installBrowser(fetchMock, new Map(), { userId: "user-a" });
    const store = await import("@/shared/storage/store");
    store.writeTable("debts", [{ id: "a-edit" }]);
    signInAs("user-b"); // signed in as B in another tab
    await expect(store.flushTablesNow()).resolves.toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((window.location.reload as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
    const cached = JSON.parse(storage.get("cairn:tables:v1:user-a") ?? "{}");
    expect(cached.dirty).toEqual(["debts"]);
  });

  it("clearLocalTables removes only this account's cache", async () => {
    const storage = new Map([["cairn:tables:v1:user-b", "{}"]]);
    installBrowser(vi.fn().mockResolvedValue(ok({ ok: true })), storage, { userId: "user-a" });
    const store = await import("@/shared/storage/store");
    store.writeTable("debts", [{ id: "a" }]);
    await store.flushTablesNow();
    store.clearLocalTables();
    store.writeTable("debts", [{ id: "after" }]);
    expect(storage.has("cairn:tables:v1:user-a")).toBe(false);
    expect(storage.has("cairn:tables:v1:user-b")).toBe(true);
  });
});

describe("revoked session (401)", () => {
  it("signs out once, keeps unsynced edits and goes to /login", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url === "/api/auth/logout" ? ok({ ok: true }) : { ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) },
    );
    const storage = installBrowser(fetchMock, new Map(), { userId: "user-a" });
    const store = await import("@/shared/storage/store");
    store.writeTable("debts", [{ id: "unsynced" }]);
    await expect(store.flushTablesNow()).resolves.toBe(false);
    await store.backgroundRefetchTables();
    await vi.waitFor(() => expect(window.location.replace).toHaveBeenCalledWith("/login?from=%2Fdebts"));
    expect(fetchMock.mock.calls.filter(([u]) => u === "/api/auth/logout")).toHaveLength(1);
    expect(window.location.replace).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.get("cairn:tables:v1:user-a") ?? "{}").dirty).toEqual(["debts"]);
  });

  it("does nothing without a signed-in cookie (local sandbox)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    installBrowser(fetchMock);
    const store = await import("@/shared/storage/store");
    await store.backgroundRefetchTables();
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/auth/logout")).toBe(false);
  });
});
