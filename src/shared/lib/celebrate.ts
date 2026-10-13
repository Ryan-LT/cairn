/**
 * Small moments of delight: a confetti burst from an element and a light
 * vibration on phones. Both do nothing under reduced motion, and the burst is
 * plain DOM (Web Animations API), cleaned up when it ends.
 */

const PALETTE = ["var(--success)", "var(--primary)", "var(--capstone)", "var(--assist)"];

function reducedMotion(): boolean {
  return typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

type BurstOptions = {
  /** Pieces of confetti. */
  count?: number;
  /** How far they fly, in px. */
  distance?: number;
  /** Piece size, in px. */
  size?: number;
  colors?: string[];
};

/** Confetti bursting out of the middle of `anchor`. */
export function burstConfetti(anchor: Element | null, { count = 10, distance = 34, size = 6, colors = PALETTE }: BurstOptions = {}): void {
  if (!anchor || reducedMotion() || typeof document.body.animate !== "function") return;
  const rect = anchor.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top + rect.height / 2}px`,
    width: "0",
    height: "0",
    pointerEvents: "none",
    zIndex: "70",
  });
  document.body.appendChild(layer);

  const done: Promise<unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const reach = distance * (0.65 + Math.random() * 0.6);
    const s = size * (0.6 + Math.random() * 0.7);
    const round = Math.random() > 0.5;
    Object.assign(piece.style, {
      position: "absolute",
      left: `${-s / 2}px`,
      top: `${-s / 2}px`,
      width: `${s}px`,
      height: `${round ? s : s * 0.45}px`,
      borderRadius: round ? "9999px" : "1px",
      background: colors[i % colors.length],
    });
    layer.appendChild(piece);
    const x = Math.cos(angle) * reach;
    const y = Math.sin(angle) * reach;
    done.push(
      piece
        .animate(
          [
            { transform: "translate(0, 0) rotate(0deg) scale(0.4)", opacity: 1 },
            { transform: `translate(${x * 0.8}px, ${y * 0.8}px) rotate(${Math.random() * 180}deg) scale(1)`, opacity: 1, offset: 0.55 },
            // A little gravity at the end.
            { transform: `translate(${x}px, ${y + reach * 0.35}px) rotate(${Math.random() * 360}deg) scale(0.7)`, opacity: 0 },
          ],
          { duration: 650 + Math.random() * 300, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
        )
        .finished.catch(() => undefined),
    );
  }
  void Promise.all(done).then(() => layer.remove());
}

/** A short tap of vibration where the device supports it (Android browsers). */
export function hapticTap(ms = 12): void {
  if (reducedMotion()) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Not allowed here (e.g. no user gesture): skip.
  }
}
