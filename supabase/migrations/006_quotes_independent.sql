-- Migration: 006_quotes_independent.sql
-- Makes quotes independent first-class entities, optionally linkable to jobs.
-- Fixes: cascade delete, missing status lifecycle, dead estimate_type column.
-- Created: February 1, 2026

-- ============================================
-- 1. FIX FK: CASCADE → SET NULL
-- ============================================
-- Deleting a job should no longer destroy linked quotes.
ALTER TABLE dyia_quotes DROP CONSTRAINT IF EXISTS dyia_quotes_job_id_fkey;
ALTER TABLE dyia_quotes
  ADD CONSTRAINT dyia_quotes_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES dyia_jobs(id) ON DELETE SET NULL;

-- ============================================
-- 2. ADD STATUS LIFECYCLE TO QUOTES
-- ============================================
ALTER TABLE dyia_quotes
  ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired'));

ALTER TABLE dyia_quotes
  ADD COLUMN sent_at TIMESTAMPTZ;

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
