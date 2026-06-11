-- QA Round 5: Stripe live/test mode guard.
--
-- Branch/QA environments running test-mode Stripe keys against this shared
-- database wrote test-mode customer/subscription ids onto user rows, which the
-- live key cannot resolve ("No such customer … exists in test mode").
--
-- `stripe_livemode` records which Stripe mode created the ids stored on the
-- row. Application code ignores stored ids whose mode doesn't match the
-- running key, and the webhook drops events from the wrong mode.
-- NULL = legacy row (mode unknown) — treated as matching for compatibility.

ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS stripe_livemode BOOLEAN;

COMMENT ON COLUMN dyia_users.stripe_livemode IS
  'Stripe mode (true=live, false=test) that created stripe_customer_id/stripe_subscription_id. NULL = unknown (legacy).';
