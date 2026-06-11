-- ============================================================================
-- QA Round 5 response — apply migration 044 in one shot.
--
-- Paste into the Supabase SQL editor (Dashboard -> SQL -> New query -> Run)
-- for the dyia project. IDEMPOTENT and ADDITIVE — safe to run more than once.
--
-- WHY: billing routes now stamp which Stripe mode (live/test) created the
-- stored customer/subscription ids, and ignore ids from the wrong mode. This
-- prevents the test-mode data poisoning behind QA's "No such customer …
-- exists in test mode" errors. The code ships with a fallback so nothing
-- breaks before this runs — but the guard only fully engages once it has.
-- ============================================================================

ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS stripe_livemode BOOLEAN;

COMMENT ON COLUMN dyia_users.stripe_livemode IS
  'Stripe mode (true=live, false=test) that created stripe_customer_id/stripe_subscription_id. NULL = unknown (legacy).';

-- ── Verify (optional) ───────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'dyia_users' AND column_name = 'stripe_livemode';
