import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";
import { toneColors, type TileTone } from "@/shared/lib/tone";

/** Small illustrations for empty states, drawn with the theme's tone tokens (light and dark). */
export const SPOT_ART = ["coins", "receipts", "target", "shield", "sprout", "handshake", "calendar", "chart", "search", "wallet"] as const;
export type SpotArtName = (typeof SPOT_ART)[number];

const TONE: Record<SpotArtName, TileTone> = {
  coins: "amber",
  receipts: "teal",
  target: "orange",
  shield: "teal",
  sprout: "teal",
  handshake: "violet",
  calendar: "orange",
  chart: "blue",
  search: "indigo",
  wallet: "teal",
};

/** Scales and spins around its own middle. */
const SELF: CSSProperties = { transformBox: "fill-box", transformOrigin: "center" };

function Sparkle({ x, y, delay = 0, size = 1 }: { x: number; y: number; delay?: number; size?: number }) {
  return (
    <path
      d={`M${x} ${y - 4 * size} L${x + 1.2 * size} ${y - 1.2 * size} L${x + 4 * size} ${y} L${x + 1.2 * size} ${y + 1.2 * size} L${x} ${y + 4 * size} L${x - 1.2 * size} ${y + 1.2 * size} L${x - 4 * size} ${y} L${x - 1.2 * size} ${y - 1.2 * size} Z`}
      fill="var(--capstone)"
      className="motion-safe:animate-twinkle"
      style={{ ...SELF, animationDelay: `${delay}ms` }}
    />
  );
}

function drawing(name: SpotArtName, fg: string, soft: string): ReactNode {
  const line = { stroke: fg, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  switch (name) {
    case "coins":
      return (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i} className="motion-safe:animate-stone-drop" style={{ animationDelay: `${(2 - i) * 120}ms` }}>
              <ellipse cx="44" cy={58 - i * 10} rx="20" ry="6" fill={soft} stroke={fg} strokeWidth="2" />
              <path d={`M24 ${58 - i * 10} v4 a20 6 0 0 0 40 0 v-4`} fill={soft} stroke={fg} strokeWidth="2" />
            </g>
          ))}
          <g className="motion-safe:animate-float">
            <circle cx="72" cy="26" r="9" fill="var(--capstone-soft)" stroke="var(--capstone-ink)" strokeWidth="2" />
            <path d="M72 21v10M69 24h4.5a1.8 1.8 0 0 1 0 3.5H69" {...line} stroke="var(--capstone-ink)" strokeWidth="1.6" />
          </g>
          <Sparkle x={20} y={24} delay={300} />
        </>
      );
    case "receipts":
      return (
        <>
          <path d="M30 14h30v50l-5-3-5 3-5-3-5 3-5-3-5 3z" fill={soft} stroke={fg} strokeWidth="2" strokeLinejoin="round" transform="rotate(-8 45 40)" opacity="0.6" />
          <g className="motion-safe:animate-float">
            <path d="M36 12h30v50l-5-3-5 3-5-3-5 3-5-3-5 3z" fill="var(--card)" stroke={fg} strokeWidth="2" strokeLinejoin="round" />
            <path d="M42 24h18M42 32h18M42 40h11" {...line} strokeWidth="1.8" />
          </g>
          <g className="motion-safe:animate-check-pop">
            <circle cx="66" cy="56" r="9" fill={fg} />
            <path d="M62 56l3 3 5-6" stroke="var(--card)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
          <Sparkle x={22} y={30} delay={200} />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="44" cy="42" r="24" fill={soft} stroke={fg} strokeWidth="2" />
          <circle cx="44" cy="42" r="15" fill="var(--card)" stroke={fg} strokeWidth="2" />
          <circle cx="44" cy="42" r="6" fill={fg} />
          <g className="motion-safe:animate-stone-drop" style={{ animationDelay: "200ms" }}>
            <path d="M46 40l24-20" {...line} strokeWidth="2.4" />
            <path d="M64 18l8-2-2 8z" fill={fg} />
          </g>
          <Sparkle x={74} y={46} delay={500} />
          <Sparkle x={16} y={20} delay={100} size={0.8} />
        </>
      );
    case "shield":
      return (
        <>
          <g className="motion-safe:animate-float">
            <path d="M44 12l22 8v16c0 14-9 24-22 30-13-6-22-16-22-30V20z" fill={soft} stroke={fg} strokeWidth="2" strokeLinejoin="round" />
            <path d="M35 39l6 6 12-13" {...line} strokeWidth="2.6" />
          </g>
          <Sparkle x={72} y={22} delay={150} />
          <Sparkle x={16} y={48} delay={600} size={0.8} />
        </>
      );
    case "sprout":
      return (
        <>
          <ellipse cx="44" cy="62" rx="18" ry="5" fill={soft} stroke={fg} strokeWidth="2" />
          <path d="M26 62v3a18 5 0 0 0 36 0v-3" fill={soft} stroke={fg} strokeWidth="2" />
          <g className="motion-safe:animate-float" style={{ ...SELF, transformOrigin: "bottom" }}>
            <path d="M44 58V34" {...line} strokeWidth="2.4" />
            <path d="M44 42c-10 0-15-6-15-14 9 0 15 5 15 14z" fill={soft} stroke={fg} strokeWidth="2" strokeLinejoin="round" />
            <path d="M44 36c0-10 6-16 16-16 0 10-6 16-16 16z" fill={fg} />
          </g>
          <Sparkle x={70} y={40} delay={300} />
        </>
      );
    case "handshake":
      return (
        <>
          <circle cx="32" cy="38" r="15" fill={soft} stroke={fg} strokeWidth="2" />
          <circle cx="56" cy="38" r="15" fill="var(--capstone-soft)" stroke="var(--capstone-ink)" strokeWidth="2" />
          <g className="motion-safe:animate-float">
            <path d="M30 60c8 6 20 6 28 0" {...line} />
            <path d="M55 57l3 3-4 2" {...line} />
            <path d="M58 16c-8-6-20-6-28 0" {...line} />
            <path d="M33 19l-3-3 4-2" {...line} />
          </g>
          <Sparkle x={44} y={38} delay={250} size={0.9} />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="22" y="18" width="44" height="42" rx="7" fill="var(--card)" stroke={fg} strokeWidth="2" />
          <path d="M22 30h44" stroke={fg} strokeWidth="2" />
          <rect x="22" y="18" width="44" height="12" rx="6" fill={soft} />
          <path d="M33 13v9M55 13v9" {...line} />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => <circle key={`${r}-${c}`} cx={31 + c * 9} cy={38 + r * 8} r="1.8" fill={fg} opacity={r === 1 && c === 2 ? 0 : 0.35} />),
          )}
          <g className="motion-safe:animate-check-pop">
            <circle cx="49" cy="46" r="5" fill={fg} />
          </g>
          <g className="motion-safe:animate-float">
            <path d="M68 50V30" {...line} />
            <path d="M68 30l10 4-10 4" fill="var(--capstone)" stroke="var(--capstone-ink)" strokeWidth="1.5" strokeLinejoin="round" />
          </g>
        </>
      );
    case "chart":
      return (
        <>
          <rect x="16" y="14" width="56" height="48" rx="8" fill={soft} />
          <path d="M24 54h40" stroke={fg} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          <path d="M24 50l10-8 9 4 10-12 10-8" {...line} strokeWidth="2.6" className="motion-safe:animate-draw-in" />
          <circle cx="63" cy="26" r="4" fill={fg} className="motion-safe:animate-check-pop" style={{ animationDelay: "700ms" }} />
          <Sparkle x={74} y={14} delay={900} />
        </>
      );
    case "search":
      return (
        <>
          <g className="motion-safe:animate-float">
            <circle cx="40" cy="36" r="16" fill={soft} stroke={fg} strokeWidth="2.4" />
            <path d="M52 48l12 12" {...line} strokeWidth="4" />
            <path d="M34 32a7 7 0 0 1 8-5" stroke="var(--card)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          </g>
          <Sparkle x={66} y={22} delay={200} />
          <Sparkle x={18} y={54} delay={700} size={0.8} />
        </>
      );
    case "wallet":
      return (
        <>
          <g className="motion-safe:animate-stone-drop" style={{ animationDelay: "250ms" }}>
            <circle cx="56" cy="20" r="8" fill="var(--capstone-soft)" stroke="var(--capstone-ink)" strokeWidth="2" />
          </g>
          <rect x="18" y="26" width="52" height="36" rx="8" fill={soft} stroke={fg} strokeWidth="2" />
          <path d="M18 34h52" stroke={fg} strokeWidth="2" opacity="0.5" />
          <rect x="52" y="40" width="22" height="12" rx="6" fill="var(--card)" stroke={fg} strokeWidth="2" />
          <circle cx="59" cy="46" r="2.2" fill={fg} />
          <Sparkle x={20} y={18} delay={500} size={0.8} />
        </>
      );
  }
}

export function SpotArt({ name, className }: { name: SpotArtName; className?: string }) {
  const { color, background } = toneColors(TONE[name]);
  return (
    <svg viewBox="0 0 88 76" aria-hidden className={cn("h-[76px] w-[88px]", className)}>
      <ellipse cx="44" cy="70" rx="28" ry="3" className="fill-foreground/5" />
      {drawing(name, color, background)}
    </svg>
  );
}
