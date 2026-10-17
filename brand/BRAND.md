# Cairn — brand identity

<img src="logo/cairn-logo.svg" alt="Cairn" height="48">

**Cairn** is a private personal-finance console (formerly *Wealth Tracker*).

- **Descriptor:** Personal finance
- **Tagline:** Build wealth, stone by stone.

## The idea

A cairn is a stack of stones that hikers build to mark a trail. Each stone is
placed on purpose, the stack shows how far you have come, and it points the way
ahead. That is what the app does with money: assets are stacked into plans,
checkpoints mark the path, and the goal sits on top. The name also fits the
app's *Warm stone* colour scheme.

## Logo

<img src="logo/cairn-mark.svg" alt="Cairn mark" height="96">

The mark is three stones on an indigo tile:

| Stone | Colour | Stands for |
| --- | --- | --- |
| Base | White | What you already own |
| Middle | Mist `#dcdcf7` | The plans built on it |
| Capstone | Amber `#f4b860` | The goal |

The middle stone and the capstone tilt slightly in opposite directions, which
makes the stack look hand-placed but balanced. Don't straighten them.

### Files

| File | Use |
| --- | --- |
| [`logo/cairn-logo.svg`](logo/cairn-logo.svg) | Horizontal lockup on light backgrounds |
| [`logo/cairn-logo-dark.svg`](logo/cairn-logo-dark.svg) | Horizontal lockup on dark backgrounds |
| [`logo/cairn-logo-mono.svg`](logo/cairn-logo-mono.svg) | One colour (`currentColor`): print, embossing, single-ink use |
| [`logo/cairn-mark.svg`](logo/cairn-mark.svg) | The mark on its own (avatars, loading screens, small spaces) |
| [`logo/cairn-mark-mono.svg`](logo/cairn-mark-mono.svg) | Stones only, one colour (`currentColor`), no tile |

In the app, use `<Logo />` from `src/shared/ui/logo.tsx`, and take the name,
descriptor and tagline from `BRAND` in `src/shared/config/brand.ts`.

The wordmark is Inter Semibold with −2% letter spacing, converted to outlines
so the files look the same everywhere.

### Usage

- **Clear space:** keep at least one capstone height (¼ of the tile) clear on
  every side.
- **Minimum size:** 16 px for the mark, 24 px tall for the lockup.
- **Colours:** the mark's colours are fixed and stay the same in light and dark
  mode. Don't recolour the stones, put the tile on an indigo background, stretch
  or rotate the mark, or add shadows, gradients or outlines.

## Colour

Brand colours:

| Name | Hex | Role |
| --- | --- | --- |
| Indigo | `#5b5bd6` | Primary brand colour; the tile; the app's primary action colour (light mode) |
| Mist | `#dcdcf7` | Middle stone; soft indigo tint |
| Amber | `#f4b860` | Capstone; the brand accent. Use it sparingly and never as a status colour |
| Ink | `#28251f` | Wordmark on light; body text |
| Stone | `#f7f6f3` | Light background |
| Charcoal | `#1f1e1c` | Dark background |
| Paper | `#ebe8e1` | Wordmark on dark; text in dark mode |

The full UI palette (surfaces, borders, status and chart colours, in both
themes) is defined as tokens in `src/app/globals.css`. Use the tokens in UI
code, not hex values.

## Typography

- **Typeface:** Inter, everywhere (loaded with `next/font`, including Vietnamese
  glyphs).
- **Wordmark:** Inter Semibold, −2% letter spacing.
- **UI scale:** page titles `text-xl md:text-2xl` semibold; section titles
  `text-base` semibold; body `text-sm`; hints `text-xs` muted; numbers use
  `tabular-nums`.

## Voice

Calm, plain and precise, like a good accountant who is on your side.

- Use sentence case for everything, including buttons, titles and labels.
- Say what happened and what happens next: "Saved on this device. It will sync
  when the server is reachable."
- Write numbers the Vietnamese way: `1.245.670.000 ₫`; compact `4,82B ₫` on
  summary cards.
- Write dates as `12 Mar 2026`, or `Mar 2026` on charts.
- Don't use hype, exclamation marks or finance jargon where a plain word works.

## Icons

- **UI icons:** unchanged; Lucide, outline style.
- **App icons:** the Cairn mark is the favicon (`src/app/icon.svg`,
  `src/app/favicon.ico`), the iOS home-screen icon (`public/apple-touch-icon.png`,
  full-bleed; iOS rounds it) and the PWA icons in `public/icons/`, where the
  maskable versions keep the stones inside the 80% safe zone.

## Internal names

Everything internal uses `cairn` too: the npm package, the database tables
(`cairn_kv`, `cairn_users`, …), the browser storage keys (`cairn:tables:v1:<user>`)
and the service-worker caches (`cairn-*`).

The rename (Oct 2026) came with its own migrations so nothing was lost:

- `db/migrations/2026-10-rename-to-cairn.sql` renames the tables, indexes and
  constraints in place and leaves old-name views for the release still running;
  `2026-10-rename-to-cairn-cleanup.sql` drops those views afterwards.
- `src/shared/lib/legacy-storage.ts` moves any `wealthtracker:*` localStorage keys to
  `cairn:*` on first load, and the service worker deletes the old `wealthtracker-*`
  caches.

The `X-WT-User` request header keeps its old abbreviation.
