-- ============================================
-- ScreenRank — screen scoring inputs
-- Adds the columns that were inert for live data:
--   • user_rating / review_count  (5% of the ranking formula)
--   • number_of_seats / three_d_system (display + showtime format)
--   • screen_width_ft / screen_height_ft (structured size → 2% screen-size score)
-- and backfills the numeric size from the free-text screen_dimensions.
-- ============================================

ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS user_rating     float   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count    int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS number_of_seats int,
  ADD COLUMN IF NOT EXISTS three_d_system  text,
  ADD COLUMN IF NOT EXISTS screen_width_ft  numeric,
  ADD COLUMN IF NOT EXISTS screen_height_ft numeric;

-- Backfill width/height from "72 x 31 ft"-style screen_dimensions.
UPDATE screens
SET
  screen_width_ft  = (regexp_match(screen_dimensions, '(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)'))[1]::numeric,
  screen_height_ft = (regexp_match(screen_dimensions, '(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)'))[2]::numeric
WHERE screen_dimensions IS NOT NULL
  AND screen_dimensions ~ '(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)'
  AND screen_width_ft IS NULL;

-- The app reads these columns with fallbacks, so it works before AND after this
-- migration runs. Populate user_rating / review_count from real audience data
-- (and number_of_seats / three_d_system) as it becomes available.
