import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'

export async function POST() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripe()
    const supabase = getSupabaseAdmin()

    const { data: user, error } = await supabase
      .from('dyia_users')
      .select('id, stripe_connect_account_id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.stripe_connect_account_id) {
      return NextResponse.json({ error: 'Connect account not set up yet' }, { status: 400 })
    }

    const loginLink = await stripe.accounts.createLoginLink(user.stripe_connect_account_id)

    return NextResponse.json({ url: loginLink.url })
  } catch (error) {
    console.error('Connect dashboard error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
