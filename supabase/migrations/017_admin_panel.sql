-- =============================================
-- 017: Admin Panel - roles + webhook event log
-- =============================================

-- 1. Add role column to dyia_users
ALTER TABLE dyia_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- Index for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_dyia_users_role ON dyia_users(role);

-- 2. Create webhook event log table for debugging
CREATE TABLE IF NOT EXISTS dyia_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_id TEXT,
  payload JSONB,
  status TEXT DEFAULT 'processed',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by source and time
CREATE INDEX IF NOT EXISTS idx_dyia_webhook_events_source ON dyia_webhook_events(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dyia_webhook_events_event_id ON dyia_webhook_events(event_id);
