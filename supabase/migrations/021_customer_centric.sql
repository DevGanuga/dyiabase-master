-- ============================================================
-- CUSTOMER-CENTRIC ARCHITECTURE MIGRATION
-- Makes dyia_customers the spine of the data model.
-- Adds customer_id FK to jobs, quotes, and follow-ups.
-- Backfills existing data by matching on customer_name.
-- ============================================================

-- 1. Add customer_id columns (nullable for backwards compat)
ALTER TABLE dyia_jobs ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES dyia_customers(id) ON DELETE SET NULL;
ALTER TABLE dyia_quotes ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES dyia_customers(id) ON DELETE SET NULL;
ALTER TABLE dyia_follow_ups ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES dyia_customers(id) ON DELETE SET NULL;

-- 2. Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON dyia_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON dyia_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_customer_id ON dyia_follow_ups(customer_id);

-- 3. Backfill: create missing customer records from jobs
INSERT INTO dyia_customers (user_id, name)
SELECT DISTINCT j.user_id, j.customer_name
FROM dyia_jobs j
WHERE j.customer_id IS NULL
  AND j.customer_name IS NOT NULL
  AND TRIM(j.customer_name) != ''
  AND NOT EXISTS (
    SELECT 1 FROM dyia_customers c
    WHERE c.user_id = j.user_id AND LOWER(c.name) = LOWER(TRIM(j.customer_name))
  )
ON CONFLICT DO NOTHING;

-- 4. Backfill: create missing customer records from quotes (with contact info)
INSERT INTO dyia_customers (user_id, name, phone, email, address)
SELECT DISTINCT ON (q.user_id, LOWER(TRIM(q.customer_name)))
  q.user_id,
  TRIM(q.customer_name),
  q.customer_phone,
  q.customer_email,
  q.customer_address
FROM dyia_quotes q
WHERE q.customer_id IS NULL
  AND q.customer_name IS NOT NULL
  AND TRIM(q.customer_name) != ''
  AND NOT EXISTS (
    SELECT 1 FROM dyia_customers c
    WHERE c.user_id = q.user_id AND LOWER(c.name) = LOWER(TRIM(q.customer_name))
  )
ORDER BY q.user_id, LOWER(TRIM(q.customer_name)), q.created_at DESC
ON CONFLICT DO NOTHING;

-- 5. Backfill: link jobs to customers
UPDATE dyia_jobs j
SET customer_id = c.id
FROM dyia_customers c
WHERE j.customer_id IS NULL
  AND j.user_id = c.user_id
  AND LOWER(TRIM(j.customer_name)) = LOWER(c.name);

-- 6. Backfill: link quotes to customers
UPDATE dyia_quotes q
SET customer_id = c.id
FROM dyia_customers c
WHERE q.customer_id IS NULL
  AND q.user_id = c.user_id
  AND LOWER(TRIM(q.customer_name)) = LOWER(c.name);

-- 7. Backfill: link follow-ups to customers via their quote
UPDATE dyia_follow_ups fu
SET customer_id = q.customer_id
FROM dyia_quotes q
WHERE fu.customer_id IS NULL
  AND fu.quote_id = q.id
  AND q.customer_id IS NOT NULL;

-- 8. Update contact info on customers from quotes where customer record is missing it
UPDATE dyia_customers c
SET
  phone = COALESCE(c.phone, q.customer_phone),
  email = COALESCE(c.email, q.customer_email),
  address = COALESCE(c.address, q.customer_address)
FROM dyia_quotes q
WHERE q.customer_id = c.id
  AND (c.phone IS NULL OR c.email IS NULL OR c.address IS NULL)
  AND (q.customer_phone IS NOT NULL OR q.customer_email IS NOT NULL OR q.customer_address IS NOT NULL);
