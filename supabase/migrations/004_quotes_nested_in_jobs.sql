-- Migration: 004_quotes_nested_in_jobs.sql
-- Nests quotes within jobs - quotes are now associated with specific jobs
-- Created: January 31, 2026

-- ============================================
-- ADD JOB_ID TO QUOTES
-- ============================================

-- Add job_id column to dyia_quotes (nullable for backward compatibility with existing quotes)
ALTER TABLE dyia_quotes 
ADD COLUMN job_id UUID REFERENCES dyia_jobs(id) ON DELETE CASCADE;

-- Create index for job-based quote lookups
CREATE INDEX idx_quotes_job_id ON dyia_quotes(job_id) WHERE job_id IS NOT NULL;

-- ============================================
-- UPDATE EXISTING QUOTES (OPTIONAL)
-- ============================================
-- This comment block shows how to migrate existing quotes to jobs
-- You can run this manually if needed:
--
-- For each quote without a job_id, try to match by customer_name to an existing job:
-- UPDATE dyia_quotes q
-- SET job_id = (
--   SELECT j.id FROM dyia_jobs j 
--   WHERE j.user_id = q.user_id 
--   AND LOWER(j.customer_name) = LOWER(q.customer_name)
--   ORDER BY j.date DESC
--   LIMIT 1
-- )
-- WHERE q.job_id IS NULL;
