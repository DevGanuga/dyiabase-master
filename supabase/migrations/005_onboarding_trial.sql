-- Migration: Add onboarding tracking and auto-trial support
-- Created: 2026-01-31

-- Add onboarding tracking columns to dyia_settings
ALTER TABLE dyia_settings 
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN dyia_settings.onboarding_completed IS 'Whether the user has completed the onboarding wizard';
COMMENT ON COLUMN dyia_settings.onboarding_skipped IS 'Whether the user skipped the onboarding wizard';
COMMENT ON COLUMN dyia_settings.onboarding_completed_at IS 'Timestamp when onboarding was completed';
COMMENT ON COLUMN dyia_settings.metadata IS 'Additional user/business metadata (business_type, team_size, referral_source, etc.)';

-- Note: Trial assignment (subscription_status = 'trialing', subscription_ends_at) 
-- is handled in the API routes (/api/user/init and /api/clerk/webhook)
