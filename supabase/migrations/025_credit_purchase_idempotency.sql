-- Prevent duplicate Stripe credit purchases from being applied twice.
-- Stripe may retry webhook delivery, so the payment reference itself must be unique.

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_stripe_payment_id_unique
  ON dyia_credit_transactions (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION dyia_apply_credit_purchase(
  p_user_id UUID,
  p_amount INTEGER,
  p_stripe_payment_id TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  applied BOOLEAN,
  balance_after INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance_after INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be positive';
  END IF;

  IF p_stripe_payment_id IS NULL OR btrim(p_stripe_payment_id) = '' THEN
    RAISE EXCEPTION 'Stripe payment id is required';
  END IF;

  BEGIN
    INSERT INTO dyia_credit_transactions (
      user_id,
      type,
      amount,
      balance_after,
      description,
      stripe_payment_id,
      message_id,
      metadata
    ) VALUES (
      p_user_id,
      'purchase',
      p_amount,
      0,
      COALESCE(p_description, format('Purchased %s AI credits', p_amount)),
      p_stripe_payment_id,
      NULL,
      COALESCE(p_metadata, '{}'::jsonb)
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN QUERY
      SELECT false, COALESCE(u.ai_credits_balance, 0)
      FROM dyia_users u
      WHERE u.id = p_user_id;
      RETURN;
  END;

  UPDATE dyia_users
  SET ai_credits_balance = COALESCE(ai_credits_balance, 0) + p_amount
  WHERE id = p_user_id
  RETURNING ai_credits_balance INTO v_balance_after;

  IF v_balance_after IS NULL THEN
    RAISE EXCEPTION 'Credit purchase failed: user % not found', p_user_id;
  END IF;

  UPDATE dyia_credit_transactions
  SET balance_after = v_balance_after
  WHERE stripe_payment_id = p_stripe_payment_id;

  RETURN QUERY SELECT true, v_balance_after;
END;
$$;

COMMENT ON FUNCTION dyia_apply_credit_purchase(UUID, INTEGER, TEXT, TEXT, JSONB)
  IS 'Applies a Stripe-backed AI credit purchase exactly once and returns whether the purchase was newly applied.';
