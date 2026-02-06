-- Migration: 012_mass_email.sql
-- Mass Email Blast Feature: OAuth connections and send tracking
-- Created: February 2026

-- ============================================
-- 1. EMAIL CONNECTIONS (OAuth tokens)
-- ============================================
CREATE TABLE IF NOT EXISTS dyia_email_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  email_address VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- One active connection per provider per user
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_email_connections_user ON dyia_email_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_active ON dyia_email_connections(user_id, is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER update_email_connections_updated_at
  BEFORE UPDATE ON dyia_email_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. EMAIL SENDS TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS dyia_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES dyia_email_connections(id) ON DELETE SET NULL,
  campaign_id UUID,  -- Groups emails from same blast
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body_preview TEXT,  -- First 200 chars of body
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  provider_message_id VARCHAR(255),  -- Gmail/Outlook message ID
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_sends_user ON dyia_email_sends(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON dyia_email_sends(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_sends_recipient ON dyia_email_sends(user_id, recipient_email);

-- ============================================
-- 3. EMAIL CAMPAIGNS (for grouping blasts)
-- ============================================
CREATE TABLE IF NOT EXISTS dyia_email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_user ON dyia_email_campaigns(user_id, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON dyia_email_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
