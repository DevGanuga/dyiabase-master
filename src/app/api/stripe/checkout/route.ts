import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { rateLimiters } from '@/lib/rate-limit'
import { getBaseUrl } from '@/lib/env'
import { grantAdminAccess } from '@/lib/admin'
import { getErrorMessage } from '@/lib/errors'

const BILLABLE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
])

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  // Fail fast with a clear message if the secret key looks like a webhook
  // signing secret (whsec_…) — every Stripe API call would otherwise fail with
  // "Invalid API Key" and bubble up as a generic 500. Catches the env-swap
  // misconfiguration that previously hid as opaque "Upgrade to Pro" errors.
  if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY is misconfigured: value does not start with sk_ or rk_. ' +
      'Check that the API secret (sk_test_… / sk_live_…) is set, not the webhook signing secret (whsec_…).'
    )
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

async function resolveStripeDiscount(
  stripe: Stripe,
  couponCode: string
): Promise<{ promotion_code?: string; coupon?: string } | null> {
  const normalizedCode = couponCode.trim()
  if (!normalizedCode) return null

  const promotionCodes = await stripe.promotionCodes.list({
    code: normalizedCode,
    active: true,
    limit: 1,
  })

  const promotionCode = promotionCodes.data[0]
  if (promotionCode) {
    return { promotion_code: promotionCode.id }
  }

  try {
    const coupon = await stripe.coupons.retrieve(normalizedCode)
    if (!('deleted' in coupon) && coupon.valid) {
      return { coupon: coupon.id }
    }
  } catch {
    // Fall through to invalid-code response below.
  }

  return null
}

async function resolveExistingCustomer(
  stripe: Stripe,
  suppliedCustomerId: string | null | undefined,
  userEmail: string,
  clerkUserId: string,
  dyiaUserId: string
) {
  if (suppliedCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(suppliedCustomerId)
      if (!('deleted' in customer)) {
        return customer
      }
    } catch {
      // Fall through to email lookup/create below.
    }
  }

  const existingCustomers = await stripe.customers.list({
    email: userEmail,
    limit: 10,
  })

  const reusableCustomer = existingCustomers.data.find((customer) => !customer.deleted)
  if (reusableCustomer) {
    return reusableCustomer
  }

  return stripe.customers.create({
    email: userEmail,
    metadata: {
      clerk_user_id: clerkUserId,
      dyia_user_id: dyiaUserId,
    },
  })
}

async function findBillableSubscription(stripe: Stripe, customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
  })

  return subscriptions.data.find((subscription) =>
    BILLABLE_SUBSCRIPTION_STATUSES.has(subscription.status)
  ) ?? null
}

async function findOpenCheckoutSession(
  stripe: Stripe,
  customerId: string,
  mode: 'subscription' | 'payment'
) {
  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 20,
  })

  const thirtyMinutesAgo = Math.floor(Date.now() / 1000) - (30 * 60)

  return sessions.data.find((session) =>
    session.mode === mode &&
    session.status === 'open' &&
    typeof session.url === 'string' &&
    session.created >= thirtyMinutesAgo
  ) ?? null
}

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const rateLimited = await rateLimiters.checkout.checkAsync(request)
  if (rateLimited) return rateLimited

  try {
    const { userId: authedUserId } = await auth()
    if (!authedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripe()
    const supabase = getSupabase()
    const { priceId, clerkUserId, userEmail, couponCode, useFoundersCoupon, mode = 'subscription', creditsAmount = 100, tier } = await request.json()

    if (!priceId || !clerkUserId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: priceId, clerkUserId, userEmail' },
        { status: 400 }
      )
    }

    if (clerkUserId !== authedUserId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 })
    }

    const allowedPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
      process.env.STRIPE_CREDITS_PRICE_ID,
    ].filter(Boolean)
    if (allowedPriceIds.length > 0 && !allowedPriceIds.includes(priceId)) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    // Get the dyia user ID from clerk_user_id
    const { data: dyiaUser, error: userError } = await supabase
      .from('dyia_users')
      .select('id, is_admin, role, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !dyiaUser) {
      return NextResponse.json(
        { error: 'User not found. Please try signing out and back in.' },
        { status: 404 }
      )
    }

    // Admin accounts get free access — never create a Stripe subscription
    if (dyiaUser.is_admin || ['admin', 'super_admin'].includes(dyiaUser.role)) {
      await grantAdminAccess(dyiaUser.id, dyiaUser.role === 'super_admin' ? 'super_admin' : 'admin')
      return NextResponse.json({ error: 'Admin accounts have free access. Your account has been activated.' }, { status: 400 })
    }

    const baseUrl = getBaseUrl()
    const isOneTime = mode === 'payment'
    const checkoutMode: 'subscription' | 'payment' = isOneTime ? 'payment' : 'subscription'

    const customer = await resolveExistingCustomer(
      stripe,
      dyiaUser.stripe_customer_id,
      userEmail,
      clerkUserId,
      dyiaUser.id
    )

    if (dyiaUser.stripe_customer_id !== customer.id) {
      await supabase
        .from('dyia_users')
        .update({ stripe_customer_id: customer.id })
        .eq('id', dyiaUser.id)
    }

    if (!isOneTime) {
      if (['active', 'trialing', 'past_due'].includes(dyiaUser.subscription_status || '')) {
        return NextResponse.json(
          { error: 'You already have a subscription. Please manage your existing billing instead of starting a new checkout.' },
          { status: 409 }
        )
      }

      if (dyiaUser.stripe_subscription_id) {
        try {
          const existingSubscription = await stripe.subscriptions.retrieve(dyiaUser.stripe_subscription_id)
          if (BILLABLE_SUBSCRIPTION_STATUSES.has(existingSubscription.status)) {
            return NextResponse.json(
              { error: 'You already have a subscription. Please manage your existing billing instead of starting a new checkout.' },
              { status: 409 }
            )
          }
        } catch {
          // Ignore stale subscription IDs and continue with customer-level checks below.
        }
      }

      const billableSubscription = await findBillableSubscription(stripe, customer.id)
      if (billableSubscription) {
        return NextResponse.json(
          { error: 'You already have a subscription in Stripe. Please manage billing instead of creating another one.' },
          { status: 409 }
        )
      }

      const openSession = await findOpenCheckoutSession(stripe, customer.id, 'subscription')
      if (openSession?.url) {
        return NextResponse.json({ sessionId: openSession.id, url: openSession.url })
      }
    } else {
      const openSession = await findOpenCheckoutSession(stripe, customer.id, 'payment')
      if (openSession?.url) {
        return NextResponse.json({ sessionId: openSession.id, url: openSession.url })
      }
    }

    // Build session params based on mode
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: checkoutMode,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: isOneTime
        ? `${baseUrl}/app/assistant?purchase=credits&session_id={CHECKOUT_SESSION_ID}`
        : `${baseUrl}/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isOneTime ? `${baseUrl}/app/assistant` : `${baseUrl}/#pricing`,
      customer: customer.id,
      client_reference_id: clerkUserId,
      metadata: {
        clerk_user_id: clerkUserId,
        dyia_user_id: dyiaUser.id,
        purchase_type: isOneTime ? 'credits' : 'subscription',
        credits_amount: isOneTime ? String(creditsAmount) : '',
        subscription_tier: isOneTime ? '' : (tier || 'pro'),
      },
    }

    // Only add subscription_data for subscription mode
    if (!isOneTime) {
      sessionParams.subscription_data = {
        trial_period_days: 14, // 14-day free trial - card collected now, billed after trial
        metadata: {
          clerk_user_id: clerkUserId,
          dyia_user_id: dyiaUser.id,
        },
      }

      // Apply coupon: founders coupon (auto-applied) or explicit code from client.
      // Stripe doesn't allow both `discounts` and `allow_promotion_codes` on the same session,
      // so we use `discounts` when a coupon is being applied, otherwise allow manual promo codes.
      const foundersCouponId = process.env.STRIPE_FOUNDERS_COUPON_ID
      if (useFoundersCoupon && foundersCouponId) {
        sessionParams.discounts = [{ coupon: foundersCouponId }]
      } else if (couponCode) {
        const discount = await resolveStripeDiscount(stripe, couponCode)
        if (!discount) {
          return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 })
        }
        sessionParams.discounts = [discount]
      } else {
        // No pre-applied coupon — let customers enter a promotion code at checkout
        sessionParams.allow_promotion_codes = true
      }
    }

    const session = await stripe.checkout.sessions.create(
      sessionParams,
      {
        idempotencyKey: [
          'checkout',
          checkoutMode,
          dyiaUser.id,
          priceId,
          couponCode || (useFoundersCoupon ? 'founders' : 'none'),
          Math.floor(Date.now() / (5 * 60 * 1000)).toString(),
        ].join(':'),
      }
    )

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Could not start checkout') },
      { status: 500 }
    )
  }
}
