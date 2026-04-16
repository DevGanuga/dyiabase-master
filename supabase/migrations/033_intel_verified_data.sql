ALTER TABLE dyia_intel_scans
ADD COLUMN IF NOT EXISTS verified_data JSONB;
