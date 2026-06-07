-- ─────────────────────────────────────────────────────────────────────────
-- ScreenRank — screen technical hardware fields
-- Adds projector + physical-screen detail columns to `screens`.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE screens
ADD COLUMN IF NOT EXISTS projector_brand TEXT,
ADD COLUMN IF NOT EXISTS projector_model TEXT,
ADD COLUMN IF NOT EXISTS screen_brand TEXT,
ADD COLUMN IF NOT EXISTS screen_dimensions TEXT;
