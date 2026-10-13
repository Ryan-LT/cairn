"use client";

import { EyeOff, Languages, LogOut, Palette, Settings } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import { useSignOut } from "@/features/sign-out";
import { LANGUAGE_OPTIONS, useSwitchLanguage } from "@/features/switch-language";
import { useI18n, type Locale } from "@/shared/i18n";
import { getDisplayNameInitials } from "@/shared/lib/cn";
import { usePrivacyMode } from "@/shared/lib/privacy";
import { Avatar, AvatarFallback } from "@/shared/ui/kit/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSegmentItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/kit/dropdown-menu";
import { Switch } from "@/shared/ui/kit/switch";

import { useShell } from "../model/shell-context";
import { THEME_OPTIONS } from "./theme-toggle";

export function UserAvatar({ size = "md" }: { size?: "sm" | "md" }) {
  const { userName } = useShell();
  const initials = getDisplayNameInitials(userName) || "WT";
  return (
    <Avatar className={size === "sm" ? "size-8 rounded-full" : "size-8 rounded-md"}>
      <AvatarFallback className="rounded-[inherit] bg-primary-soft text-xs font-semibold text-primary-soft-foreground">{initials}</AvatarFallback>
    </Avatar>
  );
}

/**
 * The account menu body: who's signed in, inline theme / language / privacy
 * controls (they apply instantly, the menu stays open), Settings, Sign out.
 */
export function AccountMenuContent({ side, align = "end", onNavigate }: { side: "top" | "right" | "bottom"; align?: "start" | "end"; onNavigate?: () => void }) {
  const { userName, authEnabled } = useShell();
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { signOut, pending } = useSignOut();
  const { locale, switchTo } = useSwitchLanguage();
  const [hidden, togglePrivacy] = usePrivacyMode();

  return (
    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-64 p-1.5" side={side} align={align} sideOffset={6}>
      <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2 font-normal">
        <UserAvatar />
        <div className="grid min-w-0 leading-tight">
          <span className="truncate text-sm font-semibold">{userName}</span>
          <span className="truncate text-xs text-muted-foreground">{authEnabled ? t.shell.user.workspace : t.shell.user.localMode}</span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />

      <div className="grid gap-0.5 py-1">
        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <span className="flex items-center gap-2 text-sm">
            <Palette className="size-4 text-muted-foreground" aria-hidden />
            {t.common.theme}
          </span>
          <DropdownMenuRadioGroup
            value={theme ?? "system"}
            onValueChange={setTheme}
            aria-label={t.common.theme}
            className="inline-flex gap-0.5 rounded-md border bg-muted/60 p-0.5"
          >
            {THEME_OPTIONS.map((o) => (
              <DropdownMenuSegmentItem key={o.value} value={o.value} aria-label={t.common[o.labelKey]} title={t.common[o.labelKey]}>
                <o.icon />
              </DropdownMenuSegmentItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
        <div className="flex items-center justify-between gap-3 px-2 py-1">
          <span className="flex items-center gap-2 text-sm">
            <Languages className="size-4 text-muted-foreground" aria-hidden />
            {t.common.language}
          </span>
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(v) => void switchTo(v as Locale)}
            aria-label={t.common.language}
            className="inline-flex gap-0.5 rounded-md border bg-muted/60 p-0.5"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <DropdownMenuSegmentItem key={o.value} value={o.value} lang={o.value} aria-label={o.label} title={o.label} className="min-w-9">
                {o.short}
              </DropdownMenuSegmentItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-3 px-2 py-1.5">
          <span className="flex items-center gap-2 text-sm">
            <EyeOff className="size-4 text-muted-foreground" aria-hidden />
            {t.common.privacy.hide}
          </span>
          <Switch checked={hidden} onCheckedChange={togglePrivacy} aria-label={t.common.privacy.hide} />
        </label>
      </div>

      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/settings" onClick={onNavigate}>
          <Settings />
          {t.nav.hubs.settings.label}
        </Link>
      </DropdownMenuItem>
      {authEnabled ? (
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => void signOut()}>
          <LogOut />
          {t.shell.user.signOut}
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
  );
}

/** Phones: the avatar in the top bar opens the account menu (Settings lives here). */
export function AccountMenuButton() {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t.shell.account} className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
          <UserAvatar size="sm" />
        </button>
      </DropdownMenuTrigger>
      <AccountMenuContent side="bottom" />
    </DropdownMenu>
  );
}
