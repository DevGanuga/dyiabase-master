-- ============================================================================
-- Dyia Payments — apply pending migrations 039–042 in one shot.
--
-- Paste this whole file into the Supabase SQL editor (Dashboard → SQL → New
-- query → Run) for the dyia project. It is IDEMPOTENT and ADDITIVE — safe to
-- run more than once; it only adds columns/indexes that don't already exist.
--
-- WHY THIS IS REQUIRED: the payments code now inserts `kind`, `tip_cents`,
-- `line_items`, etc. Until these columns exist, EVERY payment-creation path
-- (quote payment, job payment, pay link, invoice) fails on insert. After this
-- runs, the real flow works (given a Stripe Connect account with charges
-- enabled). Verify afterward by reloading the Payments tab.
-- ============================================================================

-- ── 039: standalone payments + invoices ─────────────────────────────────────
ALTER TABLE dyia_payments
  DROP CONSTRAINT IF EXISTS dyia_payments_single_resource;

ALTER TABLE dyia_payments
  ADD CONSTRAINT dyia_payments_single_resource
    CHECK (num_nonnulls(quote_id, job_id) <= 1);

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

UPDATE dyia_payments
SET kind = CASE
  WHEN quote_id IS NOT NULL THEN 'quote_payment'
  WHEN job_id IS NOT NULL THEN 'job_payment'
  ELSE 'payment_link'
END
WHERE kind = 'payment_link'
  AND (quote_id IS NOT NULL OR job_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dyia_payments_user_invoice_number
  ON dyia_payments(user_id, invoice_number)
  WHERE invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dyia_payments_kind
  ON dyia_payments(user_id, kind, created_at DESC);

-- ── 040: subscription cancel-at-period-end (adjacent; harmless) ──────────────
ALTER TABLE dyia_users
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 041: optional customer tips ─────────────────────────────────────────────
ALTER TABLE dyia_payments
  ADD COLUMN IF NOT EXISTS tip_cents INTEGER NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  ADD COLUMN IF NOT EXISTS allow_tip BOOLEAN NOT NULL DEFAULT true;

-- ── 042: webhook error_message column (admin log) ───────────────────────────
ALTER TABLE dyia_webhook_events
  ADD COLUMN IF NOT EXISTS error_message TEXT;

UPDATE dyia_webhook_events
SET error_message = error
WHERE error_message IS NULL AND error IS NOT NULL;

-- ── Verify (optional) ───────────────────────────────────────────────────────
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'dyia_payments'
--   AND column_name IN ('kind','tip_cents','allow_tip','line_items','due_date',
--                       'invoice_number','subtotal_cents','tax_cents',
--                       'customer_phone','customer_address')
-- ORDER BY column_name;
