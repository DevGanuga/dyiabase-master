import { NextRequest, NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/env'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'

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

    // For invoices, surface real line items to Stripe Checkout so the
    // customer sees an itemized receipt that matches the Dyia invoice page.
    // Tax is added as a separate line item to avoid configuring Stripe Tax.
    const storedLineItems = Array.isArray(payment.line_items) ? payment.line_items : []
    const checkoutLineItems = storedLineItems.length > 0
      ? storedLineItems
          .filter((item: { description?: unknown; quantity?: unknown; unitAmountCents?: unknown }) =>
            item && typeof item === 'object'
          )
          .map((item: { description: string; quantity: number; unitAmountCents: number }) => ({
            price_data: {
              currency: payment.currency,
              product_data: { name: item.description },
              unit_amount: Math.max(0, Math.round(item.unitAmountCents)),
            },
            quantity: Math.max(1, Math.round(item.quantity)),
          }))
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

    await supabase
      .from('dyia_payments')
      .update({
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
        status: 'checkout_created',
      })
      .eq('id', payment.id)

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('Public checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
