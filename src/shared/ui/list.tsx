import Link from "next/link";
import type { ReactNode } from "react";

import type { HelpTopic } from "@/shared/config/help";
import { cn } from "@/shared/lib/cn";
import { HelpHint } from "@/shared/ui/help-hint";

type ListGroupProps = {
  title?: ReactNode;
  description?: ReactNode;
  /** Right side of the group header (totals, actions). */
  aside?: ReactNode;
  /** Shown instead of rows when there are none. */
  empty?: ReactNode;
  className?: string;
  /** A "?" beside the title (also found by "explain this screen"). */
  help?: HelpTopic;
  children?: ReactNode;
};

/** A titled card of rows separated by hairlines: the app's main way of showing records. */
export function ListGroup({ title, description, aside, empty, className, help, children }: ListGroupProps) {
  const hasRows = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <section className={cn("grid gap-2", className)} data-help={help}>
      {title || aside ? (
        <header className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            {title ? (
              <div className="flex items-center gap-1">
                <h2 className="text-sm font-semibold">{title}</h2>
                {help ? <HelpHint topic={help} className="-my-1" /> : null}
              </div>
            ) : null}
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {aside ? <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">{aside}</div> : null}
        </header>
      ) : null}
      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        {hasRows ? <ul className="divide-y">{children}</ul> : empty}
      </div>
    </section>
  );
}

type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned primary value (usually an amount). */
  trailing?: ReactNode;
  /** Small line under the trailing value. */
  trailingSub?: ReactNode;
  /** Controls after the trailing value (check button, row menu); never inside the clickable area. */
  actions?: ReactNode;
  /** Makes the row's main area a button. */
  onClick?: () => void;
  /** Makes the row's main area a link. */
  href?: string;
  /** Accessible name for the clickable area when the title isn't enough. */
  label?: string;
  muted?: boolean;
  className?: string;
};

/**
 * One record: icon tile, title and subtitle, amount on the right, then actions.
 * The middle area is the click target, so actions stay separately tappable.
 */
export function ListRow({ leading, title, subtitle, trailing, trailingSub, actions, onClick, href, label, muted, className }: ListRowProps) {
  const body = (
    <>
      {leading}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className={cn("truncate text-sm font-medium", muted && "text-muted-foreground")}>{title}</span>
        {subtitle ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
      {trailing !== undefined || trailingSub ? (
        <span className="grid shrink-0 justify-items-end gap-0.5 text-right">
          {trailing !== undefined ? <span className={cn("text-sm font-semibold", muted && "text-muted-foreground")}>{trailing}</span> : null}
          {trailingSub ? <span className="text-xs text-muted-foreground">{trailingSub}</span> : null}
        </span>
      ) : null}
    </>
  );
  // Tappable rows give a slight press-in, so a tap feels registered before the sheet opens.
  const area =
    "flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none transition-transform duration-150 focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.985] motion-reduce:active:scale-100";
  return (
    <li className={cn("flex min-h-14 items-center gap-2 px-4 py-2.5 transition-colors", (onClick || href) && "hover:bg-accent/40", className)}>
      {href ? (
        <Link href={href} className={area} aria-label={label}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={area} aria-label={label}>
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </li>
  );
}
