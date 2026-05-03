-- Round 4 fix (BUG-022): track when an invoice first fails so we can apply
-- a 7-day dunning grace window before locking Pro features. Cleared by the
-- Stripe webhook on `invoice.paid` (recovery) or when the subscription
-- transitions back to `active`.
ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;

COMMENT ON COLUMN dyia_users.payment_failed_at IS
  'First-failure timestamp set on Stripe invoice.payment_failed. Cleared on recovery. Drives the 7-day dunning grace window for Pro feature access.';

-- Index used by the admin dashboard and any cron that wants to nudge
-- customers in the dunning window before Pro features actually lock.
CREATE INDEX IF NOT EXISTS idx_dyia_users_payment_failed_at
  ON dyia_users(payment_failed_at)
  WHERE payment_failed_at IS NOT NULL;
