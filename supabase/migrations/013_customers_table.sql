-- ============================================
-- 013: CUSTOMERS TABLE
-- First-class customer entity for CRM
-- ============================================

CREATE TABLE IF NOT EXISTS dyia_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_dyia_customers_user_id ON dyia_customers(user_id);

-- Unique constraint: one customer name per user (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dyia_customers_user_name 
  ON dyia_customers(user_id, lower(name));

-- Enable RLS
ALTER TABLE dyia_customers ENABLE ROW LEVEL SECURITY;

-- RLS: users can read own customers (Clerk auth via JWT sub claim)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own customers' AND tablename = 'dyia_customers') THEN
    CREATE POLICY "Users can read own customers" ON dyia_customers
      FOR SELECT USING (
        user_id IN (
          SELECT id FROM dyia_users
          WHERE clerk_user_id = coalesce(current_setting('request.jwt.claims', true)::json->>'sub', '')
        )
      );
  END IF;
END $$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_dyia_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_dyia_customers_updated_at ON dyia_customers;
CREATE TRIGGER trigger_dyia_customers_updated_at
  BEFORE UPDATE ON dyia_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_dyia_customers_updated_at();
