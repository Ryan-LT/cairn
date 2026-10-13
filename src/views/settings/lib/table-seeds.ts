import { ASSETS_SEED } from "@/entities/asset";
import { DEBTS_SEED } from "@/entities/debt";
import { EXPENSE_LOG_SEED, EXPENSES_SEED } from "@/entities/expense";
import { GOALS_SEED } from "@/entities/goal";
import { INCOME_SOURCES_SEED } from "@/entities/income";
import { PERSONAL_LOANS_SEED } from "@/entities/personal-loan";
import { PREFERENCES_SEED } from "@/entities/preferences";
import { SETTINGS_ASSETS_SEED } from "@/entities/settings-asset";
import type { TableKey } from "@/shared/storage/table-keys";

/** Empty value of every table (what a new account starts with). */
export const TABLE_SEEDS: Record<TableKey, unknown> = {
  assets: ASSETS_SEED,
  debts: DEBTS_SEED,
  settingsAssets: SETTINGS_ASSETS_SEED,
  incomeSources: INCOME_SOURCES_SEED,
  goals: GOALS_SEED,
  preferences: PREFERENCES_SEED,
  personalLoans: PERSONAL_LOANS_SEED,
  expenses: EXPENSES_SEED,
  expenseLog: EXPENSE_LOG_SEED,
};
