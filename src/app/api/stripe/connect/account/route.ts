import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConnectCountry, getStripe, getSupabaseAdmin, syncConnectAccountState } from '@/lib/stripe'
import { getErrorMessage } from '@/lib/errors'

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
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (error || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let accountId = user.stripe_connect_account_id as string | null
    let account

    if (accountId) {
      account = await stripe.accounts.retrieve(accountId)
    } else {
      account = await stripe.accounts.create({
        type: 'express',
        country: getConnectCountry(),
        email: user.email || undefined,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          dyia_user_id: user.id,
          clerk_user_id: user.clerk_user_id,
        },
      })
      accountId = account.id
    }

    const state = await syncConnectAccountState(supabase, user.id, account)

    return NextResponse.json({
      accountId,
      ...state,
    })
  } catch (error) {
    console.error('Connect account error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Could not set up your Stripe account') },
      { status: 500 }
    )
  }
}
