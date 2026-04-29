-- Round 2 prod-readiness for BUG-031: the new `charge.refunded` webhook
-- handler in src/app/api/stripe/webhook/route.ts writes:
--   * `status = 'partial_refund'` for partial refunds
--   * `refunded_amount_cents` (in cents)
-- Migration 028 only allowed status IN
--   ('pending','checkout_created','paid','failed','expired','refunded')
-- and did not include `refunded_amount_cents`. Without this migration the
-- partial-refund branch would be rejected by the CHECK constraint and the
-- amount would silently fail. Full refunds still work via the existing
-- `'refunded'` value and `refunded_at`, but partial refunds need both.

-- 1. Add the partial-refund amount column (idempotent).
ALTER TABLE dyia_payments
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER
    CHECK (refunded_amount_cents IS NULL OR refunded_amount_cents >= 0);

-- 2. Drop and recreate the status CHECK constraint to include
--    'partial_refund'. We use a fixed name to make this idempotent across
--    re-runs even if the original CHECK was created with an auto-generated
--    name in some environments.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'dyia_payments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status = ANY%'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE dyia_payments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE dyia_payments
  ADD CONSTRAINT dyia_payments_status_check
  CHECK (status IN (
    'pending',
    'checkout_created',
    'paid',
    'failed',
    'expired',
    'refunded',
    'partial_refund'
  ));
