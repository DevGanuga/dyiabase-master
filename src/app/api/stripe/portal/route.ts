import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getBaseUrl } from '@/lib/env'
import { getErrorMessage } from '@/lib/errors'
import { storedIdsMatchCurrentMode, updateUserWithModeStamp } from '@/lib/stripe-mode'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not set')
  if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY is misconfigured: value does not start with sk_ or rk_. ' +
      'Check that the API secret is set, not the webhook signing secret (whsec_…).'
    )
  }
  return new Stripe(key)
}

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Resolve a customer id that exists in THIS Stripe mode (live vs test).
 *
 * QA Round 5: several accounts carry `stripe_customer_id`s that were created
 * by a test-mode key (branch/QA environments writing to the shared database).
 * Opening the portal with those ids throws "No such customer … a similar
 * object exists in test mode". Self-heal instead of erroring:
 *   1. Verify the stored id actually exists in the current mode.
 *   2. If not, look the customer up by email (live-mode customer may exist).
 *   3. If found, repoint dyia_users at it; if not, clear the stale pointer so
 *      the next checkout starts clean, and tell the user to subscribe.
 */
async function resolvePortalCustomerId(
  stripe: Stripe,
  supabase: ReturnType<typeof getSupabase>,
  dyiaUserId: string,
  storedCustomerId: string,
  email: string | null,
  /** False when stripe_livemode says the stored id came from the other mode — skip the doomed retrieve. */
  storedIdUsable: boolean = true
): Promise<string | null> {
  if (storedIdUsable) {
    try {
      const customer = await stripe.customers.retrieve(storedCustomerId)
      if (!('deleted' in customer)) return customer.id
    } catch {
      // Missing in this mode (test-mode id with a live key, or deleted) — heal below.
    }
  }

  if (email) {
    const matches = await stripe.customers.list({ email, limit: 10 })
    const reusable = matches.data.find((c) => !c.deleted)
    if (reusable) {
      await updateUserWithModeStamp(supabase, 'id', dyiaUserId, { stripe_customer_id: reusable.id })
      return reusable.id
    }
  }

  // No customer in this mode at all — clear the poisoned pointer so checkout
  // can recreate a fresh one, and clear the dead subscription pointer with it.
  await supabase
    .from('dyia_users')
    .update({ stripe_customer_id: null, stripe_subscription_id: null })
    .eq('id', dyiaUserId)
  return null
}

/** POST: create Stripe Customer Portal session; returns { url }. */
export async function POST() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    // select('*') so the optional stripe_livemode column (migration 044) is
    // included when present without erroring when it isn't yet.
    const { data: user } = await supabase
      .from('dyia_users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()

    const account = user as {
      id: string
      email: string | null
      stripe_customer_id: string | null
      stripe_livemode?: boolean | null
      is_admin?: boolean | null
      role?: string | null
    } | null
    if (account?.is_admin || ['admin', 'super_admin'].includes(account?.role || '')) {
      return NextResponse.json(
        { error: 'Admin accounts are not billed and do not use the billing portal.' },
        { status: 400 }
      )
    }

    if (!account?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account linked. Subscribe from the pricing page first.' },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    // QA Round 5 mode guard: when the stored id came from the other Stripe
    // mode, skip the doomed retrieve and go straight to email-based healing.
    const customerId = await resolvePortalCustomerId(
      stripe,
      supabase,
      account.id,
      account.stripe_customer_id,
      account.email,
      storedIdsMatchCurrentMode(account.stripe_livemode)
    )

    if (!customerId) {
      return NextResponse.json(
        { error: 'Your billing account was reset because it pointed to a missing Stripe record. Subscribe from Settings → Account to set up billing again.' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrl()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/app`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe portal error:', err)
    return NextResponse.json(
      { error: getErrorMessage(err, 'Failed to open billing portal') },
      { status: 500 }
    )
  }
}
