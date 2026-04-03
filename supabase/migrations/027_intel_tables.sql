-- Intel competitive intelligence tables
-- Supports both public page scans and CRM monthly auto-scans

CREATE TABLE IF NOT EXISTS dyia_intel_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE SET NULL,
  email TEXT,
  business_name TEXT NOT NULL,
  website_url TEXT,
  zip_code TEXT NOT NULL,
  industry TEXT NOT NULL,
  radius_miles INTEGER NOT NULL DEFAULT 25,
  scan_data JSONB,
  action_plan JSONB,
  stripe_session_id TEXT,
  action_plan_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL CHECK (source IN ('public_page', 'crm_monthly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_scans_user_id ON dyia_intel_scans(user_id);
CREATE INDEX idx_intel_scans_email ON dyia_intel_scans(email);
CREATE INDEX idx_intel_scans_stripe_session ON dyia_intel_scans(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX idx_intel_scans_source ON dyia_intel_scans(source);

CREATE TABLE IF NOT EXISTS dyia_intel_monthly_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  scan_id UUID REFERENCES dyia_intel_scans(id) ON DELETE SET NULL,
  job_status TEXT NOT NULL DEFAULT 'pending' CHECK (job_status IN ('pending', 'running', 'complete', 'failed')),
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_year)
);

CREATE INDEX idx_intel_monthly_user ON dyia_intel_monthly_status(user_id);
CREATE INDEX idx_intel_monthly_status ON dyia_intel_monthly_status(job_status);

-- RLS policies
ALTER TABLE dyia_intel_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyia_intel_monthly_status ENABLE ROW LEVEL SECURITY;

-- Users can read their own scans
CREATE POLICY "Users can view own intel scans"
  ON dyia_intel_scans FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

-- Users can read their own monthly status
CREATE POLICY "Users can view own monthly status"
  ON dyia_intel_monthly_status FOR SELECT
  USING (auth.uid()::text = user_id::text);

-- Service role can do everything (for API routes using service role key)
CREATE POLICY "Service role full access intel scans"
  ON dyia_intel_scans FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access monthly status"
  ON dyia_intel_monthly_status FOR ALL
  USING (auth.role() = 'service_role');
