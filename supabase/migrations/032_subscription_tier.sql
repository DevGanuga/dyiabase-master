ALTER TABLE dyia_users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'basic';
