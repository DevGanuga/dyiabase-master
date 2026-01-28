-- Migration: 003_mvp_sprint.sql
-- Sprint 1-3 database changes
-- Created: January 28, 2026

-- ============================================
-- FIXED EXPENSES
-- ============================================
CREATE TABLE dyia_fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
  category VARCHAR(50) DEFAULT 'other',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fixed_expenses_user_id ON dyia_fixed_expenses(user_id);
CREATE INDEX idx_fixed_expenses_active ON dyia_fixed_expenses(user_id, is_active);

-- ============================================
-- FOLLOW-UPS
-- ============================================
CREATE TABLE dyia_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES dyia_quotes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'converted', 'lost', 'snoozed')),
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  notes TEXT,
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_user_id ON dyia_follow_ups(user_id);
CREATE INDEX idx_follow_ups_quote_id ON dyia_follow_ups(quote_id);
CREATE INDEX idx_follow_ups_status ON dyia_follow_ups(status);
CREATE UNIQUE INDEX idx_follow_ups_unique_quote ON dyia_follow_ups(quote_id) WHERE status NOT IN ('converted', 'lost');

-- ============================================
-- PRICE TEMPLATES
-- ============================================
CREATE TABLE dyia_price_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  prices JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_templates_user_id ON dyia_price_templates(user_id);

-- ============================================
-- AI THREADS
-- ============================================
CREATE TABLE dyia_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  openai_thread_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) DEFAULT 'New Conversation',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threads_user_id ON dyia_threads(user_id);
CREATE INDEX idx_threads_last_message ON dyia_threads(last_message_at DESC);

-- ============================================
-- AI MESSAGES
-- ============================================
CREATE TABLE dyia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES dyia_threads(id) ON DELETE CASCADE,
  openai_message_id VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_thread_id ON dyia_messages(thread_id);
CREATE INDEX idx_messages_created_at ON dyia_messages(created_at);

-- ============================================
-- AI INSIGHTS CACHE
-- ============================================
CREATE TABLE dyia_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  report_data JSONB NOT NULL,
  data_hash VARCHAR(64),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 week'
);

CREATE INDEX idx_insights_cache_user_id ON dyia_insights_cache(user_id);
CREATE INDEX idx_insights_cache_type ON dyia_insights_cache(report_type);

-- ============================================
-- EMAIL LOGS
-- ============================================
CREATE TABLE dyia_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE SET NULL,
  email_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  resend_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'sent',
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_logs_user_id ON dyia_email_logs(user_id);
CREATE INDEX idx_email_logs_type ON dyia_email_logs(email_type);

-- ============================================
-- USER PREFERENCES (alter existing table)
-- ============================================
ALTER TABLE dyia_settings ADD COLUMN IF NOT EXISTS
  email_preferences JSONB DEFAULT '{
    "weeklyInsights": true,
    "followUpReminders": true,
    "productUpdates": true,
    "marketingEmails": false
  }';

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fixed_expenses_updated_at
  BEFORE UPDATE ON dyia_fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at
  BEFORE UPDATE ON dyia_follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_templates_updated_at
  BEFORE UPDATE ON dyia_price_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at
  BEFORE UPDATE ON dyia_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
