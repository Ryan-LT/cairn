<img src="brand/logo/cairn-logo.svg" alt="Cairn" height="44">

# Cairn

*Build wealth, stone by stone.* Cairn (formerly Wealth Tracker) is a private personal finance console with separate accounts: net worth, assets, income,
itemized bills and budgets with a monthly check-off, debts, informal loans, goal plans
with projections, and how your money is shared across plans. Works offline as an
installable PWA.

## Sections

| Section | Tabs (routes) |
| --- | --- |
| Tổng quan / Home | `/`: net worth, this month, bills to pay, insights, goals, health, setup guide |
| Dòng tiền / Cash flow | Tháng này `/cashflow` (tick bills as paid, log budget spending) · Chi tiêu `/cashflow/spending` (bills and budgets by category, needs vs wants, plan vs actual, CSV) · Thu nhập `/cashflow/income` |
| Tài sản ròng / Net worth | Tài sản `/wealth` · Khoản nợ `/wealth/debts` · Cho vay `/wealth/loans` |
| Mục tiêu / Goals | Kế hoạch `/goals` · Phân bổ `/goals/funding` |
| Cài đặt / Settings | `/settings`: appearance, privacy, milestone, how totals are counted, backup, restore, CSV |

On phones the bottom bar has the four sections and a centre **＋** for quick adds
(pay a bill, add a bill, income, asset, debt, loan, plan). Each page opens its form for
`?new=1`, and edit links use `?edit=<id>`. **Privacy mode** (the eye icon) blurs every amount
on this device; press and hold an amount to peek.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/Radix ·
TanStack Table · Recharts · react-hook-form + zod · Serwist · Neon Postgres.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL and AUTH_SECRET
psql "$DATABASE_URL" -f db/schema.sql   # once per database, then add an account (below)
pnpm dev
```

Open http://localhost:3000.

Brand guide, logo files and colours: [`brand/BRAND.md`](brand/BRAND.md).

For local UI work without touching your real data, create `.env.development.local`
(gitignored, overrides `.env.local` in dev only):

```bash
DATABASE_URL=        # empty: no database, no login gate; the app runs from the browser cache
```

Point `DATABASE_URL` at a Neon **dev branch** to exercise real round trips.

## Accounts

Each account has its own data; a new account starts empty.

**Sign-up is open:** anyone can create an account at `/register` (username, optional
name and email, password) and is signed in right away. To limit abuse: 3 new accounts
per IP per hour, 20 attempts per IP per hour, 50 new accounts per day in total, plus a
hidden honeypot field. IPs are stored only as an HMAC and pruned after a day
(`cairn_signup_attempts`).

An admin can still create an account in SQL (Neon SQL Editor): copy
[`db/create-user.sql`](db/create-user.sql), fill in the username, display name
and password, and run it:

```sql
INSERT INTO cairn_users (username, display_name, password_hash)
VALUES (lower('alice'), 'Alice Nguyen', crypt('a-strong-password', gen_salt('bf', 12)));
```

Passwords are bcrypt hashes (`pgcrypto`). Login needs `DATABASE_URL` and
`AUTH_SECRET`; the session lasts 30 days.

- **Sign in** with the username, or the email once one is set for the account.
- **Change password:** each person does it in Settings → Password (current password
  required). It signs them out on their other devices.
- **Forgot password:** an admin resets it in SQL, then the person changes it in Settings.
- **Lockout:** 5 wrong passwords in a row lock the account for 15 minutes.

[`db/create-user.sql`](db/create-user.sql) has the snippets for setting an email,
an admin password reset, unlocking an account and deleting one with its data.

**Database upgrades** live in [`db/migrations/`](db/migrations/); run each one in
the Neon SQL Editor before deploying the code that needs it.

**Upgrading to the Cairn table names:** run
[`db/migrations/2026-10-rename-to-cairn.sql`](db/migrations/2026-10-rename-to-cairn.sql)
(renames `wealthtracker_*` to `cairn_*` in place, no data moves), deploy straight after,
then run [`2026-10-rename-to-cairn-cleanup.sql`](db/migrations/2026-10-rename-to-cairn-cleanup.sql)
to drop the old-name views. Devices carry their cached data over on first load.

**Upgrading from the single-login version:** sync every device, run
[`db/migrations/2026-10-multi-user.sql`](db/migrations/2026-10-multi-user.sql) with
your username and password filled in (your existing data becomes yours), deploy,
then remove `AUTH_USERNAME`, `AUTH_PASSWORD`, `USER_DATE_OF_BIRTH` and
`WEALTH_MILESTONE_TARGET_USD` from the environment. Your birth date and milestone
target now live in Settings → Milestone goal.

## Languages

The app is in **English and Vietnamese**. Everyone starts in **Vietnamese**
(whatever the browser language); each account saves its language to its profile
automatically. The switcher (Settings → Appearance, the user menu, or the sign-in
page) changes it on the device (`wt_locale` cookie) and in the account, so it
follows the person to other devices.

- URLs don't change: every page is prerendered once per language under `src/app/[lang]/`
  and `src/proxy.ts` rewrites `/goals` to `/vi/goals` or `/en/goals` (cookie, else Vietnamese).
- Text lives in `src/shared/i18n/messages/en/*.ts` (source of truth) and
  `messages/vi/*.ts`. Vietnamese is typed against English, so a missing key fails
  `pnpm typecheck`; `pnpm test` checks both dictionaries match and that nothing was
  left untranslated; `pnpm lint` rejects hard-coded English in components.
- In a component: `const { t } = useI18n();` then `t.goals.title` or
  `t.common.months({ count })`. Dates and compact money follow the page language
  (`2 thg 10, 2026`, `4,82 tỷ ₫`); full money is `1.245.670.000 ₫` in both.
- To change wording, edit the message files. To add a language, add a folder under
  `messages/`, list it in `src/shared/i18n/locale.ts`, and translate every key.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` | Production build (webpack — required by Serwist) |
| `pnpm lint` | ESLint, including design-system guardrails |
| `pnpm typecheck` | TypeScript |
| `pnpm test` | Vitest (finance logic, formatters, store) |

Keep `pnpm-lock.yaml` and `package-lock.json` in sync: `pnpm add …` then
`npm install --package-lock-only`.

## Structure (Feature-Sliced Design)

```
src/
  app/        routes, layouts, PWA (manifest, service worker), API routes
  views/      one folder per page (home, cashflow, income, wealth, assets, debts, loans,
              goals, allocations, settings)
  widgets/    app-shell (sidebar, top bar, mobile tab bar, quick-add sheet, section
              frame with tabs, command palette), bill-list, insights-feed, setup-guide
  features/   expense-form, record-spending, export-spending-csv, privacy-mode,
              allocate-sources, switch-language, sign-out, sync-now
  entities/   domain models + pure, tested logic (expense, goal, portfolio, milestone,
              asset, debt, …)
  shared/     api, config (nav), lib (format, dates), storage (client store), ui (design system)
```

### Data

All data lives in one Neon table (`cairn_kv`) as JSON documents per user and key
(`assets`, `settingsAssets`, `incomeSources`, `debts`, `goals`, `preferences`,
`personalLoans`, `expenses`, `expenseLog`), read and written through `GET/PUT /api/tables`,
which only ever see the signed-in user's rows. A new key is just a new row, so no
migration is needed for it. The client store (`src/shared/storage/store.ts`) caches
everything in `localStorage` (one cache per account), saves edits after a short
debounce and retries with backoff when offline. Signing out removes the account's
cached data from the device once it has synced.

**Money out** (`src/entities/expense`): `expenses` holds the bill and budget lines
(category, amount, frequency, due day, autopay, optional link to a debt) and
`expenseLog` the month-by-month check-offs (kept 36 months). They're separate tables
so ticking a bill on one device can't overwrite a bill just added on another.
`resolveMonthlySpending` turns them into the one spending number every projection
uses: itemized lines plus whatever the old single estimate still covers until it is
broken down or retired. A bill linked to a debt takes its amount from the debt's
monthly payment; the principal part isn't counted as lost net worth.

**Change log** (`cairn_audit_log`): every save through `PUT /api/tables` is
compared with what was stored, and each record added, edited or removed gets a row
(entity type and id, readable name, changed fields, the whole record before and after,
a batch id per sync), written in the same statement as the save. The table is created on
first use (`src/shared/api/lazy-schema.ts`; the DDL is also in
[`db/migrations/2026-10-activity-feedback.sql`](db/migrations/2026-10-activity-feedback.sql)).
Browse it in Settings → Change log (`GET /api/activity`), or query it directly, e.g. a
debt's history: `SELECT occurred_at, action, changes FROM cairn_audit_log WHERE
user_id = '…' AND entity_type = 'debt' AND entity_id = 'd1' ORDER BY id`. View state (which
plan is open, table sort) and net worth the app recomputes itself aren't logged.

**Feedback** (`cairn_feedback`): the floating "Góp ý" button stores the kind, an
optional 1–5 rating, the message, and the page, language, window size and browser it came
from (`status` starts as `new`; there's no reading screen yet). The "Hỏi AI" button opens
an assistant bubble that says it's still in development; nothing is sent anywhere.

**Backups:** Settings → Data exports every table as JSON and restores it (tables
missing from an older backup are left as they are). `assets` is the old holdings
store; the Net worth page offers a one-time move into editable assets.

### Design system

- Tokens in `src/app/globals.css` — the "Warm stone" palette: warm off-white / charcoal
  neutrals (a dimmed, low-glare dark mode), one soft indigo accent with a `primary-soft`
  tint for selected states, `success / warning / danger / info` for signed values and
  status (all AA in both modes), and a chart palette validated against the card surface.
- Each bill category has a `--cat-<id>` colour (and `-soft` tile tint) in both modes;
  colour is decoration only, the icon and label carry the meaning. Amber (`--capstone`)
  is for goals, milestones and the setup guide, never for status.
- Components in `src/shared/ui` (`PageHeader`, `Section`, `StatCard`, `Money`,
  `StatusBadge`, `ListGroup`/`ListRow`, `IconTile`, `ProgressRing`, `StackedBar`,
  `AmountSheet`, `MonthSwitcher`, `TabLinks`, `DataTable`, form fields…), primitives in
  `src/shared/ui/kit`.
- Anything showing an amount gets `data-private` so privacy mode can blur it (`Money`
  does this already).
- Money is always written `1.245.670.000 ₫` (compact `4,82B ₫` on KPI tiles, full value
  on hover/tap); dates as `12 Mar 2026`.
- ESLint rejects arbitrary font sizes and raw palette colours.
