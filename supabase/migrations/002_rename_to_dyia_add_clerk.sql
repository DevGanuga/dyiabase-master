-- Migration: Upgrade junkprofit schema to dyia with Clerk auth
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Drop triggers on junkprofit tables
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_users') THEN
    DROP TRIGGER IF EXISTS update_junkprofit_users_updated_at ON junkprofit_users;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_settings') THEN
    DROP TRIGGER IF EXISTS update_junkprofit_settings_updated_at ON junkprofit_settings;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_jobs') THEN
    DROP TRIGGER IF EXISTS update_junkprofit_jobs_updated_at ON junkprofit_jobs;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_quotes') THEN
    DROP TRIGGER IF EXISTS update_junkprofit_quotes_updated_at ON junkprofit_quotes;
  END IF;
END $$;

DROP TRIGGER IF EXISTS on_junkprofit_auth_user_created ON auth.users;

-- =============================================
-- STEP 2: Drop old functions
-- =============================================
DROP FUNCTION IF EXISTS handle_junkprofit_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_junkprofit_updated_at() CASCADE;

-- =============================================
-- STEP 3: Drop RLS policies on junkprofit tables
-- =============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_users') THEN
    DROP POLICY IF EXISTS "Users can view own profile" ON junkprofit_users;
    DROP POLICY IF EXISTS "Users can update own profile" ON junkprofit_users;
    DROP POLICY IF EXISTS "Service role can manage all users" ON junkprofit_users;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_settings') THEN
    DROP POLICY IF EXISTS "Users can view own settings" ON junkprofit_settings;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_jobs') THEN
    DROP POLICY IF EXISTS "Users can manage own jobs" ON junkprofit_jobs;
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'junkprofit_quotes') THEN
    DROP POLICY IF EXISTS "Users can manage own quotes" ON junkprofit_quotes;
  END IF;
END $$;

-- =============================================
-- STEP 4: Drop old indexes
-- =============================================
DROP INDEX IF EXISTS idx_junkprofit_jobs_user_date;
DROP INDEX IF EXISTS idx_junkprofit_quotes_user_created;
DROP INDEX IF EXISTS idx_junkprofit_users_stripe;

-- =============================================
-- STEP 5: Rename tables from junkprofit to dyia
-- =============================================
ALTER TABLE IF EXISTS junkprofit_quotes RENAME TO dyia_quotes;
ALTER TABLE IF EXISTS junkprofit_jobs RENAME TO dyia_jobs;
ALTER TABLE IF EXISTS junkprofit_settings RENAME TO dyia_settings;
ALTER TABLE IF EXISTS junkprofit_users RENAME TO dyia_users;

-- =============================================
-- STEP 6: Add clerk_user_id column to dyia_users
-- =============================================
ALTER TABLE dyia_users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;
ALTER TABLE dyia_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE dyia_users ADD COLUMN IF NOT EXISTS last_name TEXT;

-- =============================================
-- STEP 7: Drop auth_user_id foreign key and column
-- =============================================
ALTER TABLE dyia_users DROP CONSTRAINT IF EXISTS junkprofit_users_auth_user_id_fkey;
ALTER TABLE dyia_users DROP CONSTRAINT IF EXISTS dyia_users_auth_user_id_fkey;
ALTER TABLE dyia_users DROP COLUMN IF EXISTS auth_user_id;

-- =============================================
-- STEP 8: Make clerk_user_id NOT NULL (after removing auth_user_id)
-- =============================================
-- Note: If you have existing data, you'll need to populate clerk_user_id first
-- For now, we'll allow NULL temporarily, the app will set it on first login

-- =============================================
-- STEP 9: Create indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_dyia_jobs_user_date ON dyia_jobs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dyia_quotes_user_created ON dyia_quotes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dyia_users_stripe ON dyia_users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_dyia_users_clerk ON dyia_users(clerk_user_id);

-- =============================================
-- STEP 10: Enable Row Level Security
-- =============================================
ALTER TABLE dyia_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyia_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyia_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyia_quotes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 11: Create RLS policies (permissive - auth handled by app)
-- =============================================
DROP POLICY IF EXISTS "Service role full access to users" ON dyia_users;
CREATE POLICY "Service role full access to users" ON dyia_users FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access to settings" ON dyia_settings;
CREATE POLICY "Service role full access to settings" ON dyia_settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access to jobs" ON dyia_jobs;
CREATE POLICY "Service role full access to jobs" ON dyia_jobs FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role full access to quotes" ON dyia_quotes;
CREATE POLICY "Service role full access to quotes" ON dyia_quotes FOR ALL USING (true);

-- =============================================
-- STEP 12: Create updated_at trigger function
-- =============================================
CREATE OR REPLACE FUNCTION update_dyia_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 13: Apply updated_at triggers
-- =============================================
DROP TRIGGER IF EXISTS update_dyia_users_updated_at ON dyia_users;
CREATE TRIGGER update_dyia_users_updated_at
  BEFORE UPDATE ON dyia_users
  FOR EACH ROW EXECUTE FUNCTION update_dyia_updated_at();

DROP TRIGGER IF EXISTS update_dyia_settings_updated_at ON dyia_settings;
CREATE TRIGGER update_dyia_settings_updated_at
  BEFORE UPDATE ON dyia_settings
  FOR EACH ROW EXECUTE FUNCTION update_dyia_updated_at();

DROP TRIGGER IF EXISTS update_dyia_jobs_updated_at ON dyia_jobs;
CREATE TRIGGER update_dyia_jobs_updated_at
  BEFORE UPDATE ON dyia_jobs
  FOR EACH ROW EXECUTE FUNCTION update_dyia_updated_at();

DROP TRIGGER IF EXISTS update_dyia_quotes_updated_at ON dyia_quotes;
CREATE TRIGGER update_dyia_quotes_updated_at
  BEFORE UPDATE ON dyia_quotes
  FOR EACH ROW EXECUTE FUNCTION update_dyia_updated_at();

-- =============================================
-- DONE! 
-- Tables renamed: junkprofit_* -> dyia_*
-- Added: clerk_user_id, first_name, last_name
-- Removed: auth_user_id (Supabase Auth)
-- =============================================
