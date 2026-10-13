"use client";

import { ChevronsUpDown } from "lucide-react";

import { useI18n } from "@/shared/i18n";
import { DropdownMenu, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/shared/ui/kit/sidebar";

import { useShell } from "../model/shell-context";
import { AccountMenuContent, UserAvatar } from "./account-menu";

/** Sidebar footer: the signed-in person, opening the account menu. */
export function NavUser() {
  const { userName, authEnabled } = useShell();
  const { t } = useI18n();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <UserAvatar />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userName}</span>
                <span className="truncate text-xs text-muted-foreground">{authEnabled ? t.shell.user.signedIn : t.shell.user.localMode}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <AccountMenuContent side={isMobile ? "top" : "right"} onNavigate={() => setOpenMobile(false)} />
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
