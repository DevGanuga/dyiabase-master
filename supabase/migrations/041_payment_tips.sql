-- Optional customer tipping on Dyia Pay payments.
--
-- Marco's request: "are customers able to tip when prompted to pay with Stripe?"
-- Tips are collected on the customer-facing /pay/[token] page across all
-- payment kinds (pay links, invoices, quote/job payments). The merchant keeps
-- 100% of the tip: Dyia's 0.75% platform fee is calculated on the base amount
-- (amount_cents) only, never on the tip. The tip is added as a separate Stripe
-- Checkout line item and flows entirely to the connected account.
--
--   tip_cents  – the tip the customer actually added (0 when none). Authoritative
--                value is reconciled from the paid Stripe session/intent total.
--   allow_tip  – whether the public pay page prompts for a tip. Merchants can
--                turn this off per request in the "Get paid" modal.
ALTER TABLE dyia_payments
  ADD COLUMN IF NOT EXISTS tip_cents INTEGER NOT NULL DEFAULT 0 CHECK (tip_cents >= 0),
  ADD COLUMN IF NOT EXISTS allow_tip BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN dyia_payments.tip_cents IS
  'Customer-added tip in cents. Flows 100% to the merchant; Dyia''s platform fee is on amount_cents (base) only.';
COMMENT ON COLUMN dyia_payments.allow_tip IS
  'Whether the public /pay page prompts the customer for an optional tip.';
