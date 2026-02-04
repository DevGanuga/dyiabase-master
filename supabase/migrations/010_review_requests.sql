-- Review request tracking: when user requested a review from a customer (for Pro review request feature)
CREATE TABLE IF NOT EXISTS dyia_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES dyia_quotes(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_user ON dyia_review_requests(user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_requests_quote ON dyia_review_requests(quote_id);
