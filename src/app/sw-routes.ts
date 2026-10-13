/**
 * App routes pre-cached by the service worker so every page opens offline.
 * Kept as plain data (the worker must not bundle the nav config and its
 * icons); `sw-routes.test.ts` checks it matches the navigation.
 */
export const SHELL_ROUTES: readonly string[] = [
  "/",
  "/cashflow",
  "/cashflow/spending",
  "/cashflow/income",
  "/cashflow/history",
  "/wealth",
  "/wealth/debts",
  "/wealth/loans",
  "/goals",
  "/goals/funding",
  "/settings",
  "/settings/activity",
];

/** Client → worker message: cache any shell route missing from the offline cache. */
export const CACHE_SHELL_ROUTES_MESSAGE = "CACHE_SHELL_ROUTES";
