-- Migration: 006_quotes_independent.sql
-- Makes quotes independent first-class entities, optionally linkable to jobs.
-- Fixes: cascade delete, missing status lifecycle, dead estimate_type column.
-- Created: February 1, 2026

-- ============================================
-- 1. ADD JOB_ID IF NOT EXISTS + FIX FK: CASCADE → SET NULL
-- ============================================
-- First ensure the column exists (idempotent with 004)
ALTER TABLE dyia_quotes ADD COLUMN IF NOT EXISTS job_id UUID;

-- Drop old constraint if exists, then add with SET NULL behavior
-- Deleting a job should no longer destroy linked quotes.
ALTER TABLE dyia_quotes DROP CONSTRAINT IF EXISTS dyia_quotes_job_id_fkey;
ALTER TABLE dyia_quotes
  ADD CONSTRAINT dyia_quotes_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES dyia_jobs(id) ON DELETE SET NULL;

-- Create index if not exists (idempotent with 004)
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON dyia_quotes(job_id) WHERE job_id IS NOT NULL;

-- ============================================
-- 2. ADD STATUS LIFECYCLE TO QUOTES
-- ============================================
ALTER TABLE dyia_quotes
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Add check constraint separately (drop first if exists for idempotency)
ALTER TABLE dyia_quotes DROP CONSTRAINT IF EXISTS dyia_quotes_status_check;
ALTER TABLE dyia_quotes
  ADD CONSTRAINT dyia_quotes_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired'));

-- Set NOT NULL after ensuring all rows have a value
UPDATE dyia_quotes SET status = 'draft' WHERE status IS NULL;
ALTER TABLE dyia_quotes ALTER COLUMN status SET NOT NULL;
ALTER TABLE dyia_quotes ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE dyia_quotes
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- ============================================
-- 3. DROP DEAD COLUMN
-- ============================================
ALTER TABLE dyia_quotes DROP COLUMN IF EXISTS estimate_type;

-- ============================================
-- 4. NEW INDEXES
-- ============================================
-- Main listing query: all quotes for a user filtered by status
CREATE INDEX IF NOT EXISTS idx_quotes_user_status
  ON dyia_quotes(user_id, status, created_at DESC);

-- Customer-name search for "link to job" UI
CREATE INDEX IF NOT EXISTS idx_quotes_user_customer
  ON dyia_quotes(user_id, lower(customer_name));
