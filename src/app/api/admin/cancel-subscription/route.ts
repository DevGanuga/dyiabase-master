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

/**
 * POST /api/admin/cancel-subscription
 * Cancel a user's Stripe subscription from the admin panel.
 * Optionally set immediate=true to cancel immediately (no grace period).
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const { targetUserId, immediate = false } = await req.json()
    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
    }

    const supabase = getSupabase()
    const stripe = getStripe()

    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('id, stripe_subscription_id, stripe_customer_id, email, subscription_status')
      .eq('id', targetUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.stripe_subscription_id) {
      // No Stripe subscription — just update DB status
      await supabase
        .from('dyia_users')
        .update({ subscription_status: 'canceled' })
        .eq('id', targetUserId)

      return NextResponse.json({ success: true, message: 'No Stripe subscription to cancel. Status updated.' })
    }

    // Cancel in Stripe
    let scheduledEndsAt: string | null = null
    if (immediate) {
      await stripe.subscriptions.cancel(user.stripe_subscription_id)
    } else {
      const updated = await stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
      const periodEnd = (updated as unknown as { current_period_end?: number }).current_period_end
      scheduledEndsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null
    }

    // Update DB optimistically so the admin UI reflects the change before the
    // Stripe webhook lands. For a scheduled downgrade we mirror Stripe's
    // cancel_at_period_end flag + period end (matching the user self-service
    // cancel route) so the user detail page can show "Downgrading on <date>".
    await supabase
      .from('dyia_users')
      .update({
        subscription_status: immediate ? 'canceled' : user.subscription_status,
        cancel_at_period_end: immediate ? false : true,
        ...(immediate ? {} : scheduledEndsAt ? { subscription_ends_at: scheduledEndsAt } : {}),
      })
      .eq('id', targetUserId)

    return NextResponse.json({
      success: true,
      message: immediate
        ? 'Subscription canceled immediately.'
        : 'Subscription set to cancel at end of billing period.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin cancel-subscription error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
