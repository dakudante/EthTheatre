-- ============================================
-- ScreenRank — movies table cleanup
-- Old (movie_name/runtime/formats/…) and new (title/duration/format/…)
-- columns coexist. Sync data into the new columns, rename the
-- space-containing legacy column, and mark old columns deprecated.
-- ============================================

-- Step 1: movie_name → title (where title is empty)
UPDATE movies
SET title = movie_name
WHERE (title IS NULL OR title = '') AND movie_name IS NOT NULL;

-- Step 2: runtime → duration (where duration is null)
UPDATE movies
SET duration = runtime
WHERE duration IS NULL AND runtime IS NOT NULL;

-- Step 3: formats (single text) → format (text[]) where empty
UPDATE movies
SET format = ARRAY[formats]
WHERE formats IS NOT NULL AND (format IS NULL OR format = '{}');

-- Step 4: rename the legacy column with a space in its name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'movies'
      AND column_name = 'aspect_ratio and container_format'
  ) THEN
    ALTER TABLE movies
      RENAME COLUMN "aspect_ratio and container_format" TO aspect_ratio_legacy;
  END IF;
END $$;

-- Step 5: document deprecations. The app reads the new columns (with
-- fallbacks); drop the old ones once you've confirmed everything is migrated:
--   ALTER TABLE movies DROP COLUMN IF EXISTS movie_name;
--   ALTER TABLE movies DROP COLUMN IF EXISTS runtime;
--   ALTER TABLE movies DROP COLUMN IF EXISTS resolution;
--   ALTER TABLE movies DROP COLUMN IF EXISTS audio_mix;
--   ALTER TABLE movies DROP COLUMN IF EXISTS formats;
--   ALTER TABLE movies DROP COLUMN IF EXISTS aspect_ratio_legacy;
COMMENT ON COLUMN movies.movie_name IS 'DEPRECATED: use title';
COMMENT ON COLUMN movies.runtime IS 'DEPRECATED: use duration';
COMMENT ON COLUMN movies.resolution IS 'DEPRECATED: use dcp_variants';
COMMENT ON COLUMN movies.audio_mix IS 'DEPRECATED: use dcp_variants';
COMMENT ON COLUMN movies.formats IS 'DEPRECATED: use format';
COMMENT ON COLUMN movies.aspect_ratio_legacy IS 'DEPRECATED: use aspect_ratio_primary';
