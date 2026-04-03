/**
 * POST /api/intel/checkout
 * Creates a Stripe checkout session for the $27 Intel Action Plan.
 * No auth required (public page purchase).
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getBaseUrl } from '@/lib/env'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export async function POST(request: NextRequest) {
  try {
    const { scanId, email } = await request.json()

    if (!scanId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: scanId, email' },
        { status: 400 }
      )
    }

    const priceId = process.env.STRIPE_INTEL_PRICE_ID
    if (!priceId) {
      return NextResponse.json(
        { error: 'Intel pricing not configured' },
        { status: 503 }
      )
    }

    const stripe = getStripe()
    const baseUrl = getBaseUrl()

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${baseUrl}/intel/report?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/intel?scan_id=${scanId}&cancelled=true`,
      metadata: {
        purchase_type: 'intel_action_plan',
        scan_id: scanId,
        email,
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('Intel checkout error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
