-- ─────────────────────────────────────────────────────────────────────────
-- ScreenRank — initial schema
-- Run via the Supabase SQL editor or `supabase db push`.
-- ─────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- THEATRES ------------------------------------------------------------------
create table if not exists theatres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  city text not null,
  lat float,
  lng float,
  images text[] default '{}',
  amenities text[] default '{}',
  description text,
  website text,
  created_at timestamptz default now()
);

-- SCREENS -------------------------------------------------------------------
create table if not exists screens (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid references theatres(id) on delete cascade not null,
  name text not null,
  screen_format text not null,
  projection_system text not null,
  sound_system text not null,
  screen_spec text,
  number_of_seats int,
  three_d_system text,
  user_rating float default 0,
  review_count int default 0,
  created_at timestamptz default now()
);

-- MOVIES --------------------------------------------------------------------
create table if not exists movies (
  id uuid primary key default gen_random_uuid(),
  tmdb_id int unique,
  title text not null,
  poster text,
  backdrop text,
  synopsis text,
  release_date date,
  duration int,
  genre text[] default '{}',
  format text[] default '{}',
  is_now_playing boolean default false,
  created_at timestamptz default now()
);

-- DCP -----------------------------------------------------------------------
create table if not exists dcps (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid references screens(id) on delete cascade not null,
  movie_id uuid references movies(id) on delete cascade not null,
  runtime int,
  resolution text not null,
  format text[] default '{}',
  aspect_ratio_container text not null,
  audio_mix text not null,
  verified boolean default false,
  source text,
  created_at timestamptz default now()
);

-- RECOMMENDED SCREENS -------------------------------------------------------
create table if not exists recommended_screens (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references movies(id) on delete cascade not null,
  screen_id uuid references screens(id) on delete cascade not null,
  rank int not null,
  score float not null,
  reason text not null,
  created_at timestamptz default now(),
  unique(movie_id, screen_id)
);

-- SHOWTIMES -----------------------------------------------------------------
create table if not exists showtimes (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid references screens(id) on delete cascade not null,
  movie_id uuid references movies(id) on delete cascade not null,
  time timestamptz not null,
  language text not null,
  format text not null,
  booking_url text,
  created_at timestamptz default now()
);

-- TECH TERMS ----------------------------------------------------------------
create table if not exists tech_terms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  short_desc text not null,
  full_desc text not null,
  specs jsonb,
  icon text not null,
  color text not null,
  related_terms text[] default '{}',
  images text[] default '{}',
  is_popular boolean default false,
  created_at timestamptz default now()
);

-- INDEXES -------------------------------------------------------------------
create index if not exists idx_screens_theatre on screens(theatre_id);
create index if not exists idx_dcps_movie on dcps(movie_id);
create index if not exists idx_dcps_screen on dcps(screen_id);
create index if not exists idx_showtimes_movie on showtimes(movie_id);
create index if not exists idx_showtimes_screen on showtimes(screen_id);
create index if not exists idx_showtimes_time on showtimes(time);
create index if not exists idx_recommended_movie on recommended_screens(movie_id);
create index if not exists idx_movies_now_playing on movies(is_now_playing);

-- ─────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Public read-only for everyone; writes restricted to authenticated editors.
-- ─────────────────────────────────────────────────────────────────────────
alter table theatres            enable row level security;
alter table screens             enable row level security;
alter table movies              enable row level security;
alter table dcps                enable row level security;
alter table recommended_screens enable row level security;
alter table showtimes           enable row level security;
alter table tech_terms          enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'theatres','screens','movies','dcps',
    'recommended_screens','showtimes','tech_terms'
  ]
  loop
    execute format(
      'create policy "public_read_%1$s" on %1$s for select using (true);', t);
    execute format(
      'create policy "auth_write_%1$s" on %1$s for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;
