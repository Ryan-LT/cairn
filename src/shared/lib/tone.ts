/** Semantic tones shared by badges, callouts and value colouring. */
export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

/** Soft colour pairs for tiles (`--tone-*` in globals.css, both themes); `capstone` is the brand amber. */
export const TILE_TONES = ["indigo", "orange", "teal", "amber", "rose", "blue", "violet", "stone", "capstone"] as const;
export type TileTone = (typeof TILE_TONES)[number];

/** Icon and background colours for a tone. */
export function toneColors(tone: TileTone): { color: string; background: string } {
  return tone === "capstone" ? { color: "var(--capstone-ink)", background: "var(--capstone-soft)" } : { color: `var(--tone-${tone})`, background: `var(--tone-${tone}-soft)` };
}
