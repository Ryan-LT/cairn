import { common } from "./common";
import { nav } from "./nav";
import { errors } from "./errors";
import { domain } from "./domain";
import { auth } from "./auth";
import { shell } from "./shell";
import { dashboard } from "./dashboard";
import { goals } from "./goals";
import { allocations } from "./allocations";
import { assets } from "./assets";
import { income } from "./income";
import { expenses } from "./expenses";
import { cashflow } from "./cashflow";
import { wealth } from "./wealth";
import { debts } from "./debts";
import { loans } from "./loans";
import { settings } from "./settings";

/** English messages: the source of truth. Every other language must match this shape exactly. */
export const en = {
  common,
  nav,
  errors,
  domain,
  auth,
  shell,
  dashboard,
  goals,
  allocations,
  assets,
  income,
  expenses,
  cashflow,
  wealth,
  debts,
  loans,
  settings,
};

export type Messages = typeof en;
