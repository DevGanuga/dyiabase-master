import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getBaseUrl } from '@/lib/env'
import { getErrorMessage } from '@/lib/errors'
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

      // Idempotent get-or-create: re-clicking "Request Payment" must NOT spawn a
      // duplicate row. Reuse an existing not-yet-paid request for this quote and
      // refresh its amount/fee so a changed quote total stays in sync.
      const { data: existing } = await supabase
        .from('dyia_payments')
        .select('id, public_token')
        .eq('user_id', user.id)
        .eq('quote_id', quote.id)
        .in('status', ['pending', 'checkout_created'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let paymentId: string
      let token: string

      if (existing) {
        const { error: reuseError } = await supabase
          .from('dyia_payments')
          .update({
            status: 'pending',
            amount_cents: amountCents,
            application_fee_amount_cents: applicationFeeAmountCents,
            destination_amount_cents: destinationAmountCents,
            tip_cents: 0,
            currency,
            customer_name: quote.customer_name,
            customer_email: quote.customer_email,
            customer_phone: quote.customer_phone,
            customer_address: quote.customer_address,
          })
          .eq('id', existing.id)
        if (reuseError) throw reuseError
        paymentId = existing.id
        token = existing.public_token
      } else {
        const { data: payment, error: paymentError } = await supabase
          .from('dyia_payments')
          .insert({
            user_id: user.id,
            quote_id: quote.id,
            public_token: publicToken,
            stripe_connected_account_id: user.stripe_connect_account_id,
            kind: 'quote_payment',
            status: 'pending',
            amount_cents: amountCents,
            application_fee_amount_cents: applicationFeeAmountCents,
            destination_amount_cents: destinationAmountCents,
            allow_tip: true,
            currency,
            customer_name: quote.customer_name,
            customer_email: quote.customer_email,
            customer_phone: quote.customer_phone,
            customer_address: quote.customer_address,
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
        paymentId = payment.id
        token = publicToken
      }

      const { error: quoteUpdateError } = await supabase
        .from('dyia_quotes')
        .update({
          payment_status: 'pending',
          payment_amount_cents: amountCents,
          payment_requested_at: now,
          payment_last_request_id: paymentId,
        })
        .eq('id', quote.id)

      if (quoteUpdateError) {
        // The payment row exists but the quote didn't get marked pending —
        // surface it instead of letting the merchant UI silently desync.
        throw quoteUpdateError
      }

      const shareUrl = `${getBaseUrl()}/pay/${token}`
      return NextResponse.json({ shareUrl, amountCents, paymentId })
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

    // Idempotent get-or-create (see quote branch): reuse an existing not-yet-paid
    // request for this job rather than spawning a duplicate row on re-click.
    const { data: existingJobPayment } = await supabase
      .from('dyia_payments')
      .select('id, public_token')
      .eq('user_id', user.id)
      .eq('job_id', job.id)
      .in('status', ['pending', 'checkout_created'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let jobPaymentId: string
    let jobToken: string

    if (existingJobPayment) {
      const { error: reuseError } = await supabase
        .from('dyia_payments')
        .update({
          status: 'pending',
          amount_cents: amountCents,
          application_fee_amount_cents: applicationFeeAmountCents,
          destination_amount_cents: destinationAmountCents,
          tip_cents: 0,
          currency,
          customer_name: job.customer_name,
        })
        .eq('id', existingJobPayment.id)
      if (reuseError) throw reuseError
      jobPaymentId = existingJobPayment.id
      jobToken = existingJobPayment.public_token
    } else {
      const { data: payment, error: paymentError } = await supabase
        .from('dyia_payments')
        .insert({
          user_id: user.id,
          job_id: job.id,
          public_token: publicToken,
          stripe_connected_account_id: user.stripe_connect_account_id,
          kind: 'job_payment',
          status: 'pending',
          amount_cents: amountCents,
          application_fee_amount_cents: applicationFeeAmountCents,
          destination_amount_cents: destinationAmountCents,
          allow_tip: true,
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
      jobPaymentId = payment.id
      jobToken = publicToken
    }

    const { error: jobUpdateError } = await supabase
      .from('dyia_jobs')
      .update({
        payment_status: 'pending',
        payment_amount_cents: amountCents,
        payment_requested_at: now,
        payment_last_request_id: jobPaymentId,
      })
      .eq('id', job.id)

    if (jobUpdateError) {
      throw jobUpdateError
    }

    const shareUrl = `${getBaseUrl()}/pay/${jobToken}`
    return NextResponse.json({ shareUrl, amountCents, paymentId: jobPaymentId })
  } catch (error) {
    console.error('Payment request error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Could not create payment link') },
      { status: 500 }
    )
  }
}
