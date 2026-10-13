import type { ExpenseCategoryId } from "../model";

export type ExpenseCategoryMeta = {
  /** Default need (true) vs want (false) for the needs / wants split. */
  essential: boolean;
  /** CSS colour token for the category tile (decoration only: icon and label carry the meaning). */
  color: `var(--cat-${ExpenseCategoryId})`;
  soft: `var(--cat-${ExpenseCategoryId}-soft)`;
};

function meta(id: ExpenseCategoryId, essential: boolean): ExpenseCategoryMeta {
  return { essential, color: `var(--cat-${id})`, soft: `var(--cat-${id}-soft)` };
}

/** Labels live in `t.expenses.categories[id]`; icons in `ui/category-icon.tsx`. */
export const EXPENSE_CATEGORY_META: Record<ExpenseCategoryId, ExpenseCategoryMeta> = {
  housing: meta("housing", true),
  utilities: meta("utilities", true),
  food: meta("food", true),
  transport: meta("transport", true),
  debt: meta("debt", true),
  insurance: meta("insurance", true),
  health: meta("health", true),
  education: meta("education", true),
  family: meta("family", true),
  giving: meta("giving", false),
  subscriptions: meta("subscriptions", false),
  shopping: meta("shopping", false),
  leisure: meta("leisure", false),
  other: meta("other", false),
};
