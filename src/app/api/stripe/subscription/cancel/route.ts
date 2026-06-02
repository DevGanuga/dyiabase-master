import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimiters } from '@/lib/rate-limit'
import { getErrorMessage } from '@/lib/errors'

/**
 * User-facing subscription downgrade.
 *
 * POST   → schedule a downgrade: Stripe `cancel_at_period_end = true`. The user
 *          keeps Pro until the end of the period they already paid for, then
 *          drops to the free Basic plan (handled by computeSubscriptionState +
 *          the subscription.deleted webhook). No proration, no refund.
 * DELETE  → undo a scheduled downgrade: `cancel_at_period_end = false`.
 *
 * The Stripe webhook (customer.subscription.updated) is the source of truth and
 * will also sync `cancel_at_period_end`/`subscription_ends_at`; we write them
 * here too so the UI reflects the change instantly without waiting on the
 * webhook round-trip.
 */

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
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

type AccountRow = {
  id: string
  stripe_subscription_id: string | null
  subscription_status: string | null
  is_admin: boolean | null
  role: string | null
}

async function loadBillableUser(clerkUserId: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('dyia_users')
    .select('id, stripe_subscription_id, subscription_status, is_admin, role')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (error || !data) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
  }

  const account = data as AccountRow

  if (account.is_admin || ['admin', 'super_admin'].includes(account.role || '')) {
    return {
      error: NextResponse.json(
        { error: 'Admin accounts are not billed, so there is nothing to cancel.' },
        { status: 400 }
      ),
    }
  }

  if (!account.stripe_subscription_id) {
    return {
      error: NextResponse.json(
        { error: 'No active subscription found to change.' },
        { status: 400 }
      ),
    }
  }

  return { account, supabase }
}

/** POST: schedule downgrade to Basic at period end. */
export async function POST(req: NextRequest) {
  const rateLimited = await rateLimiters.general.checkAsync(req)
  if (rateLimited) return rateLimited

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await loadBillableUser(clerkUserId)
    if ('error' in result) return result.error
    const { account, supabase } = result

    const stripe = getStripe()
    const updated = await stripe.subscriptions.update(account.stripe_subscription_id!, {
      cancel_at_period_end: true,
    })

    const sub = updated as unknown as { current_period_end?: number; cancel_at_period_end?: boolean }
    const periodEndIso = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null

    const { error: dbError } = await supabase
      .from('dyia_users')
      .update({
        cancel_at_period_end: true,
        ...(periodEndIso ? { subscription_ends_at: periodEndIso } : {}),
      })
      .eq('id', account.id)

    if (dbError) throw dbError

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      endsAt: periodEndIso,
    })
  } catch (err) {
    console.error('Subscription cancel error:', err)
    return NextResponse.json(
      { error: getErrorMessage(err, 'Could not schedule your downgrade') },
      { status: 500 }
    )
  }
}

/** DELETE: undo a scheduled downgrade — keep Pro. */
export async function DELETE(req: NextRequest) {
  const rateLimited = await rateLimiters.general.checkAsync(req)
  if (rateLimited) return rateLimited

  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await loadBillableUser(clerkUserId)
    if ('error' in result) return result.error
    const { account, supabase } = result

    const stripe = getStripe()
    await stripe.subscriptions.update(account.stripe_subscription_id!, {
      cancel_at_period_end: false,
    })

    const { error: dbError } = await supabase
      .from('dyia_users')
      .update({ cancel_at_period_end: false })
      .eq('id', account.id)

    if (dbError) throw dbError

    return NextResponse.json({ success: true, cancelAtPeriodEnd: false })
  } catch (err) {
    console.error('Subscription resume error:', err)
    return NextResponse.json(
      { error: getErrorMessage(err, 'Could not resume your plan') },
      { status: 500 }
    )
  }
}
