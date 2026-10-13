"use client";

import { ArrowLeft, ArrowRight, CircleHelp, Footprints, Lightbulb, X } from "lucide-react";
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { helpPageOf, isHelpTopic, type HelpTopic } from "@/shared/config/help";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { useAppPathname } from "@/shared/lib/use-app-pathname";
import { Button } from "@/shared/ui/kit/button";

import { boxOf, findTargets, onScreen, placeCard, reveal, sameBox, type Box } from "../lib/targets";
import { explain, markHelpSeen, useExplainState } from "../model/store";
import { startPageTour } from "../model/tour";

/** Runs `cb` every animation frame while mounted (positions follow scrolling, resizing and layout changes). */
function useEveryFrame(cb: () => void) {
  const latest = useRef(cb);
  useLayoutEffect(() => {
    latest.current = cb;
  });
  useEffect(() => {
    let id = requestAnimationFrame(function tick() {
      latest.current();
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * The help overlay: "explain this screen" markers or the guided tour, plus the
 * `?` shortcut. Mounted once in the app shell.
 */
export function ExplainLayer() {
  const s = useExplainState();
  const pathname = useAppPathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !isTyping(e.target) && !document.querySelector('[role="dialog"][data-state="open"]')) {
        e.preventDefault();
        markHelpSeen();
        explain.toggleExplain();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A tour belongs to its page; explain mode carries on to the next page.
  useEffect(() => {
    const now = explain.get();
    if (now.mode === "tour" && now.route !== pathname) explain.stop();
  }, [pathname]);

  if (s.mode === "off" || typeof document === "undefined") return null;
  return createPortal(
    s.mode === "explain" ? <ExplainMode selected={s.selected} /> : <TourMode steps={s.steps} index={s.index} />,
    document.body,
  );
}

type Tracked = { topic: HelpTopic; box: Box };

function useTrackedTargets(): Tracked[] {
  const [targets, setTargets] = useState<Tracked[]>([]);
  useEveryFrame(() => {
    const next = findTargets()
      .filter((x) => isHelpTopic(x.topic))
      .map((x) => ({ topic: x.topic as HelpTopic, box: boxOf(x.el, 4) }));
    setTargets((prev) => (prev.length === next.length && prev.every((p, i) => p.topic === next[i].topic && sameBox(p.box, next[i].box)) ? prev : next));
  });
  return targets;
}

/** Card size for placement: measured after the first render. */
function useMeasured<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 352, h: 200 });
  useEveryFrame(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  });
  return [ref, size] as const;
}

function ExplainMode({ selected }: { selected: string | null }) {
  const { t } = useI18n();
  const u = t.help.ui;
  const targets = useTrackedTargets();
  const current = targets.find((x) => x.topic === selected) ?? null;

  // While explaining, a tap on a block explains it instead of acting on it.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest || el.closest("[data-explain-ui]")) return;
      const block = el.closest<HTMLElement>("main [data-help]");
      if (!block?.dataset.help || !isHelpTopic(block.dataset.help)) return;
      e.preventDefault();
      e.stopPropagation();
      explain.select(block.dataset.help);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const move = (delta: number) => {
    const all = findTargets().filter((x) => isHelpTopic(x.topic));
    if (!all.length) return;
    const at = all.findIndex((x) => x.topic === selected);
    const next = all[(at + delta + all.length) % all.length];
    reveal(next.el);
    explain.select(next.topic);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (explain.get().mode === "explain" && (explain.get() as { selected: string | null }).selected) explain.select(null);
        else explain.stop();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        move(e.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div data-explain-ui className="pointer-events-none fixed inset-0 z-[60]">
      {targets.filter((x) => onScreen(x.box)).map((x, i) => {
        const active = x.topic === selected;
        return (
          <Fragment key={x.topic}>
            <div
              aria-hidden
              className={cn(
                "absolute rounded-xl border-2 border-dashed transition-colors duration-200",
                active ? "border-primary bg-primary/10" : "border-primary/45 bg-primary/[0.03]",
              )}
              style={{ top: x.box.top, left: x.box.left, width: x.box.width, height: x.box.height }}
            />
            <button
              type="button"
              onClick={() => explain.select(active ? null : x.topic)}
              aria-label={u.markerLabel({ name: t.help.topics[x.topic].title })}
              aria-pressed={active}
              className={cn(
                "pointer-events-auto absolute flex size-7 items-center justify-center rounded-full text-sm font-bold shadow-md ring-4 outline-none transition-transform focus-visible:ring-ring active:scale-90",
                active ? "bg-primary text-primary-foreground ring-primary/30" : "bg-card text-primary ring-primary/20 hover:scale-110",
              )}
              style={{ top: Math.max(4, x.box.top - 10), left: Math.min(window.innerWidth - 32, x.box.left + x.box.width - 22) }}
            >
              {!active ? <span aria-hidden className="absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-ping" style={{ animationDelay: `${(i % 5) * 180}ms`, animationDuration: "2.2s" }} /> : null}
              <span aria-hidden className="relative">?</span>
            </button>
          </Fragment>
        );
      })}

      {/* What's going on, and the way out. */}
      <div className="pointer-events-auto fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.6rem)] mx-auto flex max-w-xl items-center gap-2 rounded-2xl border bg-card/95 p-2 pl-3.5 shadow-lg backdrop-blur-md motion-safe:animate-dock-in" role="status">
        <CircleHelp className="size-4 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm leading-snug">{targets.length ? u.banner : u.nothingHere}</p>
        <Button size="sm" variant="ghost" className="max-sm:hidden" onClick={() => startPageTour()}>
          <Footprints />
          {u.tour}
        </Button>
        <Button size="sm" onClick={() => explain.stop()}>
          {u.exit}
        </Button>
      </div>

      {current ? <ExplainCard key={current.topic} topic={current.topic} box={current.box} onMove={move} /> : null}
    </div>
  );
}

function TopicBody({ topic, titleId }: { topic: HelpTopic; titleId: string }) {
  const { t } = useI18n();
  const c = t.help.topics[topic];
  return (
    <>
      <p id={titleId} className="pr-8 text-base leading-snug font-semibold">
        {c.title}
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
      {c.tip ? (
        <p className="flex gap-2 rounded-lg bg-primary-soft/60 px-3 py-2 text-xs leading-relaxed text-primary-soft-foreground">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{c.tip}</span>
        </p>
      ) : null}
    </>
  );
}

function ExplainCard({ topic, box, onMove }: { topic: HelpTopic; box: Box; onMove: (delta: number) => void }) {
  const { t } = useI18n();
  const u = t.help.ui;
  const titleId = useId();
  const [ref, size] = useMeasured<HTMLDivElement>();
  const pos = placeCard(box, size.w, size.h, 72);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      className="pointer-events-auto fixed grid w-[min(22rem,calc(100vw-1.5rem))] gap-2.5 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl motion-safe:animate-dock-in"
      style={{ top: pos.top, left: pos.left }}
    >
      <button type="button" onClick={() => explain.select(null)} aria-label={t.common.close} className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <X className="size-4" />
      </button>
      <TopicBody topic={topic} titleId={titleId} />
      <div className="mt-1 flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={() => onMove(-1)}>
          <ArrowLeft />
          {u.prevBlock}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onMove(1)}>
          {u.nextBlock}
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function TourMode({ steps, index }: { steps: string[]; index: number }) {
  const { t } = useI18n();
  const u = t.help.ui;
  const pathname = useAppPathname();
  const page = helpPageOf(pathname);
  const step = steps[index];
  const intro = step === "@page";
  const titleId = useId();
  const [box, setBox] = useState<Box | null>(null);
  const [ref, size] = useMeasured<HTMLDivElement>();
  const nextButton = useRef<HTMLButtonElement>(null);
  const last = index === steps.length - 1;

  useEffect(() => {
    const el = intro ? null : document.querySelector<HTMLElement>(`main [data-help="${CSS.escape(step)}"]`);
    if (el) reveal(el);
    nextButton.current?.focus({ preventScroll: true });
  }, [step, intro]);

  useEveryFrame(() => {
    const el = intro ? null : document.querySelector<HTMLElement>(`main [data-help="${CSS.escape(step)}"]`);
    const next = el ? boxOf(el, 6) : null;
    setBox((prev) => (next === null ? null : sameBox(prev ?? undefined, next) ? prev : next));
  });

  const finish = () => {
    explain.stop();
    toast.success(u.finished);
  };
  const go = (to: number) => (to >= steps.length ? finish() : explain.go(to));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        explain.stop();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const phone = typeof window !== "undefined" && window.innerWidth < 640;
  // Phones: the card sits at the bottom like a sheet; elsewhere next to the block.
  const cardStyle: CSSProperties = intro || !box
    ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    : phone
      ? box.top + box.height / 2 > window.innerHeight * 0.55
        ? { top: "calc(env(safe-area-inset-top) + 0.75rem)", left: 12, right: 12 }
        : { bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)", left: 12, right: 12 }
      : placeCard(box, size.w, size.h, 12);
  const topic = !intro && isHelpTopic(step) ? step : null;

  return (
    <div data-explain-ui className="pointer-events-none fixed inset-0 z-[60]">
      {box && !intro ? (
        <div
          aria-hidden
          className="absolute rounded-2xl ring-2 ring-primary/80 motion-safe:transition-[top,left,width,height] motion-safe:duration-300 motion-safe:ease-out"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 200vmax rgb(0 0 0 / 0.55)" }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-black/55 motion-safe:animate-in motion-safe:fade-in-0" />
      )}
      <div
        ref={ref}
        role="dialog"
        aria-labelledby={titleId}
        aria-live="polite"
        className={cn(
          "pointer-events-auto fixed grid gap-2.5 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-2xl",
          phone && !intro ? "" : "w-[min(24rem,calc(100vw-1.5rem))]",
        )}
        style={cardStyle}
      >
        <button type="button" onClick={() => explain.stop()} aria-label={u.skip} className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-4" />
        </button>
        <p className="text-xs font-medium text-primary">{u.step({ n: index + 1, total: steps.length })}</p>
        {topic ? (
          <TopicBody topic={topic} titleId={titleId} />
        ) : (
          <>
            <p id={titleId} className="pr-8 text-lg leading-snug font-semibold">
              {page ? t.help.pages[page].title : u.tour}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{page ? t.help.pages[page].body : ""}</p>
            <p className="text-xs text-muted-foreground max-sm:hidden">{u.keys}</p>
          </>
        )}
        <div className="mt-1 flex items-center gap-2">
          {/* Progress dots. */}
          <div className="flex flex-1 flex-wrap items-center gap-1" aria-hidden>
            {steps.map((s, i) => (
              <span key={s} className={cn("h-1.5 rounded-full transition-all duration-300", i === index ? "w-4 bg-primary" : i < index ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted-foreground/25")} />
            ))}
          </div>
          {index > 0 ? (
            <Button size="sm" variant="outline" onClick={() => go(index - 1)}>
              {u.back}
            </Button>
          ) : null}
          <Button ref={nextButton} size="sm" onClick={() => go(index + 1)}>
            {last ? u.finish : u.next}
            {last ? null : <ArrowRight />}
          </Button>
        </div>
      </div>
    </div>
  );
}
