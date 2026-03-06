import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { rateLimiters } from '@/lib/rate-limit'
import { getBaseUrl } from '@/lib/env'

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
    const { priceId, clerkUserId, userEmail, couponCode, useFoundersCoupon, mode = 'subscription', creditsAmount = 100 } = await request.json()

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
      process.env.STRIPE_CREDITS_PRICE_ID,
    ].filter(Boolean)
    if (allowedPriceIds.length > 0 && !allowedPriceIds.includes(priceId)) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 })
    }

    // Get the dyia user ID from clerk_user_id
    const { data: dyiaUser, error: userError } = await supabase
      .from('dyia_users')
      .select('id, is_admin, role')
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
      // Ensure admin has active status in DB
      await supabase
        .from('dyia_users')
        .update({ subscription_status: 'active', subscription_plan: 'annual' })
        .eq('id', dyiaUser.id)
      return NextResponse.json({ error: 'Admin accounts have free access. Your account has been activated.' }, { status: 400 })
    }

    const baseUrl = getBaseUrl()
    const isOneTime = mode === 'payment'

    // Build session params based on mode
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: isOneTime ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: isOneTime
        ? `${baseUrl}/app/assistant?purchase=credits&session_id={CHECKOUT_SESSION_ID}`
        : `${baseUrl}/app?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isOneTime ? `${baseUrl}/app/assistant` : `${baseUrl}/#pricing`,
      customer_email: userEmail,
      client_reference_id: clerkUserId,
      metadata: {
        clerk_user_id: clerkUserId,
        dyia_user_id: dyiaUser.id,
        purchase_type: isOneTime ? 'credits' : 'subscription',
        credits_amount: isOneTime ? String(creditsAmount) : '',
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
        sessionParams.discounts = [{ coupon: couponCode }]
      } else {
        // No pre-applied coupon — let customers enter a promotion code at checkout
        sessionParams.allow_promotion_codes = true
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
