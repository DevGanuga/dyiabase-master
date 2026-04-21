-- Track when a user first consumed a Pro free trial so the "Try Pro free" banner
-- can be suppressed for users who have already used their trial (BUG-022).
-- Also used alongside subscription_tier to determine correct plan labeling.
ALTER TABLE dyia_users ADD COLUMN IF NOT EXISTS trial_consumed_at TIMESTAMPTZ;

-- Backfill: any user who has ever had a stripe subscription and is currently
-- past the trial phase (active/past_due/canceled/inactive with a subscription_plan)
-- is treated as having consumed their trial.
UPDATE dyia_users
SET trial_consumed_at = COALESCE(trial_consumed_at, updated_at, created_at, NOW())
WHERE stripe_subscription_id IS NOT NULL
  AND subscription_status IN ('active', 'past_due', 'canceled', 'inactive')
  AND trial_consumed_at IS NULL;

-- Anyone currently trialing: mark trial_consumed_at so when the trial ends
-- they won't be re-prompted to start another free trial.
UPDATE dyia_users
SET trial_consumed_at = COALESCE(trial_consumed_at, updated_at, created_at, NOW())
WHERE subscription_status = 'trialing' AND trial_consumed_at IS NULL;
