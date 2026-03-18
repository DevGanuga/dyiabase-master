ALTER TABLE dyia_jobs
ADD COLUMN IF NOT EXISTS appointment_window_text TEXT;

ALTER TABLE dyia_jobs
ADD COLUMN IF NOT EXISTS scheduled_kind TEXT DEFAULT 'job'
CHECK (scheduled_kind IN ('job', 'estimate', 'free_estimate'));

COMMENT ON COLUMN dyia_jobs.appointment_window_text IS 'Freeform appointment time window for scheduled jobs, e.g. 1:30-2:30pm.';
COMMENT ON COLUMN dyia_jobs.scheduled_kind IS 'Scheduled job type: job, estimate, or free_estimate.';

CREATE INDEX IF NOT EXISTS idx_dyia_jobs_schedule_window
  ON dyia_jobs(user_id, date, scheduled_kind)
  WHERE status = 'scheduled';
