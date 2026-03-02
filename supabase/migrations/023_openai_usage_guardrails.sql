-- OpenAI usage log for daily budget and alert threshold guardrails.
-- Only the backend (service role) should insert/select; no user-facing access.

CREATE TABLE IF NOT EXISTS dyia_openai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  cost_estimate_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'chat'
);

CREATE INDEX IF NOT EXISTS idx_openai_usage_created_at ON dyia_openai_usage(created_at DESC);

COMMENT ON TABLE dyia_openai_usage IS 'Log of OpenAI API usage for daily budget and alert threshold guardrails. Backend only.';
