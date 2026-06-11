import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { subscriptionConfirmedEmail, intelActionPlanEmail, paymentFailedEmail } from '@/lib/resend/templates'
import { DUNNING_GRACE_DAYS } from '@/lib/subscription'
import { isLivemode, updateUserWithModeStamp } from '@/lib/stripe-mode'
import { logWebhookEvent } from '@/lib/admin'
import { getBaseUrl } from '@/lib/env'
import { generateActionPlan } from '@/lib/intel/action-plan'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
    throw new Error('STRIPE_SECRET_KEY is misconfigured: expected sk_… or rk_…, not whsec_….')
  }
  return new Stripe(key)
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

function determineTierFromPriceId(price: unknown): 'basic' | 'pro' {
  const priceId = (price as { id?: string })?.id
  if (!priceId) return 'pro'
  const basicPriceIds = [
    process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
  ].filter(Boolean)
  return basicPriceIds.includes(priceId) ? 'basic' : 'pro'
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

  // QA Round 5 mode guard: never let events from the other Stripe mode mutate
  // this database. Test-mode events reaching a live deployment (or vice versa)
  // were how QA branch traffic rewrote production rows matched by
  // stripe_customer_id. Acknowledge with 200 so Stripe stops retrying, but log
  // it as an error so the admin webhook log surfaces the misconfiguration.
  if (event.livemode !== isLivemode()) {
    console.error(
      `Stripe webhook mode mismatch: event.livemode=${event.livemode} but server key is ${isLivemode() ? 'live' : 'test'} mode. ` +
      'A webhook endpoint from the other Stripe mode is pointed at this deployment. Event ignored.',
      { eventId: event.id, type: event.type }
    )
    logWebhookEvent('stripe', event.type, event.id, { type: event.type }, 'error', 'Dropped: event livemode does not match server Stripe key mode').catch(() => {})
    return NextResponse.json({ received: true, ignored: 'livemode_mismatch' })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        // BUG-031 (round 2): harden routing. The previous code only matched
        // `metadata.payment_kind === 'customer_payment'` for connect payments
        // and silently fell through to `handleCheckoutComplete` (subscription
        // handler) for any other metadata variant. `handleCheckoutComplete`
        // then `return`s without throwing when there's no `subscription` on
        // the session, so the webhook responded 200 and Dyia never updated.
        // Treat ANY of: `payment_kind=customer_payment` OR a present
        // `dyia_payment_id` OR a `payment` mode session with a `quote_id`/
        // `job_id` as a customer payment, so we never lose money silently.
        const meta = session.metadata || {}
        const isCustomerPayment =
          meta.payment_kind === 'customer_payment' ||
          !!meta.dyia_payment_id ||
          (session.mode === 'payment' && (meta.quote_id || meta.job_id))

        if (session.mode === 'payment' && meta.purchase_type === 'intel_action_plan') {
          await handleIntelPurchase(supabase, session)
        } else if (session.mode === 'payment' && meta.purchase_type === 'credits') {
          await handleCreditPurchase(supabase, session)
        } else if (isCustomerPayment) {
          await handleCustomerPayment(supabase, session)
        } else if (session.mode === 'subscription') {
          await handleCheckoutComplete(stripe, supabase, session)
        } else {
          // Final guardrail: a payment-mode session we don't recognize. Log
          // loudly so the operator can debug instead of seeing a silent 200.
          console.warn('Stripe checkout.session.completed with unrecognized metadata; not routed to any handler', {
            sessionId: session.id,
            mode: session.mode,
            metadataKeys: Object.keys(meta),
          })
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

      // BUG-031 (round 2): defense-in-depth backup for customer payments.
      // Connect destination charges always emit `payment_intent.succeeded`
      // even when `checkout.session.completed` is misrouted, never
      // delivered, or stripped of metadata in transit. We attach the same
      // `dyia_payment_id` to `payment_intent_data.metadata` at session
      // creation time, so this handler can reconcile independently.
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        await handlePaymentIntentSucceeded(supabase, pi)
        break
      }

      // BUG-031 (round 2): refunds (full or partial) must reflect in Dyia
      // so quote/job status correctly returns to "pending" / "refunded"
      // after STR-010. Without this, a refunded payment keeps showing as
      // paid in the Dyia UI even though the merchant pushed Refund in
      // Stripe Dashboard.
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleChargeRefunded(supabase, charge)
        break
      }

      // Connect merchant onboarding/capability changes. Stripe enables charges
      // and payouts asynchronously (identity review, bank verification), so
      // without this the merchant's Payments hub showed "Setup needed" until
      // they manually clicked refresh. Keep the dyia_users Connect flags live.
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        await handleConnectAccountUpdated(supabase, account)
        break
      }

      // A Checkout Session expired (Stripe expires unpaid sessions ~24h after
      // creation) before the customer paid. Roll the still-unpaid row back to
      // `pending` and drop the dead session handle so the next "Pay" click mints
      // a fresh session and merchant reconciliation stops chasing it. Without
      // this, abandoned links sat in `checkout_created` forever.
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutExpired(supabase, session)
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

  const subscriptionTier = session.metadata?.subscription_tier || determineTierFromPriceId(subscription.items.data[0]?.price)

  // BUG-022 (round 2): stamp `trial_consumed_at` the first time we ever
  // observe a trialing subscription for this user. The migration backfilled
  // existing users, but the previous batch never wired up the webhook to
  // set the column going forward. Without this, the TrialBanner kept
  // showing "Try Pro free" indefinitely after the trial.
  const updatePayload: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: ourStatus,
    subscription_plan: plan,
    subscription_tier: subscriptionTier,
    subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // Fresh checkout always clears any prior dunning stamp.
    payment_failed_at: null,
  }
  if (ourStatus === 'trialing' || subscription.trial_end) {
    const { data: existing } = await supabase
      .from('dyia_users')
      .select('trial_consumed_at')
      .eq('id', dyiaUserId)
      .maybeSingle()
    if (!existing?.trial_consumed_at) {
      updatePayload.trial_consumed_at = new Date().toISOString()
    }
  }

  // Stamp which Stripe mode created these ids (QA Round 5 mode guard).
  const error = await updateUserWithModeStamp(supabase, 'id', dyiaUserId, updatePayload)

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

  // BUG-022 (round 2): we now also need `trial_consumed_at` so we can
  // suppress the "Try Pro free" CTA after the trial has been used. Read it
  // alongside admin/role so we only stamp once.
  const { data: user } = await supabase
    .from('dyia_users')
    .select('is_admin, role, trial_consumed_at')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (user?.is_admin || ['admin', 'super_admin'].includes(user?.role || '')) {
    return
  }

  // Use type assertion for subscription properties
  const sub = subscription as unknown as {
    items: { data: Array<{ price?: { id?: string; recurring?: { interval?: string } } }> }
    current_period_end?: number
    trial_end?: number | null
    cancel_at_period_end?: boolean
  }
  const priceItem = sub.items.data[0]?.price
  const plan = priceItem?.recurring?.interval === 'year' ? 'annual' : 'monthly'
  const periodEnd = sub.current_period_end

  let ourStatus: string = 'inactive'
  if (status === 'active') ourStatus = 'active'
  else if (status === 'trialing') ourStatus = 'trialing'
  else if (status === 'past_due') ourStatus = 'past_due'
  else if (status === 'canceled') ourStatus = 'canceled'

  // Round 4: self-heal stale `subscription_tier` on every Stripe event.
  // Migration 032 defaulted this column to 'basic' for everyone, so legacy
  // Pro users (subscribed before the basic plan existed) carry the wrong
  // tier until their next subscription event. Recomputing it here from the
  // active price ID closes that gap automatically — no backfill script
  // required for any user with ongoing Stripe activity.
  const tierFromPrice = determineTierFromPriceId(priceItem)

  const updatePayload: Record<string, unknown> = {
    subscription_status: ourStatus,
    subscription_plan: plan,
    subscription_tier: tierFromPrice,
    subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // Mirror Stripe's scheduled-downgrade flag so the in-app Settings UI can
    // show "Downgrading on <date>" (and the undo) without calling Stripe.
    cancel_at_period_end: !!sub.cancel_at_period_end,
  }
  // First time we ever see this user trialing (or holding a trial_end), or
  // any time their subscription transitions out of trialing — stamp the
  // consumption timestamp so the trial-offer banner self-suppresses.
  const looksLikeTrialUsage = ourStatus === 'trialing' || !!sub.trial_end
  if (looksLikeTrialUsage && !user?.trial_consumed_at) {
    updatePayload.trial_consumed_at = new Date().toISOString()
  }

  // Round 4 (BUG-022): clear the dunning stamp the moment a subscription
  // returns to `active` or `trialing`. Without this, a customer who fixed
  // their card would still see the dunning banner until they navigated to
  // a screen that re-fetched. Idempotent: column-already-null is a no-op.
  if (ourStatus === 'active' || ourStatus === 'trialing') {
    updatePayload.payment_failed_at = null
  }

  // Stamp which Stripe mode produced this update (QA Round 5 mode guard).
  const error = await updateUserWithModeStamp(supabase, 'stripe_customer_id', customerId, updatePayload)

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
      // Final cancellation: the downgrade has now happened, so the scheduled
      // flag no longer applies, and the user is on Basic. Leaving tier='pro'
      // here left stale data that disagreed with their actual access.
      subscription_tier: 'basic',
      cancel_at_period_end: false,
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error canceling subscription:', error)
    throw error
  }
}

// Round 4 (BUG-022): on the first invoice.payment_failed for a customer, stamp
// `payment_failed_at` so `computeSubscriptionState` can apply the 7-day
// dunning grace window. We only stamp when the column is currently null —
// Stripe Smart Retries will fire this webhook 3-4 times during dunning and
// we must not reset the clock on each retry.
//
// We also send the customer an email so they don't have to discover the
// failed charge by checking their bank app (Hanna's Round 4 finding).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const { data: user } = await supabase
    .from('dyia_users')
    .select('id, email, first_name, is_admin, role, payment_failed_at, subscription_plan')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (user?.is_admin || ['admin', 'super_admin'].includes(user?.role || '')) {
    return
  }

  const updatePayload: Record<string, unknown> = { subscription_status: 'past_due' }
  const isFirstFailure = !user?.payment_failed_at
  if (isFirstFailure) {
    updatePayload.payment_failed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('dyia_users')
    .update(updatePayload)
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error updating payment failed status:', error)
    throw error
  }

  // Notify the customer once on first failure. Subsequent Smart Retry
  // failures don't re-email — Stripe handles its own retry cadence and
  // re-emailing every 2 days during dunning is annoying.
  if (isFirstFailure && user?.email && isResendConfigured()) {
    try {
      const plan = (user.subscription_plan || null) as 'monthly' | 'annual' | null
      await sendEmail(
        user.email,
        'Action needed — your Dyia payment failed',
        paymentFailedEmail(user.first_name || 'there', DUNNING_GRACE_DAYS, plan),
        'payment_failed',
        user.id,
      )
    } catch (emailErr) {
      console.error('Payment failed email send failed:', emailErr)
    }
  }
}

// Stripe Connect customer payment: mark dyia_payments as paid and update the
// associated quote or job payment_status. The checkout session metadata carries
// dyia_payment_id, quote_id, and job_id set in /api/payments/public/[token]/checkout.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCustomerPayment(supabase: any, session: Stripe.Checkout.Session) {
  const dyiaPaymentId = session.metadata?.dyia_payment_id
  if (!dyiaPaymentId) {
    console.error('Customer payment webhook: missing dyia_payment_id in session metadata')
    return
  }

  const paymentIntentId = session.payment_intent as string | null
  const now = new Date().toISOString()

  // Anything paid above the base amount is the customer's tip (100% to merchant).
  const { data: baseRow } = await supabase
    .from('dyia_payments')
    .select('amount_cents')
    .eq('id', dyiaPaymentId)
    .maybeSingle()
  const tipCents =
    typeof session.amount_total === 'number' && baseRow?.amount_cents
      ? Math.max(0, session.amount_total - baseRow.amount_cents)
      : 0

  const { error: paymentError } = await supabase
    .from('dyia_payments')
    .update({
      status: 'paid',
      stripe_payment_intent_id: paymentIntentId || null,
      paid_at: now,
      tip_cents: tipCents,
    })
    .eq('id', dyiaPaymentId)

  if (paymentError) {
    console.error('Customer payment: failed to update dyia_payments', paymentError)
    throw paymentError
  }

  const quoteId = session.metadata?.quote_id
  if (quoteId) {
    const { error: quoteError } = await supabase
      .from('dyia_quotes')
      .update({
        payment_status: 'paid',
        payment_paid_at: now,
      })
      .eq('id', quoteId)

    if (quoteError) {
      console.error('Customer payment: failed to update dyia_quotes', quoteError)
      throw quoteError
    }
  }

  const jobId = session.metadata?.job_id
  if (jobId) {
    const { error: jobError } = await supabase
      .from('dyia_jobs')
      .update({
        payment_status: 'paid',
        payment_paid_at: now,
      })
      .eq('id', jobId)

    if (jobError) {
      console.error('Customer payment: failed to update dyia_jobs', jobError)
      throw jobError
    }
  }
}

// A customer Checkout Session expired before payment. Reset the linked
// dyia_payments row from `checkout_created` back to `pending` so the link is
// payable again with a fresh session. Guarded so it never disturbs a row that
// already reached paid/refunded (handles the pay-right-at-expiry race).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckoutExpired(supabase: any, session: Stripe.Checkout.Session) {
  // Only customer (Connect) payments carry dyia_payment_id; subscription
  // checkout expirations have no row to reset here.
  const dyiaPaymentId = session.metadata?.dyia_payment_id
  if (!dyiaPaymentId) return

  const { error } = await supabase
    .from('dyia_payments')
    .update({
      status: 'pending',
      stripe_checkout_session_id: null,
      checkout_url: null,
    })
    .eq('id', dyiaPaymentId)
    .eq('status', 'checkout_created')

  if (error) {
    console.error('checkout.session.expired: failed to reset payment', error)
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
    throw new Error('Intel purchase webhook: missing scan_id in session metadata')
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
            reportUrl: `${baseUrl}/report?scan_id=${scanId}`,
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

// BUG-031 (round 2): payment_intent.succeeded backup handler.
// This catches Connect destination charges even when:
//   - checkout.session.completed never arrives (dashboard misconfig)
//   - the session metadata gets stripped or differs from PI metadata
//   - the operator only enabled PI events on the connected account
// `payment_intent_data.metadata` is set in
// /api/payments/public/[token]/checkout, so dyia_payment_id will be present
// on the PaymentIntent itself.
//
// The handler is idempotent: applying "paid" twice is a no-op for the UI
// since `paid_at` already exists and `status` is already 'paid'.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentIntentSucceeded(supabase: any, pi: Stripe.PaymentIntent) {
  const meta = pi.metadata || {}
  const dyiaPaymentId = meta.dyia_payment_id
  const quoteId = meta.quote_id
  const jobId = meta.job_id
  const paymentKind = meta.payment_kind

  if (paymentKind && paymentKind !== 'customer_payment') {
    return
  }

  // Try to resolve dyiaPaymentId from the PI id if metadata is missing.
  // Earlier session-based handler may have already attached the PI id.
  let resolvedPaymentId = dyiaPaymentId
  if (!resolvedPaymentId) {
    const { data: existing } = await supabase
      .from('dyia_payments')
      .select('id')
      .eq('stripe_payment_intent_id', pi.id)
      .maybeSingle()
    resolvedPaymentId = existing?.id
  }

  if (!resolvedPaymentId) {
    if (!paymentKind && !quoteId && !jobId) {
      // Not a Dyia customer payment. Don't treat as an error.
      return
    }
    console.warn('payment_intent.succeeded: could not resolve dyia_payment_id', {
      paymentIntentId: pi.id,
      metadataKeys: Object.keys(meta),
    })
    return
  }

  const now = new Date().toISOString()

  const { data: paymentRow, error: paymentSelectError } = await supabase
    .from('dyia_payments')
    .select('id, status, quote_id, job_id, amount_cents')
    .eq('id', resolvedPaymentId)
    .maybeSingle()

  if (paymentSelectError) {
    console.error('payment_intent.succeeded: failed to load dyia_payments row', paymentSelectError)
    throw paymentSelectError
  }
  if (!paymentRow) {
    console.warn('payment_intent.succeeded: dyia_payments row not found for resolved id', { resolvedPaymentId })
    return
  }

  if (paymentRow.status !== 'paid') {
    // Amount charged above the base is the customer's tip (100% to merchant).
    const tipCents =
      typeof pi.amount === 'number' && paymentRow.amount_cents
        ? Math.max(0, pi.amount - paymentRow.amount_cents)
        : 0
    const { error: paymentError } = await supabase
      .from('dyia_payments')
      .update({
        status: 'paid',
        stripe_payment_intent_id: pi.id,
        paid_at: now,
        tip_cents: tipCents,
      })
      .eq('id', resolvedPaymentId)

    if (paymentError) {
      console.error('payment_intent.succeeded: failed to update dyia_payments', paymentError)
      throw paymentError
    }
  }

  const linkedQuoteId = quoteId || paymentRow.quote_id
  if (linkedQuoteId) {
    const { error: quoteError } = await supabase
      .from('dyia_quotes')
      .update({ payment_status: 'paid', payment_paid_at: now })
      .eq('id', linkedQuoteId)
    if (quoteError) {
      console.error('payment_intent.succeeded: failed to update dyia_quotes', quoteError)
    }
  }

  const linkedJobId = jobId || paymentRow.job_id
  if (linkedJobId) {
    const { error: jobError } = await supabase
      .from('dyia_jobs')
      .update({ payment_status: 'paid', payment_paid_at: now })
      .eq('id', linkedJobId)
    if (jobError) {
      console.error('payment_intent.succeeded: failed to update dyia_jobs', jobError)
    }
  }
}

// BUG-031 (round 2): charge.refunded handler so STR-010 (refund a customer
// payment from the Stripe dashboard) is reflected in Dyia. Without this,
// a refunded quote/job stayed marked "paid" in the app forever even though
// the funds were returned via Stripe.
//
// Stripe emits `charge.refunded` after either a full or partial refund.
// We mark the dyia_payments row 'refunded' (full) or 'partial_refund' (partial),
// and set the linked quote/job back to 'pending' (for full refunds) so the
// "Request Payment" CTA re-appears. Partial refunds keep paid status to avoid
// accidentally enabling re-payment of an already-mostly-paid invoice.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleChargeRefunded(supabase: any, charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
  if (!piId) {
    return
  }

  const { data: payment, error: lookupError } = await supabase
    .from('dyia_payments')
    .select('id, quote_id, job_id, amount_cents')
    .eq('stripe_payment_intent_id', piId)
    .maybeSingle()

  if (lookupError) {
    console.error('charge.refunded: lookup failed', lookupError)
    throw lookupError
  }
  if (!payment) {
    return
  }

  const refunded = charge.amount_refunded || 0
  const isFull = refunded >= (charge.amount || 0) || refunded >= (payment.amount_cents || 0)
  const now = new Date().toISOString()
  const newStatus = isFull ? 'refunded' : 'partial_refund'

  const { error: paymentError } = await supabase
    .from('dyia_payments')
    .update({
      status: newStatus,
      refunded_at: now,
      refunded_amount_cents: refunded,
    })
    .eq('id', payment.id)

  if (paymentError) {
    // Some installs may not have refunded_* columns yet; fall back to status only.
    console.warn('charge.refunded: full refund payload failed, retrying with status only', paymentError)
    await supabase
      .from('dyia_payments')
      .update({ status: newStatus })
      .eq('id', payment.id)
  }

  if (isFull && payment.quote_id) {
    await supabase
      .from('dyia_quotes')
      .update({ payment_status: 'pending', payment_paid_at: null })
      .eq('id', payment.quote_id)
  }
  if (isFull && payment.job_id) {
    await supabase
      .from('dyia_jobs')
      .update({ payment_status: 'pending', payment_paid_at: null })
      .eq('id', payment.job_id)
  }
}

// Connect `account.updated`: sync the merchant's onboarding/capability flags so
// the Payments hub flips to "Live" automatically when Stripe finishes enabling
// charges/payouts, without the merchant having to click refresh.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleConnectAccountUpdated(supabase: any, account: Stripe.Account) {
  const { data: user } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('stripe_connect_account_id', account.id)
    .maybeSingle()

  if (!user) {
    // Not one of our connected accounts (or not yet linked). Nothing to do.
    return
  }

  const detailsSubmitted = Boolean(account.details_submitted)
  const chargesEnabled = Boolean(account.charges_enabled)
  const payoutsEnabled = Boolean(account.payouts_enabled)
  const onboardingComplete = detailsSubmitted && chargesEnabled

  const { error } = await supabase
    .from('dyia_users')
    .update({
      stripe_connect_onboarding_complete: onboardingComplete,
      stripe_connect_details_submitted: detailsSubmitted,
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      stripe_connect_country: account.country || null,
      stripe_connect_default_currency: account.default_currency || null,
    })
    .eq('id', user.id)

  if (error) {
    console.error('account.updated: failed to sync connect flags', error)
    throw error
  }
}
