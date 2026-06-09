-- Dyia Maps — cache geocoordinates on jobs so the Maps view can render pins
-- without re-geocoding every address on every load.
--
-- Coordinates are captured silently when the user picks an address from the
-- Google Places autocomplete on the Job form (one geocode forever, not one per
-- render). Existing jobs with an address but no coordinates are backfilled
-- lazily the first time their owner opens the Maps tab.

ALTER TABLE dyia_jobs
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN dyia_jobs.latitude IS 'Cached latitude from Google Places autocomplete, for the Maps view.';
COMMENT ON COLUMN dyia_jobs.longitude IS 'Cached longitude from Google Places autocomplete, for the Maps view.';

-- Partial index: the Maps view only ever queries jobs that already have a pin.
CREATE INDEX IF NOT EXISTS idx_dyia_jobs_geo
  ON dyia_jobs(user_id)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
