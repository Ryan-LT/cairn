import { cn } from "@/shared/lib/cn";

/** The brand's stacked stones, drawn with theme tokens: used to dress up empty states and the setup guide. */
export function CairnStones({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" aria-hidden className={cn("h-14 w-16", className)}>
      <ellipse cx="32" cy="50" rx="26" ry="3" className="fill-foreground/5" />
      <rect x="10" y="34" width="44" height="14" rx="7" className="fill-muted-foreground/20" transform="rotate(-2 32 41)" />
      <rect x="16" y="21" width="32" height="13" rx="6.5" className="fill-primary-soft stroke-primary/25" strokeWidth="1" transform="rotate(3 32 27)" />
      <rect x="23" y="9" width="18" height="12" rx="6" className="fill-capstone" transform="rotate(-4 32 15)" />
    </svg>
  );
}
