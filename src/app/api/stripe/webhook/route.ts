import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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
        await handleCheckoutComplete(stripe, supabase, session)
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

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabase, invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
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

  const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
  // Use type assertion to handle the response
  const subscription = subscriptionResponse as unknown as { 
    items: { data: Array<{ price?: { recurring?: { interval?: string } } }> }
    current_period_end?: number 
  }
  const plan = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly'
  const periodEnd = subscription.current_period_end

  const { error } = await supabase
    .from('dyia_users')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: 'active',
      subscription_plan: plan,
      subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq('id', dyiaUserId)

  if (error) {
    console.error('Error updating user subscription:', error)
    throw error
  }

  console.log(`Subscription activated for dyia user ${dyiaUserId}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdate(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const status = subscription.status
  
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

  console.log(`Subscription updated for customer ${customerId}: ${ourStatus}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(supabase: any, subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  const sub = subscription as unknown as { current_period_end?: number }
  const periodEnd = sub.current_period_end

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

  console.log(`Subscription canceled for customer ${customerId}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePaymentFailed(supabase: any, invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string

  const { error } = await supabase
    .from('dyia_users')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error updating payment failed status:', error)
    throw error
  }

  console.log(`Payment failed for customer ${customerId}`)
}
