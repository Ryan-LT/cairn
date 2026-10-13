"use client";

import { SendHorizontal, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/kit/button";

type Message = { id: number; from: "ai" | "me"; text: string };

/** Pause before the assistant "answers" (none under reduced motion). */
const TYPING_MS = 650;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function TypingDots({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-full bg-muted-foreground/60 motion-safe:animate-typing-dot" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

/**
 * The AI assistant's chat bubble. The assistant isn't built yet: it says so,
 * shows the kind of questions it will answer, and replies to a tapped example
 * with a friendly "coming soon". Nothing is sent anywhere.
 */
export function AiChatPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const ai = t.assist.ai;
  const [messages, setMessages] = useState<Message[]>([]);
  // Opens "typing" while the greeting arrives.
  const [typing, setTyping] = useState(true);
  const [asked, setAsked] = useState<string[]>([]);
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const say = (from: Message["from"], text: string) => setMessages((m) => [...m, { id: nextId.current++, from, text }]);

  /** Assistant lines appear one after another, as if typed (call with `typing` already on). */
  const typeOut = (lines: string[]) => {
    const wait = prefersReducedMotion() ? 0 : TYPING_MS;
    lines.forEach((line, i) => {
      timers.current.push(
        setTimeout(() => {
          say("ai", line);
          if (i === lines.length - 1) setTyping(false);
        }, wait * (i + 1)),
      );
    });
  };

  useEffect(() => {
    typeOut([ai.greeting, ai.underDevelopment]);
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
    // Greets once per opening; the copy follows the language at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [messages, typing]);

  const ask = (q: string) => {
    if (typing) return;
    setAsked((a) => [...a, q]);
    say("me", q);
    setTyping(true);
    typeOut([ai.reply]);
  };

  const suggestions = ai.suggestions.filter((q) => !asked.includes(q));

  return (
    <div className="flex max-h-[min(32rem,calc(100dvh-10rem))] flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-assist text-white shadow-sm">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{ai.title}</p>
          <p className="text-xs text-muted-foreground">{ai.badge}</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label={ai.close}>
          <X />
        </Button>
      </header>

      <div ref={scroller} className="flex min-h-40 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.map((m) => (
          <p
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed motion-safe:animate-bubble-in",
              m.from === "ai" ? "self-start rounded-bl-md bg-muted" : "self-end rounded-br-md bg-primary text-primary-foreground",
            )}
          >
            {m.text}
          </p>
        ))}
        {typing ? <TypingDots label={ai.typing} /> : null}
        {!typing && suggestions.length ? (
          <div className="mt-2 grid gap-1.5 motion-safe:animate-bubble-in">
            <p className="text-xs font-medium text-muted-foreground">{ai.tryLabel}</p>
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => ask(q)}
                className="w-fit max-w-full rounded-full border px-3 py-1.5 text-left text-sm transition-colors outline-none hover:border-primary hover:bg-primary-soft focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {q}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <form className="flex items-center gap-2 border-t px-3 py-3" onSubmit={(e) => e.preventDefault()}>
        <input
          disabled
          aria-label={ai.inputPlaceholder}
          placeholder={ai.inputPlaceholder}
          className="h-10 min-w-0 flex-1 rounded-full border bg-muted/50 px-4 text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full" disabled aria-label={ai.send}>
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}
