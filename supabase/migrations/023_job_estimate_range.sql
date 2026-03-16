ALTER TABLE dyia_jobs
ADD COLUMN IF NOT EXISTS estimate_low NUMERIC(10, 2);

ALTER TABLE dyia_jobs
ADD COLUMN IF NOT EXISTS estimate_high NUMERIC(10, 2);

COMMENT ON COLUMN dyia_jobs.estimate_low IS 'Optional low-end estimate captured when scheduling a future job.';
COMMENT ON COLUMN dyia_jobs.estimate_high IS 'Optional high-end estimate captured when scheduling a future job.';
