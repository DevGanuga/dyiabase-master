-- Migration 015: Add admin role system to dyia_users
-- Adds is_admin flag and role column for admin panel access

-- Add is_admin boolean (simple flag)
ALTER TABLE dyia_users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Add role column with check constraint
ALTER TABLE dyia_users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

ALTER TABLE dyia_users
ADD CONSTRAINT dyia_users_role_check
CHECK (role IN ('user', 'admin', 'superadmin'));

-- Create index for admin lookups
CREATE INDEX IF NOT EXISTS idx_dyia_users_is_admin ON dyia_users (is_admin) WHERE is_admin = true;
CREATE INDEX IF NOT EXISTS idx_dyia_users_role ON dyia_users (role) WHERE role != 'user';

-- Seed the founding admin users (will match when they sign up via Clerk)
-- These run as idempotent upserts: if user already exists by email, elevate them.
-- If they don't exist yet, the Clerk webhook will create them on first sign-up,
-- then a subsequent run of this migration (or the seed script) will elevate them.
UPDATE dyia_users
SET is_admin = true, role = 'superadmin', subscription_status = 'active'
WHERE email IN (
  'devganuga@initdev.co',
  'ricardo.bezi@initdev.co',
  'marco.aayala97@yahoo.com'
);
