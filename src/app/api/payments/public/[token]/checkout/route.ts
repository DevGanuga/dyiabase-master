import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/env'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'
import { MAX_PAYMENT_AMOUNT_CENTS, lineAmountCents } from '@/lib/payments'

// Compact unit-price label for fractional-quantity line item names, e.g. "$80.00".
function formatUnit(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(cents / 100)
  } catch {
    return `$${(cents / 100).toFixed(2)}`
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const stripe = getStripe()
    const supabase = getSupabaseAdmin()
    const body = await request.json().catch(() => ({}))

    const { data: payment, error } = await supabase
      .from('dyia_payments')
      .select('*')
      .eq('public_token', token)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 })
    }

    if (payment.status === 'paid') {
      return NextResponse.json({ error: 'This payment has already been completed.' }, { status: 400 })
    }
    if (payment.status === 'refunded' || payment.status === 'partial_refund') {
      return NextResponse.json({ error: 'This payment has been refunded and can no longer be paid.' }, { status: 400 })
    }

    // Optional customer tip (Marco's request). Tips flow 100% to the merchant:
    // we keep the platform application fee on the base amount only and append
    // the tip as its own line item, so the connected account receives it in
    // full. Guard against negative / absurd values and honor the merchant's
    // per-request allow_tip toggle.
    let tipCents = 0
    if (payment.allow_tip) {
      const rawTip = Math.round(Number(body.tipCents))
      if (Number.isFinite(rawTip) && rawTip > 0) {
        tipCents = Math.min(rawTip, MAX_PAYMENT_AMOUNT_CENTS)
      }
    }

    // For invoices, surface real line items to Stripe Checkout so the customer
    // sees an itemized receipt that matches the Dyia invoice page. Each line is
    // collapsed to quantity:1 with unit_amount = round(qty × rate) so the Stripe
    // total ALWAYS equals the invoice total, even when a quantity is fractional
    // (e.g. 1.5 hrs of labor) — Stripe requires integer quantities, so sending
    // the raw fractional qty would otherwise round and mismatch the invoice.
    // Tax is added as a separate line item to avoid configuring Stripe Tax.
    const storedLineItems = Array.isArray(payment.line_items) ? payment.line_items : []
    const checkoutLineItems = storedLineItems.length > 0
      ? storedLineItems
          .filter((item: { description?: unknown; quantity?: unknown; unitAmountCents?: unknown }) =>
            item && typeof item === 'object'
          )
          .map((item: { description: string; quantity: number; unitAmountCents: number }) => {
            const qty = Number(item.quantity)
            const unit = Math.max(0, Math.round(Number(item.unitAmountCents)))
            const isWhole = Number.isInteger(qty) && qty >= 1
            const name = isWhole ? item.description : `${item.description} (${qty} × ${formatUnit(unit, payment.currency)})`
            return {
              price_data: {
                currency: payment.currency,
                product_data: { name },
                unit_amount: isWhole ? unit : lineAmountCents({ quantity: qty, unitAmountCents: unit }),
              },
              quantity: isWhole ? qty : 1,
            }
          })
      : [
          {
            price_data: {
              currency: payment.currency,
              product_data: {
                name: payment.description || 'Payment request',
              },
              unit_amount: payment.amount_cents,
            },
            quantity: 1,
          },
        ]

    if (storedLineItems.length > 0 && payment.tax_cents && payment.tax_cents > 0) {
      checkoutLineItems.push({
        price_data: {
          currency: payment.currency,
          product_data: { name: 'Tax' },
          unit_amount: payment.tax_cents,
        },
        quantity: 1,
      })
    }

    if (tipCents > 0) {
      checkoutLineItems.push({
        price_data: {
          currency: payment.currency,
          product_data: { name: 'Tip' },
          unit_amount: tipCents,
        },
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: checkoutLineItems,
      success_url: `${getBaseUrl()}/pay/${token}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/pay/${token}?checkout=cancelled`,
      customer_email: body.customerEmail || payment.customer_email || undefined,
      payment_intent_data: {
        application_fee_amount: payment.application_fee_amount_cents,
        transfer_data: {
          destination: payment.stripe_connected_account_id,
        },
        metadata: {
          payment_kind: 'customer_payment',
          dyia_payment_id: payment.id,
          dyia_user_id: payment.user_id,
          quote_id: payment.quote_id || '',
          job_id: payment.job_id || '',
          public_token: payment.public_token,
        },
      },
      metadata: {
        payment_kind: 'customer_payment',
        dyia_payment_id: payment.id,
        dyia_user_id: payment.user_id,
        quote_id: payment.quote_id || '',
        job_id: payment.job_id || '',
        public_token: payment.public_token,
      },
    })

    const { error: sessionWriteError } = await supabase
      .from('dyia_payments')
      .update({
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
        status: 'checkout_created',
        tip_cents: tipCents,
      })
      .eq('id', payment.id)

    if (sessionWriteError) {
      // CRITICAL: if we can't persist the session id, the verify route can't
      // bind the payment to this exact Stripe session. Fail loudly rather than
      // returning a checkout URL we can't later verify securely.
      console.error('Public checkout: failed to persist session id', sessionWriteError)
      return NextResponse.json(
        { error: 'Could not start checkout. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    // Customer-facing page: keep the message generic, log the real cause.
    console.error('Public checkout error:', error)
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 500 }
    )
  }
}
