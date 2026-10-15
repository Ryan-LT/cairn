"use client";

import { Copy, Link2, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { copyShareLink, ShareReportDialog, type ShareLink } from "@/features/share-report";
import { apiErrorText, useI18n } from "@/shared/i18n";
import { formatDate } from "@/shared/lib/format";
import { Callout } from "@/shared/ui/callout";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Button } from "@/shared/ui/kit/button";
import { Section } from "@/shared/ui/section";
import { StatusBadge } from "@/shared/ui/status-badge";

import { sendJson, useShareLinks } from "../model/use-connect-data";

const month = (m: string) => formatDate(`${m}-01`, "monthYear");

/** The account's report links: what each shows, views, expiry; copy or remove. */
export function SharesSection({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const s = t.connect.share;
  const { status, data, setData } = useShareLinks();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<ShareLink | null>(null);
  const [now] = useState(() => Date.now());

  if (!enabled || status === "unavailable") {
    return (
      <Section icon={Share2} tone="violet" title={s.title} description={s.description} help="connectShares">
        <Callout>{s.unavailable}</Callout>
      </Section>
    );
  }

  return (
    <Section
      icon={Share2}
      tone="violet"
      title={s.title}
      description={s.description}
      help="connectShares"
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Link2 />
          {s.create}
        </Button>
      }
    >
      {status === "loading" ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : status === "error" ? (
        <p className="text-sm text-destructive">{t.errors.unavailable}</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{s.empty}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.map((link) => {
            const expired = link.expiresAt !== null && Date.parse(link.expiresAt) <= now;
            return (
              <li key={link.id} className="grid gap-2 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-sm font-medium">{link.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {link.period.all ? s.allTime : s.range({ from: month(link.period.from), to: month(link.period.to) })} · {formatDate(link.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="outline" size="sm" onClick={() => void copyShareLink(link.id, s.linkCopied)} disabled={expired}>
                      <Copy />
                      {s.copyLink}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => setRemoving(link)} aria-label={s.remove}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {link.sections.map((sec) => (
                    <StatusBadge key={sec}>{s.sections[sec]}</StatusBadge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {expired ? (
                    <StatusBadge tone="warning" dot>
                      {s.expired}
                    </StatusBadge>
                  ) : link.expiresAt ? (
                    s.expires({ date: formatDate(link.expiresAt) })
                  ) : (
                    s.neverExpires
                  )}
                  {" · "}
                  {link.viewCount > 0 ? s.views({ count: link.viewCount }) : s.noViews}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <ShareReportDialog open={creating} onOpenChange={setCreating} onCreated={(share) => setData((d) => [share, ...d])} />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={s.removeTitle}
        description={s.removeBody}
        confirmLabel={s.remove}
        onConfirm={async () => {
          if (!removing) return;
          const res = await sendJson(`/api/shares?id=${encodeURIComponent(removing.id)}`, "DELETE").catch(() => null);
          if (res?.ok || res?.status === 404) {
            setData((d) => d.filter((x) => x.id !== removing.id));
            toast.success(s.removed);
          } else toast.error(res ? (await apiErrorText(t, res)).message : t.common.networkError);
          setRemoving(null);
        }}
      />
    </Section>
  );
}
