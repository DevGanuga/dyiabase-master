import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getStripe, getSupabaseAdmin, syncConnectAccountState } from '@/lib/stripe'
import { getErrorMessage } from '@/lib/errors'

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripe()
    const supabase = getSupabaseAdmin()

    const { data: user, error } = await supabase
      .from('dyia_users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.stripe_connect_account_id) {
      return NextResponse.json({
        connected: false,
        onboardingComplete: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        accountId: null,
      })
    }

    const account = await stripe.accounts.retrieve(user.stripe_connect_account_id)
    const state = await syncConnectAccountState(supabase, user.id, account)

    return NextResponse.json({
      connected: true,
      accountId: account.id,
      ...state,
    })
  } catch (error) {
    console.error('Connect status error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Could not load Stripe status') },
      { status: 500 }
    )
  }
}
