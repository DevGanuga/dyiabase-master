import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { subscriptionConfirmedEmail, intelActionPlanEmail } from '@/lib/resend/templates'
import { logWebhookEvent } from '@/lib/admin'
import { getBaseUrl } from '@/lib/env'
import { generateActionPlan } from '@/lib/intel/action-plan'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  const stripe = getStripe()
  const supabase = getSupabase()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment' && session.metadata?.purchase_type === 'intel_action_plan') {
          await handleIntelPurchase(supabase, session)
        } else if (session.mode === 'payment' && session.metadata?.purchase_type === 'credits') {
          await handleCreditPurchase(supabase, session)
        } else {
          await handleCheckoutComplete(stripe, supabase, session)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCanceled(supabase, subscription)
        break
      }

      case 'invoice.paid': {
        // Handles trial-to-paid conversion and recurring payments
        const paidInvoice = event.data.object as Stripe.Invoice & { subscription?: string | null }
        if (paidInvoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(paidInvoice.subscription)
          await handleSubscriptionUpdate(supabase, sub)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      default:
        console.warn(`Unhandled event type: ${event.type}`)
    }

    // Log successful webhook event
    logWebhookEvent('stripe', event.type, event.id, { type: event.type, data_object_id: (event.data.object as { id?: string }).id }).catch(() => {})

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    // Log failed webhook event
    logWebhookEvent('stripe', event.type, event.id, { type: event.type }, 'error', error instanceof Error ? error.message : 'Unknown error').catch(() => {})
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckoutComplete(stripe: Stripe, supabase: any, session: Stripe.Checkout.Session) {
  // Get dyia_user_id from metadata (preferred) or lookup by clerk_user_id
  let dyiaUserId = session.metadata?.dyia_user_id
  const clerkUserId = session.metadata?.clerk_user_id || session.client_reference_id
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  // If no dyia_user_id in metadata, look it up from clerk_user_id
  if (!dyiaUserId && clerkUserId) {
    const { data: user } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()
    
    if (user) {
      dyiaUserId = user.id
    }
  }

  if (!dyiaUserId) {
    console.error('No dyia user ID found in session metadata or by clerk_user_id lookup')
    return
  }

  if (!subscriptionId) {
    console.error('No subscription ID in checkout session')
    return
  }

  const { data: currentUser } = await supabase
    .from('dyia_users')
    .select('id, is_admin, role')
    .eq('id', dyiaUserId)
    .single()

  if (currentUser?.is_admin || ['admin', 'super_admin'].includes(currentUser?.role || '')) {
    const adminSubscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (adminSubscription.status !== 'canceled') {
      await stripe.subscriptions.cancel(subscriptionId)
    }

    await supabase
      .from('dyia_users')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        subscription_status: 'active',
        subscription_plan: 'annual',
        subscription_ends_at: null,
      })
      .eq('id', dyiaUserId)
    return
  }

  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
  // Use type assertion to handle the response
  const subscription = subscriptionResponse as unknown as { 
    status: string
    items: { data: Array<{ price?: { recurring?: { interval?: string } } }> }
    current_period_end?: number
    trial_end?: number | null
  }
  const plan = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly'
  
  // Use the ACTUAL subscription status from Stripe (will be 'trialing' for trial subscriptions)
  let ourStatus: string = 'inactive'
  if (subscription.status === 'active') ourStatus = 'active'
  else if (subscription.status === 'trialing') ourStatus = 'trialing'
  else if (subscription.status === 'past_due') ourStatus = 'past_due'
  else if (subscription.status === 'canceled') ourStatus = 'canceled'

  // For trials, use trial_end as the period end; otherwise use current_period_end
  const periodEnd = subscription.trial_end || subscription.current_period_end

  const { error } = await supabase
    .from('dyia_users')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: ourStatus,
      subscription_plan: plan,
      subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq('id', dyiaUserId)

  if (error) {
    console.error('Error updating user subscription:', error)
    throw error
  }

  // Send subscription confirmed email if Resend is configured
  if (isResendConfigured()) {
    try {
      const { data: u } = await supabase
        .from('dyia_users')
        .select('email, first_name')
        .eq('id', dyiaUserId)
        .single()
      if (u?.email) {
        await sendEmail(
          u.email,
          'Welcome to Dyia Pro! 🚀',
          subscriptionConfirmedEmail(u.first_name || 'there', plan),
          'subscription_confirmed',
          dyiaUserId
        )
      }
    } catch (emailErr) {
      console.error('Subscription confirmed email failed:', emailErr)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const status = subscription.status

  const { data: user } = await supabase
    .from('dyia_users')
    .select('is_admin, role')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (user?.is_admin || ['admin', 'super_admin'].includes(user?.role || '')) {
    return
  }
  
  // Use type assertion for subscription properties
  const sub = subscription as unknown as { 
    items: { data: Array<{ price?: { recurring?: { interval?: string } } }> }
    current_period_end?: number 
  }
  const plan = sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly'
  const periodEnd = sub.current_period_end

  let ourStatus: string = 'inactive'
  if (status === 'active') ourStatus = 'active'
  else if (status === 'trialing') ourStatus = 'trialing'
  else if (status === 'past_due') ourStatus = 'past_due'
  else if (status === 'canceled') ourStatus = 'canceled'

  const { error } = await supabase
    .from('dyia_users')
    .update({
      subscription_status: ourStatus,
      subscription_plan: plan,
      subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error updating subscription:', error)
    throw error
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const sub = subscription as unknown as { current_period_end?: number }
  const periodEnd = sub.current_period_end

  const { data: user } = await supabase
    .from('dyia_users')
    .select('is_admin, role')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (user?.is_admin || ['admin', 'super_admin'].includes(user?.role || '')) {
    return
  }

  const { error } = await supabase
    .from('dyia_users')
    .update({
      subscription_status: 'canceled',
      subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const { data: user } = await supabase
    .from('dyia_users')
    .select('is_admin, role')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (user?.is_admin || ['admin', 'super_admin'].includes(user?.role || '')) {
    return
  }

  const { error } = await supabase
    .from('dyia_users')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error updating payment failed status:', error)
    throw error
  }
}

// Intel Action Plan purchase: mark scan as purchased and send email.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleIntelPurchase(supabase: any, session: Stripe.Checkout.Session) {
  const scanId = session.metadata?.scan_id
  const email = session.metadata?.email

  if (!scanId) {
    console.error('Intel purchase: missing scan_id in metadata')
    return
  }

  // Mark the scan as purchased
  const { error: updateError } = await supabase
    .from('dyia_intel_scans')
    .update({
      stripe_session_id: session.id,
      action_plan_purchased: true,
    })
    .eq('id', scanId)

  if (updateError) {
    console.error('Intel purchase: failed to update scan', updateError)
    throw updateError
  }

  // Send the action plan email
  if (email && isResendConfigured()) {
    try {
      const { data: scan } = await supabase
        .from('dyia_intel_scans')
        .select('business_name, scan_data, action_plan')
        .eq('id', scanId)
        .single()

      if (scan?.scan_data) {
        let actionPlan = scan.action_plan

        if (!actionPlan) {
          actionPlan = await generateActionPlan(scan.scan_data, scan.business_name)
          await supabase
            .from('dyia_intel_scans')
            .update({ action_plan: actionPlan })
            .eq('id', scanId)
        }

        const baseUrl = getBaseUrl()
        await sendEmail(
          email,
          `Your ${scan.business_name} Action Plan — Dyia Intel`,
          intelActionPlanEmail({
            businessName: scan.business_name,
            localRank: scan.scan_data.local_rank,
            totalCompetitors: scan.scan_data.total_competitors,
            reviewGap: scan.scan_data.review_gap,
            missingKeywordsCount: scan.scan_data.missing_keywords_count,
            actionSteps: actionPlan.map((s: { step_number: number; priority: string; title: string; description: string }) => ({
              stepNumber: s.step_number,
              priority: s.priority,
              title: s.title,
              description: s.description,
            })),
            reportUrl: `${baseUrl}/intel/report?scan_id=${scanId}`,
          }),
          'intel_action_plan'
        )
      }
    } catch (emailErr) {
      console.error('Intel action plan email failed:', emailErr)
    }
  }
}

// One-time credit purchase: add credits to user and log transaction.
// Metadata: purchase_type='credits', credits_amount=<number>, dyia_user_id (or clerk_user_id).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCreditPurchase(supabase: any, session: Stripe.Checkout.Session) {
  let dyiaUserId = session.metadata?.dyia_user_id
  const clerkUserId = session.metadata?.clerk_user_id || session.client_reference_id
  const creditsAmount = parseInt(session.metadata?.credits_amount as string || '0', 10)

  if (!dyiaUserId && clerkUserId) {
    const { data: user } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()
    if (user) dyiaUserId = user.id
  }

  if (!dyiaUserId || creditsAmount <= 0) {
    console.error('Credit purchase: missing dyia_user_id or invalid credits_amount', { dyiaUserId, creditsAmount })
    return
  }

  const paymentId = session.payment_intent?.toString() || session.id
  const { data: applyResult, error: applyError } = await supabase.rpc('dyia_apply_credit_purchase', {
    p_user_id: dyiaUserId,
    p_amount: creditsAmount,
    p_stripe_payment_id: paymentId,
    p_description: `Purchased ${creditsAmount} AI credits`,
    p_metadata: {
      stripe_checkout_session_id: session.id,
    },
  })

  if (applyError) {
    console.error('Credit purchase: failed to apply purchase', applyError)
    throw applyError
  }

  const result = Array.isArray(applyResult) ? applyResult[0] : null
  if (!result) {
    throw new Error('Credit purchase: empty response from dyia_apply_credit_purchase')
  }

  if (!result.applied) {
    console.info('Credit purchase: duplicate webhook ignored', {
      paymentId,
      dyiaUserId,
      stripeCheckoutSessionId: session.id,
    })
  }
}
