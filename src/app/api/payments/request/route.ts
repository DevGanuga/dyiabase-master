import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getBaseUrl } from '@/lib/env'
import {
  calculateApplicationFee,
  generatePublicPaymentToken,
  getSupabaseAdmin,
} from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const { quoteId, jobId } = await request.json()

    if ((!quoteId && !jobId) || (quoteId && jobId)) {
      return NextResponse.json({ error: 'Provide either quoteId or jobId' }, { status: 400 })
    }

    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // BUG-030: surface which specific onboarding step is incomplete so the
    // user can fix it in the Payments tab rather than seeing a generic error.
    if (!user.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'Stripe is not yet connected. Go to Payments and click "Connect with Stripe" to finish onboarding.' },
        { status: 400 }
      )
    }
    if (!user.stripe_connect_charges_enabled) {
      return NextResponse.json(
        { error: 'Stripe onboarding is incomplete — charges are not yet enabled. Open the Payments tab to finish the required steps in Stripe.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const publicToken = generatePublicPaymentToken()
    const currency = (user.stripe_connect_default_currency || 'usd').toLowerCase()

    if (quoteId) {
      const { data: quote, error: quoteError } = await supabase
        .from('dyia_quotes')
        .select('*')
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .single()

      if (quoteError || !quote) {
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
      }

      if (quote.payment_status === 'paid') {
        return NextResponse.json({ error: 'This quote is already marked as paid.' }, { status: 400 })
      }

      const amountCents = Math.round(Number(quote.total || 0) * 100)
      if (amountCents <= 0) {
        return NextResponse.json({ error: 'Quote total must be greater than zero.' }, { status: 400 })
      }

      const applicationFeeAmountCents = calculateApplicationFee(amountCents)
      const destinationAmountCents = Math.max(0, amountCents - applicationFeeAmountCents)

      const { data: payment, error: paymentError } = await supabase
        .from('dyia_payments')
        .insert({
          user_id: user.id,
          quote_id: quote.id,
          public_token: publicToken,
          stripe_connected_account_id: user.stripe_connect_account_id,
          status: 'pending',
          amount_cents: amountCents,
          application_fee_amount_cents: applicationFeeAmountCents,
          destination_amount_cents: destinationAmountCents,
          currency,
          customer_name: quote.customer_name,
          customer_email: quote.customer_email,
          description: `Payment for quote for ${quote.customer_name}`,
          metadata: {
            resource_type: 'quote',
            quote_id: quote.id,
          },
        })
        .select('id')
        .single()

      if (paymentError || !payment) {
        throw paymentError || new Error('Could not create payment request')
      }

      await supabase
        .from('dyia_quotes')
        .update({
          payment_status: 'pending',
          payment_amount_cents: amountCents,
          payment_requested_at: now,
          payment_last_request_id: payment.id,
        })
        .eq('id', quote.id)

      const shareUrl = `${getBaseUrl()}/pay/${publicToken}`
      return NextResponse.json({ shareUrl, amountCents, paymentId: payment.id })
    }

    const { data: job, error: jobError } = await supabase
      .from('dyia_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.payment_status === 'paid') {
      return NextResponse.json({ error: 'This job is already marked as paid.' }, { status: 400 })
    }

    const amountCents = Math.round(Number(job.revenue || 0) * 100)
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Job revenue must be greater than zero.' }, { status: 400 })
    }

    const applicationFeeAmountCents = calculateApplicationFee(amountCents)
    const destinationAmountCents = Math.max(0, amountCents - applicationFeeAmountCents)

    const { data: payment, error: paymentError } = await supabase
      .from('dyia_payments')
      .insert({
        user_id: user.id,
        job_id: job.id,
        public_token: publicToken,
        stripe_connected_account_id: user.stripe_connect_account_id,
        status: 'pending',
        amount_cents: amountCents,
        application_fee_amount_cents: applicationFeeAmountCents,
        destination_amount_cents: destinationAmountCents,
        currency,
        customer_name: job.customer_name,
        description: `Payment for job for ${job.customer_name}`,
        metadata: {
          resource_type: 'job',
          job_id: job.id,
        },
      })
      .select('id')
      .single()

    if (paymentError || !payment) {
      throw paymentError || new Error('Could not create payment request')
    }

    await supabase
      .from('dyia_jobs')
      .update({
        payment_status: 'pending',
        payment_amount_cents: amountCents,
        payment_requested_at: now,
        payment_last_request_id: payment.id,
      })
      .eq('id', job.id)

    const shareUrl = `${getBaseUrl()}/pay/${publicToken}`
    return NextResponse.json({ shareUrl, amountCents, paymentId: payment.id })
  } catch (error) {
    console.error('Payment request error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
