import { describe, expect, it } from "vitest";

import { SHELL_ROUTES } from "@/app/sw-routes";
import { ALL_ROUTES, findNavMatch, hubOf, NAV_HUBS, QUICK_ADD } from "@/shared/config/nav";

describe("service worker shell routes", () => {
  it("pre-caches every section and tab", () => {
    for (const hub of NAV_HUBS) {
      expect(SHELL_ROUTES).toContain(hub.href);
      for (const tab of hub.tabs ?? []) expect(SHELL_ROUTES).toContain(tab.href);
    }
    expect([...SHELL_ROUTES].sort()).toEqual([...ALL_ROUTES].sort());
  });

  it("every quick action opens a known page", () => {
    for (const a of QUICK_ADD) expect(SHELL_ROUTES).toContain(a.href.split("?")[0]);
  });
});

describe("nav matching", () => {
  it("finds the section and tab of a path", () => {
    expect(findNavMatch("/")?.hub.id).toBe("home");
    expect(findNavMatch("/cashflow")?.tab?.id).toBe("cashflowMonth");
    expect(findNavMatch("/cashflow/spending")?.tab?.id).toBe("cashflowSpending");
    expect(findNavMatch("/wealth/debts")).toMatchObject({ hub: { id: "wealth" }, tab: { id: "wealthDebts" } });
    expect(findNavMatch("/goals/funding")?.tab?.id).toBe("goalsFunding");
    expect(hubOf("/settings")).toBe("settings");
    expect(findNavMatch("/settings/activity")?.tab?.id).toBe("settingsActivity");
    expect(hubOf("/income")).toBeUndefined();
  });
});
