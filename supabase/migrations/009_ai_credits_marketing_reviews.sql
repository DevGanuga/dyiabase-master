-- Migration: 009_ai_credits_marketing_reviews.sql
-- Pre-Launch Features: AI Credits, Marketing ROI, Review Requests
-- Created: February 2026

-- ============================================
-- 1. AI CREDITS: Add columns to dyia_users
-- ============================================
ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS ai_credits_balance INTEGER DEFAULT 0 CHECK (ai_credits_balance >= 0);

ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS ai_credits_used_lifetime INTEGER DEFAULT 0;

-- ============================================
-- 2. CREDIT TRANSACTIONS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS dyia_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('purchase', 'usage', 'grant', 'refund')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  stripe_payment_id VARCHAR(255),
  message_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON dyia_credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON dyia_credit_transactions(user_id, type);

-- ============================================
-- 3. MARKETING SPEND TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS dyia_marketing_spend (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  source VARCHAR(100) NOT NULL,
  month DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source, month)
);

CREATE INDEX IF NOT EXISTS idx_marketing_spend_user ON dyia_marketing_spend(user_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_spend_source ON dyia_marketing_spend(user_id, source);

-- Trigger for updated_at
CREATE TRIGGER update_marketing_spend_updated_at
  BEFORE UPDATE ON dyia_marketing_spend
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. QUOTE 'COMPLETED' STATUS
-- ============================================
-- Update the check constraint to include 'completed'
ALTER TABLE dyia_quotes DROP CONSTRAINT IF EXISTS dyia_quotes_status_check;
ALTER TABLE dyia_quotes
  ADD CONSTRAINT dyia_quotes_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'completed'));

-- ============================================
-- 5. REVIEW URL IN SETTINGS
-- ============================================
ALTER TABLE dyia_settings ADD COLUMN IF NOT EXISTS review_url TEXT;

-- ============================================
-- 6. CREDIT COST ON MESSAGES
-- ============================================
-- tokens_used column already exists but is never populated
-- Add credit_cost column to track actual credit deduction
ALTER TABLE dyia_messages
  ADD COLUMN IF NOT EXISTS credit_cost INTEGER DEFAULT 0;
