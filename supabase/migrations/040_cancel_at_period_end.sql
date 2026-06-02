-- Native in-app downgrade (Pro -> Basic at period end).
--
-- When a user cancels their subscription from inside the app, we call Stripe
-- with `cancel_at_period_end: true`: they keep Pro until the end of the period
-- they already paid for, then drop to the free Basic plan. We mirror Stripe's
-- `cancel_at_period_end` flag here so the Settings UI can show
-- "Downgrading on <date>" with an undo, without a round-trip to Stripe on
-- every render. The flag is kept in sync by the Stripe webhook
-- (customer.subscription.updated) and cleared when the user resumes or the
-- subscription is finally deleted.
ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN dyia_users.cancel_at_period_end IS
  'Mirrors the Stripe subscription cancel_at_period_end flag. TRUE means the user has scheduled a downgrade to Basic that takes effect at subscription_ends_at. Synced by the Stripe webhook; cleared on resume or final cancellation.';
