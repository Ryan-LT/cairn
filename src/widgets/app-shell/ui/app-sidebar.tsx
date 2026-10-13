"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

import { useI18n } from "@/shared/i18n";
import { toneColors } from "@/shared/lib/tone";
import { BRAND, findNavMatch, isNavActive, NAV_HUBS } from "@/shared/config";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/shared/ui/kit/sidebar";
import { Logo } from "@/shared/ui/logo";

import { useOptimisticNavigation } from "../model/navigation";
import { NavUser } from "./nav-user";

const ACTIVE_CLASS =
  "data-[active=true]:bg-primary-soft data-[active=true]:text-primary-soft-foreground data-[active=true]:[&>svg]:text-primary-soft-foreground";

export function AppSidebar() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { t } = useI18n();
  // Highlights the destination immediately while the route renders.
  const { activePath, onLinkClick } = useOptimisticNavigation();

  const navigate = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isMobile) setOpenMobile(false);
    onLinkClick(event, href);
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={BRAND.name}>
              <Link href="/" onClick={(e) => navigate(e, "/")}>
                <Logo size={32} decorative className="size-8!" />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-base font-semibold tracking-tight">{BRAND.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{t.common.brandDescriptor}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_HUBS.map((hub) => {
                const active = isNavActive(activePath, hub.href);
                const tab = active ? findNavMatch(activePath)?.tab : undefined;
                return (
                  <SidebarMenuItem key={hub.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active && !hub.tabs}
                      tooltip={t.nav.hubs[hub.id].label}
                      className={ACTIVE_CLASS}
                    >
                      <Link href={hub.href} onClick={(e) => navigate(e, hub.href)} className={active ? "font-semibold" : undefined}>
                        <hub.icon style={{ color: toneColors(hub.tone).color }} />
                        <span>{t.nav.hubs[hub.id].label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {hub.tabs ? (
                      <SidebarMenuSub>
                        {hub.tabs.map((item) => (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton asChild isActive={tab?.id === item.id} className={ACTIVE_CLASS}>
                              <Link href={item.href} onClick={(e) => navigate(e, item.href)}>
                                <span>{t.nav.tabs[item.id].label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
