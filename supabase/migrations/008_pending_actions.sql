-- Migration: Pending Actions persistence
-- Allows users to save pending job/quote proposals and continue later

CREATE TABLE IF NOT EXISTS dyia_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES dyia_threads(id) ON DELETE SET NULL,
  
  -- Action type and data
  action_type TEXT NOT NULL CHECK (action_type IN ('create_job', 'generate_quote', 'log_expense')),
  proposal_data JSONB NOT NULL,
  
  -- Context
  original_message TEXT, -- The user message that triggered this
  ai_response TEXT, -- Dyia's response summary
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') -- Auto-expire after 7 days
);

-- Partial unique index: only one pending action per user/thread combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_per_thread 
  ON dyia_pending_actions(user_id, thread_id) 
  WHERE status = 'pending';

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pending_actions_user_status 
  ON dyia_pending_actions(user_id, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_actions_expires 
  ON dyia_pending_actions(expires_at) 
  WHERE status = 'pending';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_pending_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pending_actions_updated_at
  BEFORE UPDATE ON dyia_pending_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_actions_updated_at();

-- RLS policies
ALTER TABLE dyia_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending actions"
  ON dyia_pending_actions FOR SELECT
  USING (user_id IN (SELECT id FROM dyia_users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can insert own pending actions"
  ON dyia_pending_actions FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM dyia_users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can update own pending actions"
  ON dyia_pending_actions FOR UPDATE
  USING (user_id IN (SELECT id FROM dyia_users WHERE clerk_user_id = auth.uid()::text));

CREATE POLICY "Users can delete own pending actions"
  ON dyia_pending_actions FOR DELETE
  USING (user_id IN (SELECT id FROM dyia_users WHERE clerk_user_id = auth.uid()::text));
