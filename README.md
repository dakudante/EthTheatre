# 🎬 ScreenRank

**Find the best screen for any movie** — ranked by the actual **DCP technical
specification** first (resolution, format, aspect-ratio container, audio mix),
and the room's raw **screen hardware** second. Every cinema-tech term is decoded
into plain language with hover tooltips and visual explainers.

> Think _Letterboxd meets TechRadar_, in cinematic dark mode.
> Repo: [`dakudante/EthTheatre`](https://github.com/dakudante/EthTheatre)

---

## ✨ Features

- **DCP-first ranking engine** ([`src/lib/ranking.ts`](src/lib/ranking.ts)) — a
  transparent 0–100 score with a human-readable reason for every screen. The DCP
  band is weighted ~65%, screen hardware ~30%, crowd rating ~5%.
- **DCP variant split (V2.0)** — a movie ships as several distributor builds
  (IMAX, Atmos, normal, EPIQ, Dolby Cinema…). The movie page shows **BMS-style
  tabs, one ranked section per build**, best tier first, with an "Available DCP
  formats" chip row. Each screen is matched to the best build it can physically
  present.
- **Aspect-ratio intelligence** — Flat/Scope/IMAX 1.43/IMAX 1.90/70mm/ultra-wide
  2.76, plus **variable-aspect titles** (e.g. _Dune: Part Two_ switching
  IMAX 1.90 ↔ Scope 2.39) scored as a 70/30 weighted blend. Mismatches are
  penalised (letterbox/pillarbox), and **IMAX DCPs are excluded from non-IMAX
  screens** entirely.
- **Hardware knowledge bases** — projector models (BARCO, Christie, NEC…) and
  screen brands (Harkness, STRONG MDI…) drive bonus signals for lumens, gain,
  pixel density and an estimated-brightness calc. These bonuses are **gated by
  aspect fit**, so a premium projector showing the wrong frame shape can't
  out-rank a correctly fitted average screen.
- **Movie / theatre / screen pages** with score rings, the "Master DCP
  Specification" (single-variant titles), full hardware spec sheets, and
  day-tabbed showtimes.
- **Brand-coloured format badges** — IMAX cyan, IMAX 70mm dark cyan, Dolby
  violet, Atmos light violet, EPIQ emerald, PXL orange, LUXE amber, 4DX teal,
  ScreenX indigo, Scope/Flat slate.
- **Learn hub** — a glossary of cinema-tech terms (DCP, IMAX, Dolby Atmos, laser
  projection, HDR, HFR, EPIQ…) with "at a glance" spec tables; jargon anywhere
  in the UI links here via tooltips.
- **JSON API** — `GET /api/recommendations/[movieId]?city=&format=`
  ([route](src/app/api/recommendations/[movieId]/route.ts)), Zod-validated.
- **Search**, an **admin console** (Supabase Auth), glassmorphic cards,
  film-grain texture and Framer Motion throughout.

## 🧱 Tech stack

| Layer    | Choice                                                          |
| -------- | --------------------------------------------------------------- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui    |
| Motion   | Framer Motion · Lucide icons                                    |
| Backend  | Supabase (PostgreSQL, RLS, Auth, Storage)                       |
| Validation | Zod (API + ranking input contracts)                          |
| Clients  | `@supabase/ssr` (auth/middleware) · `@supabase/supabase-js`     |
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
| `SUPABASE_SERVICE_ROLE_KEY`      | Server-only reads (see RLS note) / seeding |
| `TMDB_API_KEY`                   | TMDB v4 read-access token            |

The data layer ([`src/lib/data.ts`](src/lib/data.ts)) detects credentials at
build time and switches from sample data to live Supabase queries automatically.
`NEXT_PUBLIC_*` vars are inlined at build time, so demo vs live mode is fixed
**when you build**, not at runtime.

## 🧮 How the ranking works

The engine pairs each screen with the best **DCP variant** it can present, then
scores it. Sub-scores are 0..1, each weighted, summed and scaled to 0..100:

| Band         | Factors                                                              | Weight |
| ------------ | ------------------------------------------------------------------- | ------ |
| **DCP** (~65%) | resolution, format flags, **aspect-ratio compatibility**, audio mix, verification | 0.65 |
| **Hardware** (~30%) | projection, sound system, screen class, screen size                | 0.30 |
| **Crowd** (5%) | audience rating                                                     | 0.05 |
| _Bonuses_    | projector model, screen material, pixel density, brightness — **× aspect-fit** | +0.13 max |

A DCP-first tiebreak keeps a verified package above an unverified one when
scores are within 5 points. See the [patch history](#-database) for the
aspect-gating and variant-split rationale.

## 🗄️ Database

Run the migrations in the Supabase SQL editor (or `supabase db push`), in order:

| File | Adds |
| ---- | ---- |
| [`0001_init.sql`](supabase/migrations/0001_init.sql) | core schema, indexes, RLS policies (public read / authenticated write) |
| [`0002_screen_tech_fields.sql`](supabase/migrations/0002_screen_tech_fields.sql) | `screens.projector_brand/model`, `screen_brand`, `screen_dimensions` |
| [`0003_v20_dcp_variants.sql`](supabase/migrations/0003_v20_dcp_variants.sql) | `movies.dcp_variants` JSONB + aspect/presentation metadata, variant indexes |
| [`0004_cleanup_movies.sql`](supabase/migrations/0004_cleanup_movies.sql) | syncs legacy → canonical movie columns, renames the space-named column, marks deprecations |

[`supabase/seed.sql`](supabase/seed.sql) loads sample theatres, screens, movies,
DCPs and tech terms.

### Live schema note
The connected `EthTheatre` database evolved its own shape (integer ids,
`movie_name`/`screen_name`, `location` = city, venue-keyed `dcp_variants`). The
data layer **maps live rows onto the app's types** with legacy-column fallbacks,
so the app works before _and_ after running `0004`. Reads currently use a
**server-only client with the service-role key**
([`src/lib/supabase/admin.ts`](src/lib/supabase/admin.ts)) because the live
tables had RLS enabled without public-read policies — once you add those
policies you can switch catalogue reads back to the anon key.

## 📁 Project structure

```
src/
  app/
    movies/[id]/        # movie page: per-variant ranked tabs + Master DCP
    theatres/ screens/  # venue + screen spec sheets
    learn/ search/ admin/
    api/recommendations/[movieId]/route.ts   # Zod-validated JSON API
  components/
    variant-rankings.tsx   # BMS-style DCP-variant tabs (client)
    ranked-screen-card.tsx master-dcp-spec.tsx format-badge.tsx …
  lib/
    ranking.ts          # scoring engine, aspect compat, variant labels/tiers,
                        #   projector/screen knowledge bases
    data.ts             # data layer (live ⇆ demo), DCP-variant candidate builder
    sample-data.ts      # bundled demo dataset (full V2 metadata)
    types.ts            # Movie/Screen/Dcp + MovieDcpVariants
    tmdb.ts             # TMDB client
    supabase/           # server (auth) · admin (service-role reads) · client · middleware
supabase/
  migrations/0001…0004.sql
  seed.sql
```

## ⚠️ Windows note

This project folder name contains `&` (`Theatre&Cinema`), which breaks the
default npm `.bin` shims on Windows. The `package.json` scripts therefore call
the Next binary through `node` directly (`node node_modules/next/dist/bin/next
…`) so `npm run dev` / `build` work regardless. Renaming the folder to remove
the `&` would also resolve it.
