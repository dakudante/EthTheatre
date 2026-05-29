# 🎬 ScreenRank

**Find the best screen for any movie** — ranked by the actual **DCP technical
specification** first (resolution, format, aspect-ratio container, audio mix),
and the room's raw **screen hardware** second. Every cinema-tech term is decoded
into plain language with hover tooltips and visual explainers.

> Think _Letterboxd meets TechRadar_, in cinematic dark mode.

## ✨ Features

- **DCP-first ranking engine** — a transparent 0–100 score with a human-readable
  reason for every screen ([`src/lib/ranking.ts`](src/lib/ranking.ts)). DCP
  fidelity is weighted ~60%, hardware ~35%, crowd rating ~5%.
- **Movie pages** with ranked screens, score rings, verified-DCP badges, spec
  grids, and day-tabbed showtimes.
- **Theatre & screen pages** with full technical spec sheets.
- **Learn hub** — a glossary of cinema-tech terms (DCP, IMAX, Dolby Atmos, laser
  projection, HDR, HFR, EPIQ…) with "at a glance" spec tables and related terms.
  Jargon anywhere in the UI links here via tooltips.
- **Search** across movies, theatres and tech terms.
- **Admin console** (Supabase Auth, email/password) with a catalogue overview.
- **Format-aware neon accents:** amber (premium), cyan (IMAX), violet (Dolby),
  emerald (EPIQ/PXL) — glassmorphic cards, film-grain texture, Framer Motion.

## 🧱 Tech stack

| Layer    | Choice                                                          |
| -------- | --------------------------------------------------------------- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui    |
| Motion   | Framer Motion · Lucide icons                                    |
| Backend  | Supabase (PostgreSQL, RLS, Auth, Storage)                       |
| Clients  | `@supabase/ssr` (server/middleware) · `@supabase/supabase-js`   |
| External | TMDB API for movie metadata                                     |

## 🚀 Getting started

```bash
npm install
npm run dev      # served on http://localhost:3210 (see .claude/launch.json)
```

The app boots in **demo mode** with a bundled sample dataset
([`src/lib/sample-data.ts`](src/lib/sample-data.ts)) — fully explorable with **no
configuration**. To go live, add credentials:

```bash
cp .env.local.example .env.local   # then fill in your keys
```

| Variable                         | Purpose                              |
| -------------------------------- | ------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anon key                    |
| `SUPABASE_SERVICE_ROLE_KEY`      | Server-only writes / seeding         |
| `TMDB_API_KEY`                   | TMDB v4 read-access token            |

When real Supabase credentials are present the data layer
([`src/lib/data.ts`](src/lib/data.ts)) switches from the sample data to live
queries automatically, and `/admin` requires authentication.

## 🗄️ Database

In the Supabase SQL editor (or via `supabase db push` / `supabase db reset`):

1. `supabase/migrations/0001_init.sql` — schema, indexes, RLS policies
2. `supabase/seed.sql` — sample theatres, screens, movies, DCPs, tech terms

RLS grants **public read** on all tables and **write to authenticated users**.

## 📁 Project structure

```
src/
  app/                 # App Router pages (home, movies, theatres, screens, learn, search, admin)
  components/          # UI primitives (ui/) + ScreenRank components
  lib/
    ranking.ts         # the DCP-first scoring engine
    data.ts            # data layer (Supabase ⇆ demo fallback)
    sample-data.ts     # bundled demo dataset
    tmdb.ts            # TMDB client
    supabase/          # server / client / middleware
supabase/
  migrations/0001_init.sql
  seed.sql
```

## ⚠️ Windows note

This project folder name contains `&` (`Theatre&Cinema`), which breaks the
default npm `.bin` shims on Windows. The `package.json` scripts therefore call
the Next binary through `node` directly (`node node_modules/next/dist/bin/next
…`) so `npm run dev` / `build` work regardless. Renaming the folder to remove
the `&` would also resolve it.
