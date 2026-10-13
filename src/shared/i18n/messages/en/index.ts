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
import { insights } from "./insights";
import { setup } from "./setup";
import { home } from "./home";
import { debts } from "./debts";
import { loans } from "./loans";
import { settings } from "./settings";
import { activity } from "./activity";
import { assist } from "./assist";
import { currency } from "./currency";
import { ledger } from "./ledger";
import { health } from "./health";
import { help } from "./help";

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
  insights,
  setup,
  home,
  debts,
  loans,
  settings,
  activity,
  assist,
  currency,
  ledger,
  health,
  help,
};

export type Messages = typeof en;
