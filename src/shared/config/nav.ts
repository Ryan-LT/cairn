import {
  ArrowLeftRight,
  CalendarCheck,
  CreditCard,
  HandCoins,
  House,
  Landmark,
  PieChart,
  Plus,
  Receipt,
  Settings,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "@/shared/i18n";

export type HubId = keyof Messages["nav"]["hubs"];
export type TabId = keyof Messages["nav"]["tabs"];
export type QuickActionId = keyof Messages["nav"]["quickAdd"];

/** A tab inside a section; labels live in `t.nav.tabs[id]`. */
export type NavTab = { id: TabId; href: string; icon: LucideIcon };

/** A top-level section; labels live in `t.nav.hubs[id]`. Its first tab shares its href. */
export type NavHub = {
  id: HubId;
  href: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  mobileTab?: boolean;
  tabs?: NavTab[];
};

export const NAV_HUBS: NavHub[] = [
  { id: "home", href: "/", icon: House, mobileTab: true },
  {
    id: "cashflow",
    href: "/cashflow",
    icon: ArrowLeftRight,
    mobileTab: true,
    tabs: [
      { id: "cashflowMonth", href: "/cashflow", icon: CalendarCheck },
      { id: "cashflowSpending", href: "/cashflow/spending", icon: Receipt },
      { id: "cashflowIncome", href: "/cashflow/income", icon: TrendingUp },
    ],
  },
  {
    id: "wealth",
    href: "/wealth",
    icon: Landmark,
    mobileTab: true,
    tabs: [
      { id: "wealthAssets", href: "/wealth", icon: Landmark },
      { id: "wealthDebts", href: "/wealth/debts", icon: CreditCard },
      { id: "wealthLoans", href: "/wealth/loans", icon: HandCoins },
    ],
  },
  {
    id: "goals",
    href: "/goals",
    icon: Target,
    mobileTab: true,
    tabs: [
      { id: "goalsPlans", href: "/goals", icon: Target },
      { id: "goalsFunding", href: "/goals/funding", icon: PieChart },
    ],
  },
  { id: "settings", href: "/settings", icon: Settings },
];

/** Every page in the app (sections and tabs), in navigation order. */
export const ALL_ROUTES: string[] = [...new Set(NAV_HUBS.flatMap((h) => [h.href, ...(h.tabs ?? []).map((t) => t.href)]))];

/** Labels and search keywords live in `t.nav.quickAdd[id]`. */
export type QuickAction = { id: QuickActionId; href: string; icon: LucideIcon };

/** Create shortcuts: each page opens its sheet for `?new=1`. */
export const QUICK_ADD: QuickAction[] = [
  { id: "record", href: "/cashflow?new=1", icon: CalendarCheck },
  { id: "bill", href: "/cashflow/spending?new=1", icon: Receipt },
  { id: "income", href: "/cashflow/income?new=1", icon: TrendingUp },
  { id: "asset", href: "/wealth?new=1", icon: Landmark },
  { id: "debt", href: "/wealth/debts?new=1", icon: CreditCard },
  { id: "loan", href: "/wealth/loans?new=1", icon: HandCoins },
  { id: "plan", href: "/goals?new=1", icon: Target },
];

export const QUICK_ADD_ICON = Plus;

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The section (and tab, if any) a pathname belongs to. */
export function findNavMatch(pathname: string): { hub: NavHub; tab?: NavTab } | undefined {
  const hub = NAV_HUBS.find((h) => isNavActive(pathname, h.href));
  if (!hub) return undefined;
  // Exact tab first (the first tab shares the section href), then the longest prefix.
  const tab =
    hub.tabs?.find((t) => t.href === pathname) ??
    [...(hub.tabs ?? [])].sort((a, b) => b.href.length - a.href.length).find((t) => isNavActive(pathname, t.href));
  return { hub, tab };
}

export function hubOf(pathname: string): HubId | undefined {
  return findNavMatch(pathname)?.hub.id;
}
