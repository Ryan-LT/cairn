"use client";

import {
  CreditCard,
  EyeOff,
  HandCoins,
  Landmark,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  Sun,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";

import { useI18n } from "@/shared/i18n";
import { useSignOut } from "@/features/sign-out";
import { useSyncNow } from "@/features/sync-now";
import { DEBTS_SEED } from "@/entities/debt";
import { GOALS_SEED } from "@/entities/goal";
import { INCOME_SOURCES_SEED } from "@/entities/income";
import { PERSONAL_LOANS_SEED, type PersonalLoan } from "@/entities/personal-loan";
import { assetCategoryLabel, SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import { NAV_HUBS, QUICK_ADD } from "@/shared/config";
import { usePrivacyMode } from "@/shared/lib/privacy";
import { formatMoneyCompact } from "@/shared/lib/format";
import { useTable } from "@/shared/storage";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/shared/ui/kit/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/kit/dialog";

import { useOptimisticNavigation } from "../model/navigation";
import { useShell } from "../model/shell-context";

function Item({
  value,
  icon: Icon,
  onSelect,
  children,
  meta,
}: {
  value: string;
  icon: LucideIcon;
  onSelect: () => void;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <CommandItem value={value} onSelect={onSelect}>
      <Icon />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums" data-private>
          {meta}
        </span>
      ) : null}
    </CommandItem>
  );
}

/** ⌘K / Ctrl+K palette: navigate, quick-add, jump to records, and app actions. */
export function CommandMenu() {
  const { commandOpen: open, setCommandOpen: setOpen, authEnabled } = useShell();
  const { t } = useI18n();
  const m = t.shell.command;
  const { navigate } = useOptimisticNavigation();
  const { setTheme } = useTheme();
  const { syncNow } = useSyncNow();
  const { signOut } = useSignOut();
  const [hidden, togglePrivacy] = usePrivacyMode();

  const [assets] = useTable("settingsAssets", SETTINGS_ASSETS_SEED);
  const [sources] = useTable("incomeSources", INCOME_SOURCES_SEED);
  const [debts] = useTable("debts", DEBTS_SEED);
  const [loans] = useTable<PersonalLoan[]>("personalLoans", PERSONAL_LOANS_SEED);
  const [goals, setGoals] = useTable("goals", GOALS_SEED);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };
  const go = (href: string) => run(() => navigate(href));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="lg" showCloseButton={false} className="sm:top-[12%] sm:translate-y-0">
        <DialogTitle className="sr-only">{m.title}</DialogTitle>
        <DialogDescription className="sr-only">{m.description}</DialogDescription>
        <Command className="max-sm:pb-[env(safe-area-inset-bottom)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-item]]:py-2">
          <CommandInput placeholder={m.placeholder} />
          <CommandList className="max-h-[min(60vh,28rem)]">
            <CommandEmpty>{m.empty}</CommandEmpty>

            <CommandGroup heading={m.groups.goTo}>
              {NAV_HUBS.flatMap((hub) => {
                const hubLabel = t.nav.hubs[hub.id].label;
                const tabs = hub.tabs ?? [];
                return tabs.length
                  ? tabs.map((tab) => (
                      <Item
                        key={tab.href}
                        value={`${m.keywords.go} ${hub.id} ${tab.id} ${hubLabel} ${t.nav.tabs[tab.id].label} ${t.nav.tabs[tab.id].description}`}
                        icon={tab.icon}
                        onSelect={() => go(tab.href)}
                      >
                        <span className="text-muted-foreground">{hubLabel} ›</span> {t.nav.tabs[tab.id].label}
                      </Item>
                    ))
                  : [
                      <Item key={hub.href} value={`${m.keywords.go} ${hub.id} ${hubLabel} ${t.nav.hubs[hub.id].description}`} icon={hub.icon} onSelect={() => go(hub.href)}>
                        {hubLabel}
                      </Item>,
                    ];
              })}
            </CommandGroup>

            <CommandGroup heading={m.groups.quickActions}>
              {QUICK_ADD.map((a) => (
                <Item key={a.href} value={`${t.nav.quickAdd[a.id].label} ${t.nav.quickAdd[a.id].keywords}`} icon={a.icon} onSelect={() => go(a.href)}>
                  {t.nav.quickAdd[a.id].label}
                </Item>
              ))}
            </CommandGroup>

            {goals.profiles.length ? (
              <CommandGroup heading={m.groups.goalPlans}>
                {goals.profiles.map((p) => (
                  <Item
                    key={p.id}
                    value={`${m.keywords.plan} ${p.name} ${p.id}`}
                    icon={Target}
                    meta={formatMoneyCompact(p.targetAmount)}
                    onSelect={() =>
                      run(() => {
                        setGoals((g) => ({ ...g, activeProfileId: p.id }));
                        navigate("/goals");
                      })
                    }
                  >
                    {p.name.trim() || t.common.untitledPlan}
                  </Item>
                ))}
              </CommandGroup>
            ) : null}

            {assets.length ? (
              <CommandGroup heading={m.groups.assets}>
                {assets.map((a) => (
                  <Item
                    key={a.id}
                    value={`${m.keywords.asset} ${a.name} ${a.category} ${assetCategoryLabel(a.category)} ${a.id}`}
                    icon={Landmark}
                    meta={formatMoneyCompact(a.currentValue)}
                    onSelect={() => go(`/wealth?edit=${encodeURIComponent(a.id)}`)}
                  >
                    {a.name}
                  </Item>
                ))}
              </CommandGroup>
            ) : null}

            {sources.length ? (
              <CommandGroup heading={m.groups.incomeSources}>
                {sources.map((s) => (
                  <Item
                    key={s.id}
                    value={`${m.keywords.income} ${s.name} ${s.details} ${s.id}`}
                    icon={TrendingUp}
                    meta={m.perMonth({ amount: formatMoneyCompact(s.monthly) })}
                    onSelect={() => go(`/cashflow/income?edit=${encodeURIComponent(s.id)}`)}
                  >
                    {s.name}
                  </Item>
                ))}
              </CommandGroup>
            ) : null}

            {debts.length ? (
              <CommandGroup heading={m.groups.debts}>
                {debts.map((d) => (
                  <Item
                    key={d.id}
                    value={`${m.keywords.debt} ${d.name} ${d.id}`}
                    icon={CreditCard}
                    meta={formatMoneyCompact(d.balance)}
                    onSelect={() => go(`/wealth/debts?edit=${encodeURIComponent(d.id)}`)}
                  >
                    {d.name}
                  </Item>
                ))}
              </CommandGroup>
            ) : null}

            {loans.length ? (
              <CommandGroup heading={m.groups.personalLoans}>
                {loans.map((l) => (
                  <Item
                    key={l.id}
                    value={`${m.keywords.loan} ${l.person} ${l.note ?? ""} ${l.id}`}
                    icon={HandCoins}
                    meta={`${l.direction === "lent_out" ? m.owedToYou : m.youOwe} · ${formatMoneyCompact(l.amount)}`}
                    onSelect={() => go(`/wealth/loans?edit=${encodeURIComponent(l.id)}`)}
                  >
                    {l.person}
                  </Item>
                ))}
              </CommandGroup>
            ) : null}

            <CommandSeparator />
            <CommandGroup heading={m.groups.preferences}>
              <Item value={m.keywords.themeLight} icon={Sun} onSelect={() => run(() => setTheme("light"))}>
                {m.lightTheme}
              </Item>
              <Item value={m.keywords.themeDark} icon={Moon} onSelect={() => run(() => setTheme("dark"))}>
                {m.darkTheme}
              </Item>
              <Item value={m.keywords.themeSystem} icon={Monitor} onSelect={() => run(() => setTheme("system"))}>
                {m.systemTheme}
              </Item>
              <Item value={m.keywords.privacy} icon={EyeOff} onSelect={() => run(togglePrivacy)}>
                {hidden ? t.common.privacy.show : t.common.privacy.hide}
              </Item>
              <Item value={m.keywords.sync} icon={RefreshCw} onSelect={() => run(() => void syncNow())}>
                {m.syncNow}
              </Item>
              {authEnabled ? (
                <Item value={m.keywords.signOut} icon={LogOut} onSelect={() => run(() => void signOut())}>
                  {m.signOut}
                </Item>
              ) : null}
            </CommandGroup>
          </CommandList>
          <div className="hidden items-center justify-end gap-3 border-t px-3 py-2 text-xs text-muted-foreground sm:flex">
            <span>
              {m.hints.navigate} <CommandShortcut className="ml-1">↑↓</CommandShortcut>
            </span>
            <span>
              {m.hints.open} <CommandShortcut className="ml-1">↵</CommandShortcut>
            </span>
            <span>
              {m.hints.toggle} <CommandShortcut className="ml-1">⌘K</CommandShortcut>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
