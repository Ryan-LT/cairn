import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

import { cn } from "@/shared/lib/cn";
import { toneColors, type TileTone } from "@/shared/lib/tone";

const SIZES = {
  sm: "size-7 rounded-md [&>svg]:size-3.5",
  md: "size-9 rounded-lg [&>svg]:size-4",
  lg: "size-11 rounded-xl [&>svg]:size-5",
} as const;

type IconTileProps = {
  icon: LucideIcon;
  /** CSS colour for the icon (e.g. `var(--cat-food)`); default muted ink. */
  color?: string;
  /** CSS colour for the tile; default muted surface. */
  background?: string;
  /** A soft colour pair (instead of `color` / `background`). */
  tone?: TileTone;
  size?: keyof typeof SIZES;
  className?: string;
};

/** A rounded square with an icon: the leading visual of list rows. Decoration only (labels carry meaning). */
export function IconTile({ icon: Icon, color, background, tone, size = "md", className }: IconTileProps) {
  const pair = tone ? toneColors(tone) : null;
  const fg = color ?? pair?.color;
  const bg = background ?? pair?.background;
  const style: CSSProperties | undefined = fg || bg ? { color: fg, background: bg } : undefined;
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center",
        !fg && "text-muted-foreground",
        !bg && "bg-muted",
        SIZES[size],
        className,
      )}
    >
      <Icon />
    </span>
  );
}
