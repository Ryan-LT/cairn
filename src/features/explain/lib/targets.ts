/** A block on the page that can explain itself (`data-help="<topic>"`). */
export type HelpTarget = { topic: string; el: HTMLElement };

export type Box = { top: number; left: number; width: number; height: number };

/** Explainable blocks currently rendered in the page, in reading order; each topic once. */
export function findTargets(): HelpTarget[] {
  const seen = new Set<string>();
  const out: HelpTarget[] = [];
  for (const el of document.querySelectorAll<HTMLElement>("main [data-help]")) {
    const topic = el.dataset.help;
    if (!topic || seen.has(topic)) continue;
    // Hidden at this breakpoint (display: none) or collapsed.
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    seen.add(topic);
    out.push({ topic, el });
  }
  return out;
}

export function boxOf(el: Element, pad = 0): Box {
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top - pad), left: Math.round(r.left - pad), width: Math.round(r.width + pad * 2), height: Math.round(r.height + pad * 2) };
}

export function sameBox(a: Box | undefined, b: Box | undefined): boolean {
  return !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/** Whether any part of `b` is on screen. */
export function onScreen(b: Box): boolean {
  return b.top + b.height > 0 && b.left + b.width > 0 && b.top < window.innerHeight && b.left < window.innerWidth;
}

const GAP = 12;
const EDGE = 12;

/**
 * Where to put a `w`×`h` card next to `target`: below it if there is room,
 * else above, else over its top edge (tall blocks). Always inside the window.
 */
export function placeCard(target: Box, w: number, h: number, topLimit = EDGE): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(EDGE, target.left + target.width / 2 - w / 2), vw - w - EDGE);
  const below = target.top + target.height + GAP;
  const above = target.top - GAP - h;
  let top: number;
  if (below + h <= vh - EDGE) top = below;
  else if (above >= topLimit) top = above;
  else top = Math.min(Math.max(topLimit, target.top + GAP), vh - h - EDGE);
  return { top: Math.round(top), left: Math.round(left) };
}

/** Scroll `el` into view (centred when it fits), respecting reduced motion. */
export function reveal(el: HTMLElement): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tall = el.getBoundingClientRect().height > window.innerHeight * 0.7;
  el.scrollIntoView({ block: tall ? "start" : "center", behavior: reduce ? "auto" : "smooth" });
}
