"use client";

import { Bug, Heart, Lightbulb, MessageCircle, Star, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, type FeedbackKind } from "@/shared/config";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/format";
import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { Callout } from "@/shared/ui/callout";
import { Button } from "@/shared/ui/kit/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Label } from "@/shared/ui/kit/label";
import { Textarea } from "@/shared/ui/kit/textarea";

const KIND_ICONS: Record<FeedbackKind, LucideIcon> = { idea: Lightbulb, bug: Bug, praise: Heart, other: MessageCircle };

type SendResult = "ok" | "rate_limited" | "sign_in" | "failed";

async function sendFeedback(body: { kind: FeedbackKind; message: string; rating: number | null; page: string; locale: string }): Promise<SendResult> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, viewport: `${window.innerWidth}x${window.innerHeight}` }),
    });
    if (res.ok) return "ok";
    if (res.status === 429) return "rate_limited";
    if (res.status === 401 || res.status === 503) return "sign_in";
    return "failed";
  } catch {
    return "failed";
  }
}

/** The "Góp ý" sheet: what it's about, an optional rating and a message, stored server-side. */
export function FeedbackDialog({ open, onOpenChange, canSend, online }: { open: boolean; onOpenChange: (open: boolean) => void; canSend: boolean; online: boolean }) {
  const { t, locale } = useI18n();
  const f = t.assist.feedback;
  const pathname = useAppPathname();
  const [kind, setKind] = useState<FeedbackKind>("idea");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messageId = useId();
  const trimmed = message.trim();

  const reset = () => {
    setKind("idea");
    setRating(null);
    setMessage("");
  };

  const submit = async () => {
    if (!trimmed || sending) return;
    setSending(true);
    const result = await sendFeedback({ kind, message: trimmed, rating, page: pathname, locale });
    setSending(false);
    if (result === "ok") {
      toast.success(f.sent, { description: f.sentDetail });
      reset();
      onOpenChange(false);
    } else {
      toast.error(result === "rate_limited" ? f.rateLimited : result === "sign_in" ? f.signInNeeded : f.failed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{f.title}</DialogTitle>
          <DialogDescription>{f.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          {!canSend ? <Callout tone="warning">{f.signInNeeded}</Callout> : !online ? <Callout tone="warning">{f.offline}</Callout> : null}

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{f.kindLabel}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FEEDBACK_KINDS.map((k) => {
                const Icon = KIND_ICONS[k];
                const active = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-[background-color,border-color,transform] duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97]",
                      active ? "border-primary bg-primary-soft text-primary" : "hover:bg-accent",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0 transition-transform duration-300", active && "motion-safe:scale-110")} aria-hidden />
                    {f.kinds[k]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{f.ratingLabel}</legend>
            <div className="flex gap-1" role="radiogroup" aria-label={f.ratingLabel}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = rating !== null && n <= rating;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={f.rating({ count: n })}
                    onClick={() => setRating(rating === n ? null : n)}
                    className="flex size-11 items-center justify-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <Star
                      className={cn(
                        "size-6 transition-[color,fill,transform] duration-200",
                        on ? "fill-capstone text-capstone motion-safe:scale-110" : "text-muted-foreground/50",
                      )}
                      style={on ? { transitionDelay: `${(n - 1) * 30}ms` } : undefined}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor={messageId}>{f.messageLabel}</Label>
              <span className="text-xs text-muted-foreground tabular-nums" aria-hidden>
                {f.counter({ used: formatNumber(message.length), max: formatNumber(FEEDBACK_MAX_LENGTH) })}
              </span>
            </div>
            <Textarea
              id={messageId}
              value={message}
              maxLength={FEEDBACK_MAX_LENGTH}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={f.placeholder[kind]}
              className="min-h-28"
            />
            <p className="text-xs text-muted-foreground">{f.context}</p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={() => void submit()} disabled={!trimmed || sending || !canSend || !online}>
            {sending ? f.sending : f.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
