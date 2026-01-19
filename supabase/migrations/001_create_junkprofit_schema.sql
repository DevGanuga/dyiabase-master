-- JunkProfit Tracker Schema
-- Prefix all tables with junkprofit_ to avoid conflicts with other apps

-- Users table (linked to Supabase Auth)
CREATE TABLE junkprofit_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'canceled', 'past_due', 'trialing')),
  subscription_plan TEXT CHECK (subscription_plan IN ('monthly', 'annual')),
  subscription_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Business settings per user
CREATE TABLE junkprofit_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES junkprofit_users(id) ON DELETE CASCADE,
  tax_percentage INTEGER DEFAULT 30 CHECK (tax_percentage >= 0 AND tax_percentage <= 100),
  monthly_goal NUMERIC(10, 2) DEFAULT 0,
  business_name TEXT,
  business_phone TEXT,
  business_email TEXT,
  business_address TEXT,
  business_logo TEXT, -- Base64 or URL to Supabase Storage
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Jobs table
CREATE TABLE junkprofit_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES junkprofit_users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  source TEXT, -- Marketing source (Google, Facebook, Referral, etc.)
  revenue NUMERIC(10, 2) DEFAULT 0 CHECK (revenue >= 0),
  labor NUMERIC(10, 2) DEFAULT 0 CHECK (labor >= 0),
  gas NUMERIC(10, 2) DEFAULT 0 CHECK (gas >= 0),
  dump_fee NUMERIC(10, 2) DEFAULT 0 CHECK (dump_fee >= 0),
  dumpster_rental NUMERIC(10, 2) DEFAULT 0 CHECK (dumpster_rental >= 0),
  additional_expense NUMERIC(10, 2) DEFAULT 0 CHECK (additional_expense >= 0),
  num_workers INTEGER DEFAULT 1 CHECK (num_workers >= 1 AND num_workers <= 10),
  cost_per_worker NUMERIC(10, 2) DEFAULT 0 CHECK (cost_per_worker >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Quotes table
CREATE TABLE junkprofit_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES junkprofit_users(id) ON DELETE CASCADE,
  
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  job_description TEXT,
  
  -- Pricing (stored as JSONB for flexibility)
  -- Structure: { minimumFee, quarterLoad, halfLoad, threeQuarterLoad, fullLoad,
  --              trampoline, shed, fridge, furniture, hotTub, customDemo,
  --              laborFee, heavyItemFee, distanceFee, timeFee, hazardFee, customFee,
  --              multipleLoads: { numLoads, pricePerLoad, total } }
  pricing JSONB DEFAULT '{}',
  
  -- Estimate type: 'range' or 'flat'
  estimate_type TEXT DEFAULT 'range' CHECK (estimate_type IN ('range', 'flat')),
  
  -- Calculated totals
  estimate_low NUMERIC(10, 2),
  estimate_high NUMERIC(10, 2),
  total NUMERIC(10, 2),
  
  -- Photos stored in Supabase Storage, array of URLs (max 3)
  photo_urls TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_junkprofit_jobs_user_date ON junkprofit_jobs(user_id, date DESC);
CREATE INDEX idx_junkprofit_quotes_user_created ON junkprofit_quotes(user_id, created_at DESC);
CREATE INDEX idx_junkprofit_users_stripe ON junkprofit_users(stripe_customer_id);

-- Row Level Security
ALTER TABLE junkprofit_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE junkprofit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE junkprofit_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE junkprofit_quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON junkprofit_users
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON junkprofit_users
  FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can view own settings" ON junkprofit_settings
  FOR ALL USING (user_id IN (SELECT id FROM junkprofit_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage own jobs" ON junkprofit_jobs
  FOR ALL USING (user_id IN (SELECT id FROM junkprofit_users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can manage own quotes" ON junkprofit_quotes
  FOR ALL USING (user_id IN (SELECT id FROM junkprofit_users WHERE auth_user_id = auth.uid()));

-- Service role policy for Stripe webhooks (needs to update subscription status)
CREATE POLICY "Service role can manage all users" ON junkprofit_users
  FOR ALL USING (auth.role() = 'service_role');

-- Function to auto-create user profile and settings on signup
CREATE OR REPLACE FUNCTION handle_junkprofit_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert user profile
  INSERT INTO junkprofit_users (auth_user_id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Create default settings for the user
  INSERT INTO junkprofit_settings (user_id)
  SELECT id FROM junkprofit_users WHERE auth_user_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_junkprofit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_junkprofit_users_updated_at
  BEFORE UPDATE ON junkprofit_users
  FOR EACH ROW EXECUTE FUNCTION update_junkprofit_updated_at();

CREATE TRIGGER update_junkprofit_settings_updated_at
  BEFORE UPDATE ON junkprofit_settings
  FOR EACH ROW EXECUTE FUNCTION update_junkprofit_updated_at();

CREATE TRIGGER update_junkprofit_jobs_updated_at
  BEFORE UPDATE ON junkprofit_jobs
  FOR EACH ROW EXECUTE FUNCTION update_junkprofit_updated_at();

CREATE TRIGGER update_junkprofit_quotes_updated_at
  BEFORE UPDATE ON junkprofit_quotes
  FOR EACH ROW EXECUTE FUNCTION update_junkprofit_updated_at();

-- IMPORTANT: Create trigger for auto-creating JunkProfit user on auth signup
-- Run this AFTER you've verified the schema works
-- This will auto-create a junkprofit_users row when someone signs up via Supabase Auth
CREATE TRIGGER on_junkprofit_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_junkprofit_new_user();

