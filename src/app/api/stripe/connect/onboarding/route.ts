import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getConnectCountry, getPaymentsAppUrl, getStripe, getSupabaseAdmin, syncConnectAccountState } from '@/lib/stripe'
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

      // Persist the full Connect state (account id + capability flags), not
      // just the id, so the Payments tab reflects reality immediately and a
      // failed write surfaces instead of silently leaving us unlinked.
      await syncConnectAccountState(supabase, user.id, account)
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
      { error: getErrorMessage(error, 'Could not start Stripe setup') },
      { status: 500 }
    )
  }
}
