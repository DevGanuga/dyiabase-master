import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConnectCountry, getPaymentsAppUrl, getStripe, getSupabaseAdmin } from '@/lib/stripe'

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

    if (!accountId) {
      const account = await stripe.accounts.create({
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

      await supabase
        .from('dyia_users')
        .update({ stripe_connect_account_id: account.id })
        .eq('id', user.id)
    }

    const returnUrl = `${getPaymentsAppUrl()}&connect=return`
    const refreshUrl = `${getPaymentsAppUrl()}&connect=refresh`

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      return_url: returnUrl,
      refresh_url: refreshUrl,
    })

    return NextResponse.json({ url: link.url, accountId })
  } catch (error) {
    console.error('Connect onboarding error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
