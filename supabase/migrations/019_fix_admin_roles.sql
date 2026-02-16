-- =============================================
-- 019: Fix admin roles — standardize naming, fix constraints, seed admins
-- =============================================
-- Resolves conflict between migration 015 ('superadmin') and 017 ('super_admin').
-- Standardizes on: 'user', 'admin', 'super_admin'
-- Ensures is_admin boolean stays in sync with role column.

-- 1. Drop the old CHECK constraint (may be named differently depending on which migration ran)
DO $$ BEGIN
  -- Try dropping the named constraint from 015
  ALTER TABLE dyia_users DROP CONSTRAINT IF EXISTS dyia_users_role_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Also drop any inline CHECK constraint on the role column
DO $$ BEGIN
  -- Find and drop any check constraint containing 'role' on dyia_users
  EXECUTE (
    SELECT 'ALTER TABLE dyia_users DROP CONSTRAINT ' || quote_ident(conname)
    FROM pg_constraint
    WHERE conrelid = 'dyia_users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
    LIMIT 1
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Fix any existing 'superadmin' values → 'super_admin'
UPDATE dyia_users SET role = 'super_admin' WHERE role = 'superadmin';

-- 3. Default any NULL roles to 'user'
UPDATE dyia_users SET role = 'user' WHERE role IS NULL;

-- 4. Add the correct CHECK constraint
ALTER TABLE dyia_users
ADD CONSTRAINT dyia_users_role_check
CHECK (role IN ('user', 'admin', 'super_admin'));

-- 5. Ensure is_admin column exists and sync it with role
ALTER TABLE dyia_users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

UPDATE dyia_users SET is_admin = true WHERE role IN ('admin', 'super_admin');
UPDATE dyia_users SET is_admin = false WHERE role = 'user';

-- 6. Seed founding admin users — elevate them if they already exist
UPDATE dyia_users
SET role = 'super_admin', is_admin = true, subscription_status = 'active'
WHERE email IN (
  'devganuga@initdev.co',
  'ricardo.bezi@initdev.co',
  'marco.aayala97@yahoo.com'
);

-- 7. Create a trigger to auto-elevate admin users when created via Clerk webhook
--    Checks email against a known admin list and sets role + is_admin accordingly.
CREATE OR REPLACE FUNCTION dyia_auto_elevate_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IN (
    'devganuga@initdev.co',
    'ricardo.bezi@initdev.co',
    'marco.aayala97@yahoo.com'
  ) THEN
    NEW.role := 'super_admin';
    NEW.is_admin := true;
    NEW.subscription_status := 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_dyia_auto_elevate_admin ON dyia_users;
CREATE TRIGGER trg_dyia_auto_elevate_admin
  BEFORE INSERT ON dyia_users
  FOR EACH ROW
  EXECUTE FUNCTION dyia_auto_elevate_admin();

-- 8. Also fire on email update (in case email changes after creation)
DROP TRIGGER IF EXISTS trg_dyia_auto_elevate_admin_update ON dyia_users;
CREATE TRIGGER trg_dyia_auto_elevate_admin_update
  BEFORE UPDATE OF email ON dyia_users
  FOR EACH ROW
  EXECUTE FUNCTION dyia_auto_elevate_admin();

-- 9. Recreate indexes
DROP INDEX IF EXISTS idx_dyia_users_is_admin;
DROP INDEX IF EXISTS idx_dyia_users_role;
CREATE INDEX idx_dyia_users_is_admin ON dyia_users (is_admin) WHERE is_admin = true;
CREATE INDEX idx_dyia_users_role ON dyia_users (role) WHERE role != 'user';
