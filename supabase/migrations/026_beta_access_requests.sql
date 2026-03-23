-- Beta access requests for Gmail/Google OAuth testing workflow.
-- This lets the team collect the exact Google account a tester plans to use
-- and track when that account has been added in Google Cloud Console.

CREATE TABLE IF NOT EXISTS dyia_beta_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  signup_email TEXT NOT NULL,
  google_email TEXT NOT NULL,
  business_name TEXT,
  requested_feature TEXT NOT NULL DEFAULT 'gmail_beta',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'google_added', 'invited', 'rejected')),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_clerk_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_access_requests_status_created
  ON dyia_beta_access_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_beta_access_requests_google_email
  ON dyia_beta_access_requests(google_email);

CREATE INDEX IF NOT EXISTS idx_beta_access_requests_signup_email
  ON dyia_beta_access_requests(signup_email);

DROP TRIGGER IF EXISTS update_beta_access_requests_updated_at ON dyia_beta_access_requests;

CREATE TRIGGER update_beta_access_requests_updated_at
  BEFORE UPDATE ON dyia_beta_access_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE dyia_beta_access_requests IS
  'Manual beta access intake for Gmail/Google OAuth test-user approvals.';
