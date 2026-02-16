-- =============================================
-- 018: Proper Row-Level Security Policies
-- Replaces permissive USING(true) with user-scoped policies.
-- Requires Clerk JWT template configured in Clerk Dashboard
-- so that Supabase receives the clerk user ID as the JWT "sub" claim.
-- =============================================

-- 1. Helper function: resolves the current authenticated user's dyia_users.id
--    from the Clerk JWT "sub" claim. SECURITY DEFINER so it can read dyia_users.
--    STABLE so Postgres caches the result within a single transaction/request.
CREATE OR REPLACE FUNCTION dyia_current_user_id()
RETURNS UUID AS $$
  SELECT id FROM dyia_users
  WHERE clerk_user_id = coalesce(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================
-- 2. dyia_users — users can read/update their own row
-- =============================================
DROP POLICY IF EXISTS "Service role full access to users" ON dyia_users;
DROP POLICY IF EXISTS "Users can view own profile" ON dyia_users;
DROP POLICY IF EXISTS "Users can update own profile" ON dyia_users;
DROP POLICY IF EXISTS "Service role can manage all users" ON dyia_users;

CREATE POLICY "Users can read own profile" ON dyia_users
  FOR SELECT TO authenticated
  USING (
    clerk_user_id = coalesce(current_setting('request.jwt.claims', true)::json->>'sub', '')
  );

CREATE POLICY "Users can update own profile" ON dyia_users
  FOR UPDATE TO authenticated
  USING (
    clerk_user_id = coalesce(current_setting('request.jwt.claims', true)::json->>'sub', '')
  )
  WITH CHECK (
    clerk_user_id = coalesce(current_setting('request.jwt.claims', true)::json->>'sub', '')
  );

-- =============================================
-- 3. dyia_settings — users can manage their own settings
-- =============================================
DROP POLICY IF EXISTS "Service role full access to settings" ON dyia_settings;

CREATE POLICY "Users can manage own settings" ON dyia_settings
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 4. dyia_jobs — users can manage their own jobs
-- =============================================
DROP POLICY IF EXISTS "Service role full access to jobs" ON dyia_jobs;

CREATE POLICY "Users can manage own jobs" ON dyia_jobs
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 5. dyia_quotes — users can manage their own quotes
-- =============================================
DROP POLICY IF EXISTS "Service role full access to quotes" ON dyia_quotes;

CREATE POLICY "Users can manage own quotes" ON dyia_quotes
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 6. dyia_fixed_expenses — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_fixed_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fixed expenses" ON dyia_fixed_expenses
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 7. dyia_follow_ups — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own follow ups" ON dyia_follow_ups
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 8. dyia_price_templates — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_price_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own price templates" ON dyia_price_templates
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 9. dyia_threads — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own threads" ON dyia_threads
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 10. dyia_messages — enable RLS, scope via thread ownership
-- =============================================
ALTER TABLE dyia_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages in own threads" ON dyia_messages
  FOR ALL TO authenticated
  USING (
    thread_id IN (SELECT id FROM dyia_threads WHERE user_id = dyia_current_user_id())
  )
  WITH CHECK (
    thread_id IN (SELECT id FROM dyia_threads WHERE user_id = dyia_current_user_id())
  );

-- =============================================
-- 11. dyia_insights_cache — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own insights cache" ON dyia_insights_cache
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 12. dyia_email_logs — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own email logs" ON dyia_email_logs
  FOR SELECT TO authenticated
  USING (user_id = dyia_current_user_id());

-- =============================================
-- 13. dyia_credit_transactions — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credit transactions" ON dyia_credit_transactions
  FOR SELECT TO authenticated
  USING (user_id = dyia_current_user_id());

-- =============================================
-- 14. dyia_marketing_spend — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_marketing_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own marketing spend" ON dyia_marketing_spend
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 15. dyia_email_connections — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_email_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email connections" ON dyia_email_connections
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 16. dyia_email_sends — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email sends" ON dyia_email_sends
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 17. dyia_email_campaigns — enable RLS + user policy
-- =============================================
ALTER TABLE dyia_email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own email campaigns" ON dyia_email_campaigns
  FOR ALL TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

-- =============================================
-- 18. dyia_customers — already has RLS enabled, add full CRUD policy
--     (migration 016 only added SELECT; add INSERT/UPDATE/DELETE)
-- =============================================
CREATE POLICY "Users can insert own customers" ON dyia_customers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = dyia_current_user_id());

CREATE POLICY "Users can update own customers" ON dyia_customers
  FOR UPDATE TO authenticated
  USING (user_id = dyia_current_user_id())
  WITH CHECK (user_id = dyia_current_user_id());

CREATE POLICY "Users can delete own customers" ON dyia_customers
  FOR DELETE TO authenticated
  USING (user_id = dyia_current_user_id());

-- =============================================
-- 19. dyia_webhook_events — admin-only table, enable RLS, no anon access
--     Service role (API routes) handles all writes.
-- =============================================
ALTER TABLE dyia_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policy for anon/authenticated — only service role can access

-- =============================================
-- 20. dyia_quiz_submissions — public lead funnel, enable RLS
--     Allow anon INSERT (quiz submissions from landing page)
--     Only service role can read (for admin/reports)
-- =============================================
ALTER TABLE dyia_quiz_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit quiz" ON dyia_quiz_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- =============================================
-- NOTE: The service_role key automatically bypasses RLS in Supabase.
-- All API routes that use SUPABASE_SERVICE_ROLE_KEY will continue
-- to work without any policy restrictions.
--
-- IMPORTANT: This migration requires Clerk JWT template configured
-- so that Supabase receives authenticated requests with the
-- Clerk user ID in the JWT "sub" claim. See OPS_CHECKLIST.md
-- for setup instructions.
-- =============================================
