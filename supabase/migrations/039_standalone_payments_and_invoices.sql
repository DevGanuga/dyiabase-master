-- Standalone payment requests + invoice support
--
-- Migration 028 required every dyia_payments row to be tied to exactly one
-- quote OR job (num_nonnulls(quote_id, job_id) = 1). That blocks the two
-- most common payments workflows for a service business:
--   1. Send a one-off "pay link" to a customer for a quick agreed price
--   2. Build a proper itemized invoice from scratch
--
-- This migration:
--   * Relaxes the resource constraint to "at most one" so standalone
--     payments (no quote, no job) are allowed
--   * Adds invoice-grade fields: line_items, due_date, invoice_number,
--     customer_phone, customer_address
--   * Adds a `kind` discriminator so the UI can render the right experience
--     on the public pay page and in activity lists

-- 1. Drop the strict single-resource CHECK and replace with a relaxed one
ALTER TABLE dyia_payments
  DROP CONSTRAINT IF EXISTS dyia_payments_single_resource;

ALTER TABLE dyia_payments
  ADD CONSTRAINT dyia_payments_single_resource
    CHECK (num_nonnulls(quote_id, job_id) <= 1);

-- 2. New columns for invoice-grade payment requests
ALTER TABLE dyia_payments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'payment_link'
    CHECK (kind IN ('payment_link', 'invoice', 'quote_payment', 'job_payment')),
  ADD COLUMN IF NOT EXISTS line_items JSONB,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER,
  ADD COLUMN IF NOT EXISTS tax_cents INTEGER;

-- 3. Backfill `kind` for existing rows based on which resource is set.
-- Safe to run repeatedly; only updates rows where kind still has the new default.
UPDATE dyia_payments
SET kind = CASE
  WHEN quote_id IS NOT NULL THEN 'quote_payment'
  WHEN job_id IS NOT NULL THEN 'job_payment'
  ELSE 'payment_link'
END
WHERE kind = 'payment_link'
  AND (quote_id IS NOT NULL OR job_id IS NOT NULL);

-- 4. Per-user invoice number uniqueness (only when set). Lets each business
-- maintain its own invoice sequence without colliding across tenants.
CREATE UNIQUE INDEX IF NOT EXISTS uq_dyia_payments_user_invoice_number
  ON dyia_payments(user_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

-- 5. Helpful index for the standalone (no resource) case used by the
-- redesigned Payments activity feed.
CREATE INDEX IF NOT EXISTS idx_dyia_payments_kind
  ON dyia_payments(user_id, kind, created_at DESC);
