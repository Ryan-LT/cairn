import type { Debt } from "@/entities/debt";
import type { Messages } from "@/shared/i18n";
import { formatDate } from "@/shared/lib/format";
import type { StatusTone } from "@/shared/lib/tone";

import type { ExpenseItem } from "../model";
import type { BillLine, BillStatus, BudgetLine, BudgetStatus } from "../lib/month";
import { effectiveDueDay } from "../lib/schedule";

/** "Hạn ngày 15", "Hạn 10 tháng 3", "Mỗi thứ Bảy", "Ngày nào trong tháng cũng được". */
export function scheduleText(t: Messages, item: ExpenseItem, debt?: Debt): string {
  const s = t.expenses.schedule;
  if (item.frequency === "weekly") return item.dueWeekday ? s.weekly({ weekday: t.expenses.weekdays[item.dueWeekday as 1] }) : t.expenses.frequencies.weekly;
  const day = effectiveDueDay(item, debt);
  const month = item.frequency !== "monthly" && item.dueMonth ? t.expenses.months[item.dueMonth as 1] : null;
  if (day && month) return s.dueDayMonth({ day, month });
  if (month) return s.inMonth({ month });
  if (day) return s.dueDay({ day });
  return s.anyTime;
}

export const BILL_STATUS_TONE: Record<BillStatus, StatusTone> = {
  paid: "success",
  autopaid: "success",
  skipped: "neutral",
  overdue: "danger",
  due_today: "warning",
  due_soon: "warning",
  upcoming: "neutral",
  unconfirmed: "info",
};

export const BUDGET_STATUS_TONE: Record<BudgetStatus, StatusTone> = {
  on_track: "success",
  watch: "warning",
  over: "danger",
  unused: "neutral",
};

/** Short status for a bill this month ("Quá hạn 3 ngày", "Còn 2 ngày", "Đã trả"). */
export function billStatusText(t: Messages, line: BillLine): string {
  const s = t.expenses.status;
  switch (line.status) {
    case "paid":
      return line.occurrences > 1 ? s.partOf({ done: line.paidCount, total: line.occurrences }) : s.paid;
    case "autopaid":
      return s.autopaid;
    case "skipped":
      return s.skipped;
    case "overdue":
      return line.daysUntilDue !== null ? s.overdue({ count: Math.abs(line.daysUntilDue) }) : s.unpaid;
    case "due_today":
      return s.dueToday;
    case "due_soon":
      return s.dueSoon({ count: line.daysUntilDue ?? 0 });
    case "unconfirmed":
      return s.unconfirmed;
    default:
      return s.upcoming;
  }
}

/** Second line under a bill: when it's (or was) due, or when it was paid. */
export function billDateText(t: Messages, line: BillLine): string | null {
  const paidOn = line.payments.at(-1)?.date;
  if ((line.status === "paid" || line.status === "autopaid") && paidOn) return formatDate(paidOn, "dayMonth");
  const due = line.nextDue ?? line.dueDates[0];
  return due ? formatDate(due, "dayMonth") : null;
}

export function budgetStatusText(t: Messages, line: BudgetLine): string {
  return t.expenses.budgetStatus[line.status];
}
