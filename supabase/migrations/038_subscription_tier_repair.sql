-- Repair migration: 032_subscription_tier.sql was never applied to prod
-- because the migrations folder contained TWO files prefixed with `032_`
-- (032_intel_research_report.sql and 032_subscription_tier.sql) and the
-- Supabase migration runner records exactly one row per prefix in
-- `schema_migrations`, so it silently skipped the second file.
--
-- Consequence in production: every server route that reads `subscription_tier`
-- (computeSubscriptionState, /api/ai/insights, /api/ai/chat, etc.) was failing
-- with "column dyia_users.subscription_tier does not exist", which surfaced
-- as generic 404s like "User not found" on the dashboard insight card.
--
-- This migration re-applies the original column DDL idempotently. It is safe
-- to run on any environment, including ones where 032_subscription_tier.sql
-- did apply correctly.

ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'basic';

-- Backfill defaults so existing rows have a non-null value the code can
-- compare against. Pro/active users with a stripe_subscription_id default
-- to 'pro' so legacy paying customers don't render as Basic; everyone else
-- defaults to the column DEFAULT ('basic'), which matches the brand-new-user
-- free-tier expectation in the QA matrix.
UPDATE dyia_users
SET subscription_tier = 'pro'
WHERE subscription_tier IS NULL
  AND stripe_subscription_id IS NOT NULL
  AND subscription_status IN ('active','trialing','past_due','canceled');

UPDATE dyia_users
SET subscription_tier = 'basic'
WHERE subscription_tier IS NULL;
