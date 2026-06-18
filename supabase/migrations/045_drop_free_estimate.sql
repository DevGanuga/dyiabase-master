-- Retire the unused "free estimate" scheduled-job kind.
-- The product only distinguishes scheduled jobs from estimate visits now, so any
-- legacy rows are folded into 'estimate' and the CHECK constraint is tightened.

UPDATE dyia_jobs
SET scheduled_kind = 'estimate'
WHERE scheduled_kind = 'free_estimate';

-- Drop the original inline constraint from migration 024 (Postgres names inline
-- column CHECKs as <table>_<column>_check) and re-add the tightened version.
ALTER TABLE dyia_jobs
DROP CONSTRAINT IF EXISTS dyia_jobs_scheduled_kind_check;

ALTER TABLE dyia_jobs
ADD CONSTRAINT dyia_jobs_scheduled_kind_check
CHECK (scheduled_kind IN ('job', 'estimate'));

COMMENT ON COLUMN dyia_jobs.scheduled_kind IS 'Scheduled job type: job or estimate.';
