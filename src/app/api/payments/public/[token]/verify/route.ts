import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'

/**
 * BUG-031 (round 2): defense-in-depth reconciliation endpoint.
 *
 * Even with `payment_intent.succeeded` and a hardened
 * `checkout.session.completed` route, the Stripe webhook may be:
 *   - misconfigured (wrong endpoint URL, wrong secret, wrong events)
 *   - delayed (live deliveries can lag the redirect by several seconds)
 *   - blocked by signature verification mismatch in test environments
 *
 * The customer always lands on `/pay/[token]?checkout=success&session_id=...`
 * after a successful payment. The page calls this route once on arrival,
 * we re-fetch the Checkout Session from Stripe (single API call), and if
 * `payment_status === 'paid'` we run the same DB updates the webhook would,
 * idempotently. This guarantees the merchant sees an up-to-date quote/job
 * even if the webhook is silent.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({})) as { sessionId?: string }
    const sessionId = body.sessionId

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: payment, error: lookupError } = await supabase
      .from('dyia_payments')
      .select('id, status, quote_id, job_id, public_token, stripe_checkout_session_id')
      .eq('public_token', token)
      .single()

    if (lookupError || !payment) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 })
    }

    // Already reconciled. Return current snapshot so the client can refresh.
    if (payment.status === 'paid') {
      return NextResponse.json({
        status: 'paid',
        alreadyReconciled: true,
      })
    }

    // Sanity-guard: refuse to reconcile against a session that doesn't belong
    // to this token. Prevents a malicious caller from forcing a "paid" status
    // by pasting in another payment's session id.
    if (payment.stripe_checkout_session_id && payment.stripe_checkout_session_id !== sessionId) {
      return NextResponse.json({ error: 'Session does not match this payment link' }, { status: 400 })
    }

    const stripe = getStripe()
    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId)
    } catch (err) {
      console.error('verify: stripe.sessions.retrieve failed', err)
      return NextResponse.json({ error: 'Could not verify payment with Stripe' }, { status: 502 })
    }

    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        status: payment.status,
        sessionPaymentStatus: session.payment_status,
      })
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id || null

    const now = new Date().toISOString()

    const { error: updateError } = await supabase
      .from('dyia_payments')
      .update({
        status: 'paid',
        stripe_payment_intent_id: paymentIntentId,
        paid_at: now,
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('verify: failed to update dyia_payments', updateError)
      return NextResponse.json({ error: 'Reconciliation update failed' }, { status: 500 })
    }

    if (payment.quote_id) {
      await supabase
        .from('dyia_quotes')
        .update({ payment_status: 'paid', payment_paid_at: now })
        .eq('id', payment.quote_id)
    }
    if (payment.job_id) {
      await supabase
        .from('dyia_jobs')
        .update({ payment_status: 'paid', payment_paid_at: now })
        .eq('id', payment.job_id)
    }

    return NextResponse.json({
      status: 'paid',
      reconciledNow: true,
    })
  } catch (error) {
    console.error('Payment verify error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
