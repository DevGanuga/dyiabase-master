import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getBaseUrl } from '@/lib/env'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set')
  return new Stripe(process.env.STRIPE_SECRET_KEY)
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

/** POST: create Stripe Customer Portal session; returns { url }. */
export async function POST() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const { data: user } = await supabase
      .from('dyia_users')
      .select('stripe_customer_id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    const customerId = (user as { stripe_customer_id: string | null } | null)?.stripe_customer_id
    if (!customerId) {
      return NextResponse.json(
        { error: 'No billing account linked. Subscribe from the pricing page first.' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrl()
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/app`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe portal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to open billing portal' },
      { status: 500 }
    )
  }
}
