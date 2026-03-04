-- Cross-thread memory for Dyia AI
-- Stores learned preferences, patterns, and facts about each user
-- so the AI can reference them in any conversation.

CREATE TABLE IF NOT EXISTS dyia_user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('preference', 'fact', 'pattern', 'instruction')),
  content TEXT NOT NULL,
  source TEXT, -- e.g. 'conversation', 'onboarding', 'system'
  confidence REAL DEFAULT 1.0, -- 0.0-1.0, decays or increases with reinforcement
  last_referenced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON dyia_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_category ON dyia_user_memory(user_id, category);

-- Prevent exact duplicate memories per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_unique ON dyia_user_memory(user_id, lower(content));

-- RLS
ALTER TABLE dyia_user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own memories" ON dyia_user_memory;
CREATE POLICY "Users can read own memories"
  ON dyia_user_memory FOR SELECT
  USING (user_id = dyia_current_user_id());

DROP POLICY IF EXISTS "Users can insert own memories" ON dyia_user_memory;
CREATE POLICY "Users can insert own memories"
  ON dyia_user_memory FOR INSERT
  WITH CHECK (user_id = dyia_current_user_id());

DROP POLICY IF EXISTS "Users can update own memories" ON dyia_user_memory;
CREATE POLICY "Users can update own memories"
  ON dyia_user_memory FOR UPDATE
  USING (user_id = dyia_current_user_id());

DROP POLICY IF EXISTS "Users can delete own memories" ON dyia_user_memory;
CREATE POLICY "Users can delete own memories"
  ON dyia_user_memory FOR DELETE
  USING (user_id = dyia_current_user_id());
