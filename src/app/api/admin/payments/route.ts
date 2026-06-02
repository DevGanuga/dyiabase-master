import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
    throw new Error('STRIPE_SECRET_KEY is misconfigured: expected sk_… or rk_…, not whsec_….')
  }
  return new Stripe(key)
}

interface PaymentRow {
  id: string
  user_id: string
  status: string
  kind: string
  amount_cents: number
  tip_cents: number | null
  application_fee_amount_cents: number
  destination_amount_cents: number
  customer_name: string | null
  description: string | null
  invoice_number: string | null
  stripe_payment_intent_id: string | null
  public_token: string
  paid_at: string | null
  created_at: string
}

/**
 * GET /api/admin/payments
 *
 * Platform-wide Dyia Pay oversight: lifetime + monthly totals (collected, Dyia
 * fees, tips) and the most recent payments across every merchant. Powers the
 * admin Payments page so the team can confirm transactions are flowing and see
 * exactly how much Dyia has earned in platform fees.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const supabase = getSupabase()

    // Recent activity. We resolve merchant names in a second query (rather than a
    // PostgREST FK embed) so the route never depends on relationship inference.
    const { data: recent, error: recentErr } = await supabase
      .from('dyia_payments')
      .select('id, user_id, status, kind, amount_cents, tip_cents, application_fee_amount_cents, destination_amount_cents, customer_name, description, invoice_number, stripe_payment_intent_id, public_token, paid_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (recentErr) {
      console.error('admin payments: recent query failed', recentErr)
      return NextResponse.json({ error: 'Could not load payments' }, { status: 500 })
    }

    const merchantIds = Array.from(new Set(((recent as PaymentRow[]) || []).map((p) => p.user_id)))
    const merchantMap = new Map<string, { email: string | null; first_name: string | null; last_name: string | null }>()
    if (merchantIds.length > 0) {
      const { data: merchants } = await supabase
        .from('dyia_users')
        .select('id, email, first_name, last_name')
        .in('id', merchantIds)
      for (const m of merchants || []) {
        merchantMap.set(m.id, { email: m.email, first_name: m.first_name, last_name: m.last_name })
      }
    }

    // Lifetime + this-month aggregates over PAID payments only.
    const { data: paid, error: paidErr } = await supabase
      .from('dyia_payments')
      .select('amount_cents, tip_cents, application_fee_amount_cents, paid_at, status')
      .eq('status', 'paid')

    if (paidErr) {
      console.error('admin payments: aggregate query failed', paidErr)
      return NextResponse.json({ error: 'Could not load payment totals' }, { status: 500 })
    }

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    let lifetimeCollectedCents = 0
    let lifetimeFeesCents = 0
    let monthCollectedCents = 0
    let monthFeesCents = 0
    let paidCount = 0

    for (const p of paid || []) {
      const tip = p.tip_cents || 0
      const collected = (p.amount_cents || 0) + tip
      lifetimeCollectedCents += collected
      lifetimeFeesCents += p.application_fee_amount_cents || 0
      paidCount += 1
      if (p.paid_at && new Date(p.paid_at) >= monthStart) {
        monthCollectedCents += collected
        monthFeesCents += p.application_fee_amount_cents || 0
      }
    }

    const payments = ((recent as PaymentRow[]) || []).map((p) => {
      const merchant = merchantMap.get(p.user_id) || null
      const merchantName = merchant
        ? [merchant.first_name, merchant.last_name].filter(Boolean).join(' ') || merchant.email || 'Unknown'
        : 'Unknown'
      return {
        id: p.id,
        status: p.status,
        kind: p.kind,
        amountCents: p.amount_cents,
        tipCents: p.tip_cents || 0,
        feeCents: p.application_fee_amount_cents,
        customerName: p.customer_name,
        description: p.description,
        invoiceNumber: p.invoice_number,
        publicToken: p.public_token,
        canRefund: p.status === 'paid' && !!p.stripe_payment_intent_id,
        merchantEmail: merchant?.email || null,
        merchantName,
        paidAt: p.paid_at,
        createdAt: p.created_at,
      }
    })

    return NextResponse.json({
      totals: {
        lifetimeCollectedCents,
        lifetimeFeesCents,
        monthCollectedCents,
        monthFeesCents,
        paidCount,
      },
      payments,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('admin payments GET error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/admin/payments  { paymentId }
 *
 * Refund a Dyia Pay customer payment. These are Connect destination charges on
 * the platform account, so we reverse the transfer and refund the application
 * fee too, making both the customer and the merchant whole. The charge.refunded
 * webhook syncs the DB; we also write it here so the admin sees it immediately
 * even if the webhook is delayed.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const { paymentId } = await req.json()
    if (!paymentId) return NextResponse.json({ error: 'paymentId required' }, { status: 400 })

    const supabase = getSupabase()
    const { data: payment, error } = await supabase
      .from('dyia_payments')
      .select('id, status, amount_cents, tip_cents, stripe_payment_intent_id, quote_id, job_id')
      .eq('id', paymentId)
      .single()

    if (error || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (payment.status !== 'paid') {
      return NextResponse.json({ error: 'Only paid payments can be refunded.' }, { status: 400 })
    }
    if (!payment.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No Stripe payment intent on this payment.' }, { status: 400 })
    }

    const stripe = getStripe()
    await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
    })

    const now = new Date().toISOString()
    const refundedAmount = (payment.amount_cents || 0) + (payment.tip_cents || 0)
    await supabase
      .from('dyia_payments')
      .update({ status: 'refunded', refunded_at: now, refunded_amount_cents: refundedAmount })
      .eq('id', payment.id)

    if (payment.quote_id) {
      await supabase.from('dyia_quotes').update({ payment_status: 'pending', payment_paid_at: null }).eq('id', payment.quote_id)
    }
    if (payment.job_id) {
      await supabase.from('dyia_jobs').update({ payment_status: 'pending', payment_paid_at: null }).eq('id', payment.job_id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('admin payments refund error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
