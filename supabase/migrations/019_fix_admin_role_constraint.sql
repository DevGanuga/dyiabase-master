-- =============================================
-- 019: Fix admin role constraint conflict
--
-- Migration 015 created CHECK (role IN ('user','admin','superadmin'))
-- Migration 017 tried CHECK (role IN ('user','admin','super_admin'))
-- This normalizes everything to: 'user', 'admin', 'super_admin'
-- =============================================

-- 1. Drop ALL existing role check constraints
ALTER TABLE dyia_users DROP CONSTRAINT IF EXISTS dyia_users_role_check;

-- The inline CHECK from 017 may have created an auto-named constraint
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'dyia_users'::regclass
      AND conname LIKE '%role%'  
  ) LOOP
    EXECUTE 'ALTER TABLE dyia_users DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- 2. Normalize any existing 'superadmin' values to 'super_admin'
UPDATE dyia_users SET role = 'super_admin' WHERE role = 'superadmin';

-- 3. Add the single canonical constraint
ALTER TABLE dyia_users
  ADD CONSTRAINT dyia_users_role_check
  CHECK (role IN ('user', 'admin', 'super_admin'));

-- 4. Re-seed founding admins (ensure they have both is_admin and proper role)
UPDATE dyia_users
SET is_admin = true, role = 'super_admin', subscription_status = 'active'
WHERE email IN (
  'devganuga@initdev.co',
  'ricardo.bezi@initdev.co',
  'marco.aayala97@yahoo.com'
);
