import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { handleFunctionCall } from '@/lib/openai/handlers'
import { userHasProAccess } from '@/lib/subscription'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/ai/suggest-quote-price
 * Body: { job_description: string, factors?: string[] }
 * Returns: { suggestedLow, suggestedHigh, message?, pricingMethod? } for Pro users.
 * Used by Quote Builder to offer AI-suggested pricing inline.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile } = await supabase
      .from('dyia_users')
      .select('id, subscription_status, subscription_tier, subscription_plan, subscription_ends_at, trial_consumed_at, payment_failed_at, ai_credits_balance, is_admin, role, stripe_customer_id, stripe_subscription_id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!userHasProAccess(userProfile)) {
      return NextResponse.json(
        { error: 'AI pricing suggestions are available for Pro subscribers.', needsPro: true },
        { status: 403 }
      )
    }

    const body = await req.json()
    const jobDescription = typeof body.job_description === 'string' ? body.job_description.trim() : ''
    if (!jobDescription) {
      return NextResponse.json({ error: 'job_description is required' }, { status: 400 })
    }

    const result = await handleFunctionCall(
      'suggest_quote_price',
      { job_description: jobDescription, factors: body.factors || [] },
      clerkUserId
    )

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error ?? 'Failed to get suggestion' },
        { status: 500 }
      )
    }

    const { suggestedLow, suggestedHigh, pricingMethod } = result.data
    return NextResponse.json({
      suggestedLow: Number(suggestedLow),
      suggestedHigh: Number(suggestedHigh),
      message: result.message,
      pricingMethod: pricingMethod ?? 'template',
    })
  } catch (err) {
    console.error('Suggest quote price API error:', err)
    return NextResponse.json({ error: 'Failed to get pricing suggestion' }, { status: 500 })
  }
}
