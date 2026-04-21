'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'

type SubscriptionTier = 'basic' | 'pro' | 'trial'
/** Distinct product tier (what the user pays for) — independent of trial/active status. */
type PlanTier = 'basic' | 'pro'
type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing'
type SubscriptionPlan = 'monthly' | 'annual' | null

interface SubscriptionState {
  /** UI tier: 'basic' | 'trial' | 'pro' — combines product tier with trial status. */
  tier: SubscriptionTier
  /** Product tier only: 'basic' | 'pro'. Reflects what the user purchased, not trial state. */
  planTier: PlanTier
  status: SubscriptionStatus | null
  plan: SubscriptionPlan
  daysRemaining: number
  /** True if user has Pro-feature access (active or trialing subscription). */
  isPro: boolean
  isCanceled: boolean
  trialExpired: boolean
  /** True if the user has already consumed a Pro free trial. Prevents re-offering the trial. */
  trialConsumed: boolean
  aiCredits: number
  canUseAI: boolean
  isLoading: boolean
}

const TRIAL_STATUSES: SubscriptionStatus[] = ['trialing']
const PRO_STATUSES: SubscriptionStatus[] = ['active', 'trialing']

export function useSubscription(): SubscriptionState {
  const { user, isLoaded } = useUser()
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<SubscriptionState>({
    tier: 'basic',
    planTier: 'basic',
    status: null,
    plan: null,
    daysRemaining: 0,
    isPro: false,
    isCanceled: false,
    trialExpired: false,
    trialConsumed: false,
    aiCredits: 0,
    canUseAI: false,
    isLoading: true,
  })

  useEffect(() => {
    const loadSubscription = async () => {
      if (!isLoaded) return
      if (!user) {
        setState((prev) => ({ ...prev, isLoading: false }))
        return
      }

      try {
        const { data, error } = await supabase
          .from('dyia_users')
          .select('subscription_status, subscription_plan, subscription_tier, subscription_ends_at, trial_consumed_at, ai_credits_balance')
          .eq('clerk_user_id', user.id)
          .maybeSingle()

        if (error) throw error

        const rawStatus = (data?.subscription_status || 'inactive') as SubscriptionStatus
        const plan = (data?.subscription_plan || null) as SubscriptionPlan
        const endsAt = data?.subscription_ends_at ? new Date(data.subscription_ends_at) : null
        const now = Date.now()
        const daysRemaining = endsAt
          ? Math.max(0, Math.ceil((endsAt.getTime() - now) / 86400000))
          : 0

        const hasTimeLeft = endsAt !== null && endsAt.getTime() > now
        const isCanceled = rawStatus === 'canceled'

        // Determine effective status:
        // 1. Canceled but still has time left = still has access (grace period)
        // 2. Trialing but past end date = expired
        // 3. Everything else = use raw status
        let effectiveStatus = rawStatus
        const hasStripeSubscription = !!data?.subscription_plan

        if (rawStatus === 'trialing' && endsAt && !hasTimeLeft && !hasStripeSubscription) {
          effectiveStatus = 'inactive'
        }
        if (isCanceled && !hasTimeLeft) {
          effectiveStatus = 'inactive'
        }

        // Canceled with time remaining still gets pro access
        const hasAccess = PRO_STATUSES.includes(effectiveStatus) || (isCanceled && hasTimeLeft)
        const trialExpired = !hasAccess && (rawStatus === 'inactive' || (isCanceled && !hasTimeLeft) || (rawStatus === 'trialing' && !hasTimeLeft))

        // Default missing DB tier to 'basic' (not 'pro') so a brand-new/stale row
        // doesn't falsely advertise Pro features to a Basic subscriber.
        const dbTier: PlanTier = (data?.subscription_tier as string) === 'pro' ? 'pro' : 'basic'
        const tier: SubscriptionTier =
          (isCanceled && hasTimeLeft) ? 'trial'
          : TRIAL_STATUSES.includes(effectiveStatus) ? 'trial'
          : PRO_STATUSES.includes(effectiveStatus) ? dbTier
          : 'basic'

        const aiCredits = data?.ai_credits_balance || 0
        const canUseAI = hasAccess || aiCredits > 0
        const trialConsumed = !!data?.trial_consumed_at

        setState({
          tier,
          planTier: dbTier,
          status: effectiveStatus,
          plan,
          daysRemaining,
          isPro: hasAccess,
          isCanceled,
          trialExpired,
          trialConsumed,
          aiCredits,
          canUseAI,
          isLoading: false,
        })
      } catch (error) {
        const err = error as { message?: string; code?: string }
        console.error('Error loading subscription:', err?.message ?? err?.code ?? error)
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    }

    loadSubscription()
  }, [isLoaded, user, supabase])

  return state
}
