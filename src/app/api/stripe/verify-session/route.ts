import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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

/**
 * POST: Verify a Stripe checkout session and synchronously activate the subscription.
 *
 * This eliminates the race condition where the client returns from Stripe checkout
 * before the async webhook has updated the user's subscription status.
 * The webhook still fires as a safety net, but this endpoint makes activation
 * synchronous from the client's perspective.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const stripe = getStripe()
    const supabase = getSupabase()

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    // Validate that this checkout session belongs to the authenticated user
    const sessionClerkId = session.metadata?.clerk_user_id || session.client_reference_id
    if (sessionClerkId !== clerkUserId) {
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 })
    }

    // Look up the dyia user
    const { data: dyiaUser, error: userError } = await supabase
      .from('dyia_users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !dyiaUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isAdmin = !!dyiaUser.is_admin || ['admin', 'super_admin'].includes(dyiaUser.role || '')
    if (isAdmin) {
      const subscriptionId = session.subscription as string | null
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        if (subscription.status !== 'canceled') {
          await stripe.subscriptions.cancel(subscriptionId)
        }
      }

      const { data: updatedAdmin, error: adminUpdateError } = await supabase
        .from('dyia_users')
        .update({
          subscription_status: 'active',
          subscription_plan: 'annual',
          subscription_ends_at: null,
          stripe_subscription_id: null,
        })
        .eq('id', dyiaUser.id)
        .select()
        .single()

      if (adminUpdateError) {
        console.error('Error normalizing admin subscription via verify-session:', adminUpdateError)
        return NextResponse.json({ error: 'Failed to normalize admin account' }, { status: 500 })
      }

      return NextResponse.json({ profile: updatedAdmin })
    }

    // If subscription is already active/trialing, the webhook already handled it — return current profile
    if (['active', 'trialing'].includes(dyiaUser.subscription_status)) {
      return NextResponse.json({ profile: dyiaUser })
    }

    // For one-time payments (credits), no subscription to activate
    if (session.mode === 'payment') {
      return NextResponse.json({ profile: dyiaUser })
    }

    const subscriptionId = session.subscription as string | null
    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No subscription found on checkout session' },
        { status: 400 }
      )
    }

    const customerId = session.customer as string

    // Retrieve the subscription from Stripe to get the real status
    const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId)
    const subscription = subscriptionResponse as unknown as {
      status: string
      items: { data: Array<{ price?: { recurring?: { interval?: string } } }> }
      current_period_end?: number
      trial_end?: number | null
    }

    const plan = subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly'

    let ourStatus: string = 'inactive'
    if (subscription.status === 'active') ourStatus = 'active'
    else if (subscription.status === 'trialing') ourStatus = 'trialing'
    else if (subscription.status === 'past_due') ourStatus = 'past_due'
    else if (subscription.status === 'canceled') ourStatus = 'canceled'

    const periodEnd = subscription.trial_end || subscription.current_period_end

    const { data: updatedUser, error: updateError } = await supabase
      .from('dyia_users')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        subscription_status: ourStatus,
        subscription_plan: plan,
        subscription_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      })
      .eq('id', dyiaUser.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating user subscription via verify-session:', updateError)
      return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 })
    }

    return NextResponse.json({ profile: updatedUser })
  } catch (error) {
    console.error('Verify-session error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
