-- Cancellation feedback + admin data hygiene
--
-- Capture optional feedback when a user schedules a downgrade/cancellation so
-- Marco can understand churn reasons and retarget lost accounts later.
-- Also add durable test-account flags so admin metrics can exclude seeded/demo
-- data without deleting historical rows.

ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS account_label TEXT,
  ADD COLUMN IF NOT EXISTS account_notes TEXT;

COMMENT ON COLUMN dyia_users.is_test_account IS
  'TRUE for demo/test/internal accounts that should be excluded from launch metrics by default.';

COMMENT ON COLUMN dyia_users.account_label IS
  'Short admin-facing label such as test, demo, internal, or founder.';

CREATE INDEX IF NOT EXISTS idx_dyia_users_is_test_account
  ON dyia_users(is_test_account);

CREATE TABLE IF NOT EXISTS dyia_cancellation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE SET NULL,
  clerk_user_id TEXT,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  subscription_tier TEXT,
  subscription_plan TEXT,
  cancellation_type TEXT NOT NULL DEFAULT 'user_scheduled'
    CHECK (cancellation_type IN ('user_scheduled', 'admin_scheduled', 'admin_immediate', 'no_subscription')),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT TRUE,
  scheduled_ends_at TIMESTAMPTZ,
  reason TEXT,
  liked TEXT,
  disliked TEXT,
  notes TEXT,
  retargeting_status TEXT NOT NULL DEFAULT 'new'
    CHECK (retargeting_status IN ('new', 'contacted', 'won_back', 'not_fit', 'do_not_contact')),
  retargeting_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dyia_cancellation_feedback_created_at
  ON dyia_cancellation_feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dyia_cancellation_feedback_user_id
  ON dyia_cancellation_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_dyia_cancellation_feedback_retargeting_status
  ON dyia_cancellation_feedback(retargeting_status, created_at DESC);

