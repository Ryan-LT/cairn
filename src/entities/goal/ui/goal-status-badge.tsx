import { CalendarX, CircleCheck, CircleDashed, CircleHelp, Gauge, PiggyBank, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";

import { useI18n } from "@/shared/i18n";
import { StatusBadge } from "@/shared/ui/status-badge";

import type { GoalStatus, GoalStatusCode } from "../lib/status";

const ICONS: Record<GoalStatusCode, LucideIcon> = {
  no_target: CircleHelp,
  achieved: CircleCheck,
  on_track: TrendingUp,
  close: Gauge,
  behind: TriangleAlert,
  no_savings: PiggyBank,
  past_due: CalendarX,
  no_date: CircleDashed,
};

/** The plan's status, the same everywhere: icon + label (the longer hint as a title). */
export function GoalStatusBadge({ status, className }: { status: Pick<GoalStatus, "code" | "tone">; className?: string }) {
  const { t } = useI18n();
  const { label, hint } = t.goals.statusCodes[status.code];
  return (
    <StatusBadge tone={status.tone} icon={ICONS[status.code]} title={hint} className={className}>
      {label}
    </StatusBadge>
  );
}
