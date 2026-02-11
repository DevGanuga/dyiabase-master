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
  try {
    const stripe = getStripe()
    const supabase = getSupabase()
    const { priceId, clerkUserId, userEmail, couponCode, useFoundersCoupon, mode = 'subscription', creditsAmount = 100 } = await request.json()

    if (!priceId || !clerkUserId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: priceId, clerkUserId, userEmail' },
        { status: 400 }
      )
    }

    // Get the dyia user ID from clerk_user_id
    const { data: dyiaUser, error: userError } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !dyiaUser) {
      return NextResponse.json(
        { error: 'User not found. Please try signing out and back in.' },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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
      // Let customers enter a promotion code at checkout (e.g. Gumroad, founders)
      sessionParams.allow_promotion_codes = true
    }

    // Apply coupon (only for subscriptions): explicit code from client or founders coupon from env
    const foundersCouponId = process.env.STRIPE_FOUNDERS_COUPON_ID
    if (!isOneTime) {
      if (useFoundersCoupon && foundersCouponId) {
        sessionParams.discounts = [{ coupon: foundersCouponId }]
      } else if (couponCode) {
        sessionParams.discounts = [{ coupon: couponCode }]
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
