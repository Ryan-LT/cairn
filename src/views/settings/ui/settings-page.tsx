"use client";

import { Download, LogOut, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { PREFERENCES_SEED } from "@/entities/preferences";
import { useSignOut } from "@/features/sign-out";
import { useSyncNow } from "@/features/sync-now";
import { LanguageSwitcher } from "@/features/switch-language";
import { BRAND } from "@/shared/config";
import { useI18n } from "@/shared/i18n";
import { formatRelative, formatTime } from "@/shared/lib/format";
import { useLastSyncedAt, useTable } from "@/shared/storage";
import { DescriptionList } from "@/shared/ui/description-list";
import { Button } from "@/shared/ui/kit/button";
import { Label } from "@/shared/ui/kit/label";
import { Switch } from "@/shared/ui/kit/switch";
import { PageHeader } from "@/shared/ui/page-header";
import { Section } from "@/shared/ui/section";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { StatusBadge } from "@/shared/ui/status-badge";
import { PageContainer, useOnline, useShell } from "@/widgets/app-shell";

import { downloadBackup } from "../lib/export-backup";
import { ChangePasswordForm } from "./change-password-form";
import { MilestoneForm } from "./milestone-form";

type ThemeValue = "light" | "dark" | "system";

export function SettingsPage() {
  const { t, locale } = useI18n();
  const s = t.settings;
  const themes: { value: ThemeValue; label: string }[] = [
    { value: "light", label: t.common.themeLight },
    { value: "dark", label: t.common.themeDark },
    { value: "system", label: t.common.themeSystem },
  ];
  const { theme, setTheme } = useTheme();
  const { userName, authEnabled } = useShell();
  const online = useOnline();
  const lastSyncedAt = useLastSyncedAt();
  const { syncNow, syncing } = useSyncNow();
  const { signOut, pending } = useSignOut();
  const [prefs, setPrefs] = useTable("preferences", PREFERENCES_SEED);

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title={t.nav.hubs.settings.label} description={s.description} />

      <div id="milestone" className="scroll-mt-20">
        <Section title={s.milestone.title} description={s.milestone.description}>
          <MilestoneForm
            value={prefs.milestone}
            onSave={(milestone) => {
              setPrefs((p) => ({ ...p, milestone }));
              toast.success(s.milestone.saved);
            }}
          />
        </Section>
      </div>

      <div id="calculation" className="scroll-mt-20">
        <Section title={s.calculation.title} description={s.calculation.description}>
          <div className="flex items-start justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor="loans-in-net-worth">{t.loans.netWorth.label}</Label>
              <p className="text-sm text-muted-foreground">{t.loans.netWorth.description}</p>
            </div>
            <Switch
              id="loans-in-net-worth"
              checked={prefs.includeLoansInNetWorth === true}
              onCheckedChange={(on) => {
                setPrefs((p) => ({ ...p, includeLoansInNetWorth: on }));
                toast.success(on ? t.loans.netWorth.on : t.loans.netWorth.off);
              }}
            />
          </div>
        </Section>
      </div>

      <Section title={s.appearance.title} description={s.appearance.description({ brand: BRAND.name })}>
        <SegmentedControl<ThemeValue>
          aria-label={t.common.theme}
          value={(theme as ThemeValue) ?? "system"}
          onValueChange={setTheme}
          options={themes}
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-4">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-medium">{t.common.language}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{s.appearance.languageHint}</p>
          </div>
          <LanguageSwitcher ariaLabel={t.common.language} />
        </div>
      </Section>

      <Section
        title={s.data.title}
        description={s.data.description}
        actions={
          <Button variant="outline" size="sm" onClick={() => void syncNow()} disabled={syncing || !online}>
            <RefreshCw className={syncing ? "animate-spin" : undefined} />
            {s.data.syncNow}
          </Button>
        }
      >
        <DescriptionList
          items={[
            {
              label: s.data.connection,
              value: online ? <StatusBadge tone="success" dot>{t.common.online}</StatusBadge> : <StatusBadge tone="warning" dot>{t.common.offline}</StatusBadge>,
            },
            {
              label: s.data.lastSynced,
              value: lastSyncedAt ? (
                <span title={new Date(lastSyncedAt).toLocaleString(locale)}>
                  {formatRelative(lastSyncedAt)} · {formatTime(lastSyncedAt)}
                </span>
              ) : (
                s.data.notYet
              ),
            },
            {
              label: s.data.backup,
              hint: s.data.backupHint,
              value: (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    downloadBackup();
                    toast.success(s.data.backupDownloaded);
                  }}
                >
                  <Download />
                  {s.data.exportJson}
                </Button>
              ),
            },
          ]}
        />
      </Section>

      {authEnabled ? (
        <Section title={s.password.title} description={s.password.description}>
          <ChangePasswordForm />
        </Section>
      ) : null}

      <Section title={s.session.title}>
        <DescriptionList
          items={[
            { label: s.session.signedInAs, value: userName },
            {
              label: s.session.login,
              value: authEnabled ? <StatusBadge tone="success" dot>{s.session.enabled}</StatusBadge> : <StatusBadge dot>{s.session.disabled}</StatusBadge>,
              hint: authEnabled ? undefined : s.session.disabledHint,
            },
          ]}
        />
        {authEnabled ? (
          <Button variant="outline" className="mt-4" onClick={() => void signOut()} disabled={pending}>
            <LogOut />
            {s.session.signOut}
          </Button>
        ) : null}
      </Section>

    </PageContainer>
  );
}
