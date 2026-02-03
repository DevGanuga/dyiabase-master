-- Migration 007: Job Embeddings for Semantic Search
-- Enables pgvector for similarity search on job descriptions
-- Part of Dyia Intelligence Enhancement

-- Enable pgvector extension (Supabase has this built-in)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to jobs table
ALTER TABLE dyia_jobs ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE dyia_jobs ADD COLUMN IF NOT EXISTS embedding_text TEXT;

-- Vector similarity index for fast cosine similarity search
-- Using ivfflat index with 100 lists (good for up to ~100k rows per user)
CREATE INDEX IF NOT EXISTS idx_jobs_embedding 
  ON dyia_jobs USING ivfflat (embedding vector_cosine_ops) 
  WITH (lists = 100);

-- User patterns cache table for storing computed analytics
CREATE TABLE IF NOT EXISTS dyia_user_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL, -- 'pricing', 'sources', 'timing', 'margins'
  pattern_data JSONB NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pattern_type)
);

-- Index for fast pattern lookups
CREATE INDEX IF NOT EXISTS idx_user_patterns_user_type 
  ON dyia_user_patterns(user_id, pattern_type);

-- Function to find similar jobs using vector similarity
-- Returns jobs that match the query embedding above a threshold
CREATE OR REPLACE FUNCTION match_jobs(
  query_embedding vector(1536),
  match_user_id UUID,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.5
) RETURNS TABLE (
  id UUID,
  customer_name TEXT,
  notes TEXT,
  revenue NUMERIC,
  profit_margin NUMERIC,
  date DATE,
  source TEXT,
  similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.customer_name,
    j.notes,
    j.revenue,
    CASE 
      WHEN j.revenue > 0 THEN
        ((j.revenue - COALESCE(j.labor, 0) - COALESCE(j.gas, 0) - COALESCE(j.dump_fee, 0) - COALESCE(j.dumpster_rental, 0) - COALESCE(j.additional_expense, 0)) / j.revenue * 100)
      ELSE 0
    END as profit_margin,
    j.date,
    j.source,
    (1 - (j.embedding <=> query_embedding))::FLOAT as similarity
  FROM dyia_jobs j
  WHERE j.user_id = match_user_id
    AND j.embedding IS NOT NULL
    AND (1 - (j.embedding <=> query_embedding)) > match_threshold
  ORDER BY j.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION match_jobs IS 'Finds similar jobs based on vector embedding similarity. Used by Dyia AI for pricing suggestions and pattern learning.';
COMMENT ON TABLE dyia_user_patterns IS 'Caches computed business patterns for each user (pricing averages, source performance, etc.)';
