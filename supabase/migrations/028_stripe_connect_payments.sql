-- Stripe Connect + customer payment collection

ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_country TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_default_currency TEXT;

ALTER TABLE dyia_quotes
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (payment_status IN ('not_requested', 'pending', 'paid', 'failed', 'expired', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;

ALTER TABLE dyia_jobs
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (payment_status IN ('not_requested', 'pending', 'paid', 'failed', 'expired', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS payment_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS dyia_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES dyia_quotes(id) ON DELETE SET NULL,
  job_id UUID REFERENCES dyia_jobs(id) ON DELETE SET NULL,
  public_token TEXT NOT NULL UNIQUE,
  stripe_connected_account_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'checkout_created', 'paid', 'failed', 'expired', 'refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  application_fee_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (application_fee_amount_cents >= 0),
  destination_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (destination_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  customer_name TEXT,
  customer_email TEXT,
  description TEXT,
  checkout_url TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dyia_payments_single_resource CHECK (num_nonnulls(quote_id, job_id) = 1)
);

ALTER TABLE dyia_quotes
  ADD COLUMN IF NOT EXISTS payment_last_request_id UUID REFERENCES dyia_payments(id) ON DELETE SET NULL;

ALTER TABLE dyia_jobs
  ADD COLUMN IF NOT EXISTS payment_last_request_id UUID REFERENCES dyia_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dyia_users_connect_account_id
  ON dyia_users(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dyia_payments_user_id ON dyia_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_dyia_payments_quote_id ON dyia_payments(quote_id) WHERE quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dyia_payments_job_id ON dyia_payments(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dyia_payments_status ON dyia_payments(status);
CREATE INDEX IF NOT EXISTS idx_dyia_payments_created_at ON dyia_payments(created_at DESC);

ALTER TABLE dyia_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON dyia_payments FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Service role full access payments"
  ON dyia_payments FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION dyia_set_payment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dyia_payments_updated_at ON dyia_payments;
CREATE TRIGGER trg_dyia_payments_updated_at
  BEFORE UPDATE ON dyia_payments
  FOR EACH ROW
  EXECUTE FUNCTION dyia_set_payment_updated_at();
