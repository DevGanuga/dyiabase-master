import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { requireAdmin } from '@/lib/admin'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
    throw new Error('STRIPE_SECRET_KEY is misconfigured: expected sk_… or rk_…, not whsec_….')
  }
  return new Stripe(key)
}

type TargetTier = 'basic' | 'pro'
type TargetPlan = 'monthly' | 'annual'

function priceIdFor(tier: TargetTier, plan: TargetPlan): string | null {
  if (tier === 'basic' && plan === 'monthly') return process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID || null
  if (tier === 'basic' && plan === 'annual') return process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID || null
  if (tier === 'pro' && plan === 'monthly') return process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID || null
  if (tier === 'pro' && plan === 'annual') return process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID || null
  return null
}

/**
 * POST /api/admin/switch-plan
 *
 * Switch a user's Stripe subscription to a different plan (tier ± billing
 * interval) from the admin panel. Used for support flows like:
 *   "I'd like to downgrade from Pro to Basic"
 *   "I'd like to switch from monthly to annual"
 *
 * Body: { targetUserId: string, tier: 'basic'|'pro', plan: 'monthly'|'annual',
 *         prorate?: boolean }
 *
 * The Stripe subscription is updated with the new price ID. Stripe will fire
 * `customer.subscription.updated` which the existing webhook syncs into our
 * DB (status, plan, tier, ends_at). Prorations default to true so the customer
 * gets a refund/credit for unused Pro time when downgrading.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const body = await req.json()
    const targetUserId: string | undefined = body?.targetUserId
    const tier: TargetTier | undefined = body?.tier
    const plan: TargetPlan | undefined = body?.plan
    const prorate: boolean = body?.prorate !== false

    if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
    if (tier !== 'basic' && tier !== 'pro') {
      return NextResponse.json({ error: "tier must be 'basic' or 'pro'" }, { status: 400 })
    }
    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json({ error: "plan must be 'monthly' or 'annual'" }, { status: 400 })
    }

    const newPriceId = priceIdFor(tier, plan)
    if (!newPriceId) {
      return NextResponse.json(
        { error: `No price ID configured for ${tier}/${plan}. Check Stripe price env vars.` },
        { status: 500 }
      )
    }

    const supabase = getSupabase()
    const stripe = getStripe()

    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('id, stripe_subscription_id, stripe_customer_id, email, subscription_status, subscription_tier, subscription_plan')
      .eq('id', targetUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'User has no active Stripe subscription. Use Grant Pro / Grant Trial instead.' },
        { status: 400 }
      )
    }

    // Pull the live subscription so we have the existing item ID to swap.
    let subscription: Stripe.Subscription
    try {
      subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id)
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : null
      if (code === 'resource_missing') {
        return NextResponse.json(
          { error: 'Stripe subscription no longer exists. Clear stripe_subscription_id and have customer re-subscribe.' },
          { status: 409 }
        )
      }
      throw err
    }

    const currentItem = subscription.items?.data?.[0]
    if (!currentItem) {
      return NextResponse.json(
        { error: 'Subscription has no items — cannot determine what to swap.' },
        { status: 500 }
      )
    }

    const currentPriceId = currentItem.price?.id
    if (currentPriceId === newPriceId) {
      return NextResponse.json({
        success: true,
        noop: true,
        message: `User is already on ${tier}/${plan}. No change made.`,
      })
    }

    // Swap the price. `proration_behavior: 'create_prorations'` issues a
    // credit/charge for the partial period — standard SaaS downgrade UX.
    // Use 'none' if support has already promised a clean cutover.
    const updated = await stripe.subscriptions.update(user.stripe_subscription_id, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: prorate ? 'create_prorations' : 'none',
    })

    // The webhook will sync DB on `customer.subscription.updated`. We also
    // optimistically write tier+plan here so the admin sees the change
    // immediately without waiting for the webhook round-trip.
    await supabase
      .from('dyia_users')
      .update({
        subscription_tier: tier,
        subscription_plan: plan,
      })
      .eq('id', targetUserId)

    return NextResponse.json({
      success: true,
      message: `Switched to ${tier}/${plan}.${prorate ? ' Proration applied.' : ' No proration.'}`,
      stripe: {
        subscriptionId: updated.id,
        status: updated.status,
        priceId: newPriceId,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin switch-plan error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
