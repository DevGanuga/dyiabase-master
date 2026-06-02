import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@clerk/nextjs/server'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'
import { getErrorMessage } from '@/lib/errors'

/**
 * BUG-031 (round 5): merchant-side reconciliation.
 *
 * Symptom: a customer pays via the Stripe Checkout link, but the merchant's
 * dashboard still shows the quote/job as "Payment requested" hours later.
 *
 * Root cause (most common): the Stripe webhook is misconfigured in production
 * (wrong endpoint, wrong signing secret, missing events), so
 * `checkout.session.completed` and `payment_intent.succeeded` never reach our
 * handler. The customer-side `/api/payments/public/[token]/verify` patches the
 * happy path (customer always sees success), but the merchant only sees stale
 * data until they manually navigate.
 *
 * This route is the merchant-side equivalent. It pulls every `pending` payment
 * for the calling merchant created in the last 7 days, asks Stripe for the
 * authoritative status of each, and applies the same DB updates the webhook
 * would have. Idempotent — already-paid payments are skipped.
 *
 * Called from the Dyia app on dashboard mount + on tab visibility/focus so the
 * merchant's UI always reflects reality even if the webhook is dark.
 */
export async function POST() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    const { data: dyiaUser, error: userErr } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userErr || !dyiaUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    // Include `checkout_created`: once a customer clicks "Pay", the row moves
    // from `pending` to `checkout_created`. Those are the MOST common stuck
    // rows when the webhook is dark, so merchant reconciliation must cover them.
    const { data: pending, error: pendingErr } = await supabase
      .from('dyia_payments')
      .select(
        'id, status, quote_id, job_id, stripe_checkout_session_id, stripe_payment_intent_id, amount_cents'
      )
      .eq('user_id', dyiaUser.id)
      .in('status', ['pending', 'checkout_created'])
      .gte('created_at', sevenDaysAgo)
      .limit(50)

    if (pendingErr) {
      console.error('sync-pending: lookup failed', pendingErr)
      return NextResponse.json({ error: 'Database lookup failed' }, { status: 500 })
    }

    if (!pending || pending.length === 0) {
      return NextResponse.json({ reconciled: 0, checked: 0 })
    }

    let stripe: Stripe
    try {
      stripe = getStripe()
    } catch (err) {
      // Surface the misconfiguration clearly so the dashboard can log it.
      const message = err instanceof Error ? err.message : 'Stripe client unavailable'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    let reconciled = 0
    const errors: string[] = []

    for (const payment of pending) {
      try {
        // Prefer payment intent (most authoritative); fall back to session.
        let paid = false
        let paymentIntentId = payment.stripe_payment_intent_id || null
        // Total the customer actually paid (base + tip). Anything above the
        // base amount_cents is the customer's tip (100% to the merchant).
        let totalPaidCents: number | null = null

        if (paymentIntentId) {
          const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
          paid = intent.status === 'succeeded'
          totalPaidCents = intent.amount_received ?? intent.amount ?? null
        } else if (payment.stripe_checkout_session_id) {
          const session = await stripe.checkout.sessions.retrieve(
            payment.stripe_checkout_session_id
          )
          paid = session.payment_status === 'paid'
          totalPaidCents = typeof session.amount_total === 'number' ? session.amount_total : null
          if (typeof session.payment_intent === 'string') {
            paymentIntentId = session.payment_intent
          } else if (session.payment_intent?.id) {
            paymentIntentId = session.payment_intent.id
          }
        } else {
          // No Stripe handle yet — customer hasn't clicked through. Skip.
          continue
        }

        if (!paid) continue

        // Compute the tip the same way the webhook + verify paths do, so a
        // payment reconciled here (because the webhook was dark) still reports
        // tips correctly on the merchant dashboard instead of $0.
        const tipCents =
          totalPaidCents != null && payment.amount_cents
            ? Math.max(0, totalPaidCents - payment.amount_cents)
            : 0

        const now = new Date().toISOString()
        const updatePayload: {
          status: 'paid'
          stripe_payment_intent_id: string | null
          paid_at: string
          tip_cents?: number
        } = {
          status: 'paid',
          stripe_payment_intent_id: paymentIntentId,
          paid_at: now,
        }
        // Only write a positive tip so we never overwrite a tip the webhook
        // already recorded with 0.
        if (tipCents > 0) updatePayload.tip_cents = tipCents

        const { error: updateErr } = await supabase
          .from('dyia_payments')
          .update(updatePayload)
          .eq('id', payment.id)
          // Optimistic concurrency guard: only transition not-yet-paid rows.
          .in('status', ['pending', 'checkout_created'])

        if (updateErr) {
          errors.push(`payment ${payment.id}: ${updateErr.message}`)
          continue
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
        reconciled += 1
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown'
        errors.push(`payment ${payment.id}: ${message}`)
      }
    }

    return NextResponse.json({
      checked: pending.length,
      reconciled,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('sync-pending error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Could not sync payments') },
      { status: 500 }
    )
  }
}
