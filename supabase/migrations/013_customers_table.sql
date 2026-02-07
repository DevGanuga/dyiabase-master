-- ============================================
-- 013: CUSTOMERS TABLE
-- First-class customer entity for CRM
-- ============================================

CREATE TABLE IF NOT EXISTS dyia_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES dyia_users(clerk_user_id) ON DELETE CASCADE,
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

-- RLS policies (users can only access their own customers)
CREATE POLICY "Users can view own customers" ON dyia_customers
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own customers" ON dyia_customers
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own customers" ON dyia_customers
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own customers" ON dyia_customers
  FOR DELETE USING (auth.uid()::text = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_dyia_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_dyia_customers_updated_at
  BEFORE UPDATE ON dyia_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_dyia_customers_updated_at();
