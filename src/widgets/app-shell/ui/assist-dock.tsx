"use client";

import { MessageSquareHeart, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FeedbackDialog } from "@/features/send-feedback";
import { useI18n } from "@/shared/i18n";
import { burstConfetti } from "@/shared/lib/celebrate";
import { cn } from "@/shared/lib/cn";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/ui/kit/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

import { useShell } from "../model/shell-context";
import { AiChatPanel } from "./ai-chat-panel";
import { useOnline } from "./offline-strip";

/** Scroll distance that hides (down) or brings back (up) the dock on phones. */
const SCROLL_HIDE_PX = 12;

/**
 * Hide while scrolling down through a page (the buttons never sit on top of
 * what you're reading), show again on any scroll up or near the top.
 */
function useHideOnScroll(disabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-app-scroll]");
    if (!el || disabled) return;
    last.current = el.scrollTop;
    const onScroll = () => {
      const y = el.scrollTop;
      const delta = y - last.current;
      if (Math.abs(delta) < SCROLL_HIDE_PX) return;
      setHidden(delta > 0 && y > 120 && y + el.clientHeight < el.scrollHeight - 24);
      last.current = y;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [disabled]);
  return hidden && !disabled;
}

/** Floating "Hỏi AI" and "Góp ý" buttons, above the bottom bar on phones. */
export function AssistDock() {
  const { t } = useI18n();
  const a = t.assist;
  const { authEnabled } = useShell();
  const online = useOnline();
  const [aiOpen, setAiOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const hidden = useHideOnScroll(aiOpen || feedbackOpen);
  const feedbackButton = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Popover open={aiOpen} onOpenChange={setAiOpen}>
        <PopoverAnchor asChild>
          <div
            role="group"
            aria-label={a.dockLabel}
            className={cn(
              "fixed right-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-2 transition-[transform,opacity] duration-300 ease-out md:right-6 md:bottom-6",
              hidden && "pointer-events-none translate-x-[calc(100%+1rem)] opacity-0",
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={feedbackButton}
                  type="button"
                  onClick={() => setFeedbackOpen(true)}
                  aria-label={a.feedback.button}
                  className="group flex size-11 items-center justify-center rounded-full border bg-card/90 text-muted-foreground shadow-md backdrop-blur-md transition-[color,transform,box-shadow] duration-200 outline-none hover:text-foreground hover:shadow-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95 motion-safe:animate-dock-in"
                >
                  <MessageSquareHeart className="size-5 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{a.feedback.button}</TooltipContent>
            </Tooltip>
            <button
              type="button"
              onClick={() => setAiOpen((o) => !o)}
              aria-expanded={aiOpen}
              aria-haspopup="dialog"
              className="group relative flex h-12 min-w-12 items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-br from-primary to-assist px-3.5 font-medium text-white shadow-lg shadow-primary/25 transition-[transform,box-shadow] duration-200 outline-none hover:shadow-xl hover:shadow-primary/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-95 motion-safe:animate-dock-in md:px-4"
              style={{ animationDelay: "80ms" }}
            >
              {/* A slow sheen across the button; decoration only. */}
              <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent motion-safe:animate-sheen" />
              <Sparkles className="relative size-5 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" aria-hidden />
              <span className="relative text-sm max-md:sr-only">{a.ai.button}</span>
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0 shadow-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
          aria-label={a.ai.title}
        >
          <AiChatPanel onClose={() => setAiOpen(false)} />
        </PopoverContent>
      </Popover>
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        canSend={authEnabled}
        online={online}
        // Thanks, with a little confetti from the button (after the sheet's exit animation).
        onSent={() => setTimeout(() => burstConfetti(feedbackButton.current, { count: 14, distance: 44 }), 250)}
      />
    </>
  );
}
