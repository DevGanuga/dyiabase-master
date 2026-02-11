-- Add status and address to jobs for scheduling and location tracking
-- Status: scheduled (future), in_progress, completed (default), cancelled

-- Add status column with default 'completed' so existing jobs don't break
ALTER TABLE dyia_jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'
  CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled'));

-- Add address column
ALTER TABLE dyia_jobs ADD COLUMN IF NOT EXISTS address TEXT;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_dyia_jobs_status ON dyia_jobs(user_id, status);

-- Index for upcoming jobs (scheduled jobs ordered by date)
CREATE INDEX IF NOT EXISTS idx_dyia_jobs_upcoming ON dyia_jobs(user_id, date) WHERE status = 'scheduled';
