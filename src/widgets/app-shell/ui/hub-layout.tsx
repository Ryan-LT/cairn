"use client";

import { createContext, useContext, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { findNavMatch, NAV_HUBS, type HubId } from "@/shared/config";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { IconTile } from "@/shared/ui/icon-tile";
import { TabLinks } from "@/shared/ui/tab-links";

import { useOptimisticNavigation } from "../model/navigation";

/** Desktop: where a tab's main actions go (the right end of the sticky tab bar). */
const HubActionsSlot = createContext<HTMLElement | null>(null);

type HubFrameProps = {
  hub: HubId;
  /** Path whose tab is highlighted (optimistic while a tab change renders). */
  activePath: string;
  onNavigate?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
  /** Section-level figures shown above the tabs. */
  summary?: ReactNode;
  /** Loading placeholder: no skip-link target, marked busy. */
  skeleton?: boolean;
  children: ReactNode;
};

/**
 * A section page: title (desktop), an optional summary, the section's tabs
 * (sticky while scrolling), then the tab's content. Data-free, so it also
 * frames the loading skeleton and the tabs stay usable while data loads.
 */
export function HubFrame({ hub, activePath, onNavigate, summary, skeleton, children }: HubFrameProps) {
  const { t } = useI18n();
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const nav = NAV_HUBS.find((h) => h.id === hub);
  const match = findNavMatch(activePath);
  const activeTab = match?.hub.id === hub ? match.tab : undefined;
  const tabs = (nav?.tabs ?? []).map((tab) => ({
    href: tab.href,
    label: t.nav.tabs[tab.id].label,
    active: tab.id === activeTab?.id,
  }));

  return (
    <div
      id={skeleton ? undefined : "main-content"}
      aria-busy={skeleton || undefined}
      className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 pt-3 pb-6 md:gap-5 md:px-6 md:pt-6"
    >
      <header className="flex items-center gap-3 max-md:sr-only">
        {nav ? <IconTile icon={nav.icon} tone={nav.tone} size="lg" className="motion-safe:animate-check-pop" /> : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t.nav.hubs[hub].label}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{activeTab ? t.nav.tabs[activeTab.id].description : t.nav.hubs[hub].description}</p>
        </div>
      </header>
      {summary}
      {tabs.length > 1 ? (
        <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 bg-background/90 px-4 py-2 backdrop-blur-md md:-mx-6 md:px-6">
          <TabLinks tabs={tabs} label={t.shell.sectionTabs} onNavigate={onNavigate} className="min-w-0" />
          {/* Desktop: the tab's actions (Add, Export…) sit here, so they stay at hand while scrolling. */}
          <div ref={setActionsSlot} className="ml-auto hidden shrink-0 items-center gap-2 md:flex" />
        </div>
      ) : null}
      <HubActionsSlot.Provider value={actionsSlot}>{children}</HubActionsSlot.Provider>
    </div>
  );
}

/** Route layout for a section with tabs (`app/[lang]/(shell)/<hub>/layout.tsx`). */
export function HubLayout({ hub, summary, children }: { hub: HubId; summary?: ReactNode; children: ReactNode }) {
  const { activePath, onLinkClick } = useOptimisticNavigation();
  return (
    <HubFrame hub={hub} activePath={activePath} onNavigate={onLinkClick} summary={summary}>
      {children}
    </HubFrame>
  );
}

/** Body of a tab inside a section: vertical rhythm only (the section owns gutters). */
export function TabContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("stagger-in flex min-w-0 flex-col gap-5 md:gap-6", className)}>{children}</div>;
}

/**
 * A tab's first row: context on the left (month, search), its main actions on
 * the right. Inside a section with tabs, desktop shows the actions in the tab
 * bar instead, and a toolbar with nothing on the left takes no row at all;
 * phones keep the row, with the buttons filling it.
 */
export function TabToolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  const slot = useContext(HubActionsSlot);
  const hasContext = children !== undefined && children !== null && children !== false;
  if (slot && actions) {
    return (
      <>
        {createPortal(actions, slot)}
        <div className={cn("flex flex-wrap items-center justify-between gap-3", !hasContext && "md:hidden", className)}>
          {hasContext ? <div className="min-w-0 flex-1">{children}</div> : null}
          <div className={cn("flex shrink-0 flex-wrap items-center gap-2 md:hidden", !hasContext && "w-full [&>*:last-child]:flex-1")}>{actions}</div>
        </div>
      </>
    );
  }
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
