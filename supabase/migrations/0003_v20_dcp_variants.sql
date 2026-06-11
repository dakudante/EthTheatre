-- ============================================
-- ScreenRank V2.0 — DCP Variants & Aspect Ratio
-- ============================================

-- 1. DCP variants JSONB on movies (movie-level distributor spec sheet),
--    plus aspect-ratio and presentation metadata.
ALTER TABLE movies
ADD COLUMN IF NOT EXISTS dcp_variants JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS aspect_ratio_primary TEXT,
ADD COLUMN IF NOT EXISTS aspect_ratio_secondary TEXT,
ADD COLUMN IF NOT EXISTS is_variable_aspect BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS aspect_ratio_variants TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS venue_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_3d BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_hfr BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS frame_rate INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS is_upscaled BOOLEAN DEFAULT FALSE;

-- 2. Projector/screen tech fields on screens (no-op if 0002 already ran).
ALTER TABLE screens
ADD COLUMN IF NOT EXISTS projector_brand TEXT,
ADD COLUMN IF NOT EXISTS projector_model TEXT,
ADD COLUMN IF NOT EXISTS screen_brand TEXT,
ADD COLUMN IF NOT EXISTS screen_dimensions TEXT;

-- 3. Indexes for querying by DCP variant.
CREATE INDEX IF NOT EXISTS idx_movies_dcp_imax ON movies((dcp_variants->'imax'));
CREATE INDEX IF NOT EXISTS idx_movies_dcp_atmos ON movies((dcp_variants->'atmos_venue'));
CREATE INDEX IF NOT EXISTS idx_movies_dcp_epiq ON movies((dcp_variants->'epiq'));

-- 4. RLS. (CREATE POLICY has no IF NOT EXISTS in Postgres — guard via catalog.)
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'movies'
      AND policyname = 'public_read_movies'
  ) THEN
    CREATE POLICY "public_read_movies" ON movies FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'movies'
      AND policyname = 'auth_write_movies'
  ) THEN
    CREATE POLICY "auth_write_movies" ON movies
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
