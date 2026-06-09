-- ============================================================================
-- Dyia Maps — apply migration 043 in one shot.
--
-- Paste this whole file into the Supabase SQL editor (Dashboard -> SQL -> New
-- query -> Run) for the dyia project. It is IDEMPOTENT and ADDITIVE — safe to
-- run more than once; it only adds columns/indexes that don't already exist.
--
-- WHY THIS IS REQUIRED: the Job form now writes `latitude`/`longitude` when the
-- user picks an address from Google Places autocomplete, and the Maps tab reads
-- them to draw pins. Until these columns exist, saving a job with an address
-- selected from autocomplete will fail on the coordinate write.
-- ============================================================================

ALTER TABLE dyia_jobs
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN dyia_jobs.latitude IS 'Cached latitude from Google Places autocomplete, for the Maps view.';
COMMENT ON COLUMN dyia_jobs.longitude IS 'Cached longitude from Google Places autocomplete, for the Maps view.';

CREATE INDEX IF NOT EXISTS idx_dyia_jobs_geo
  ON dyia_jobs(user_id)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ── Verify (optional) ───────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'dyia_jobs' AND column_name IN ('latitude','longitude')
-- ORDER BY column_name;

-- ── Environment ─────────────────────────────────────────────────────────────
-- Add a browser-restricted Google Maps JavaScript API key to the app env:
--   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
-- Enable in Google Cloud Console: "Maps JavaScript API" + "Places API".
-- Restrict the key to the dyia.co domain (HTTP referrers) so it can't be reused.
