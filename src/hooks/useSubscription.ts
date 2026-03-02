'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'

type SubscriptionTier = 'basic' | 'pro' | 'trial'
type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing'
type SubscriptionPlan = 'monthly' | 'annual' | null

interface SubscriptionState {
  tier: SubscriptionTier
  status: SubscriptionStatus | null
  plan: SubscriptionPlan
  daysRemaining: number
  isPro: boolean
  isCanceled: boolean
  trialExpired: boolean
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
    status: null,
    plan: null,
    daysRemaining: 0,
    isPro: false,
    isCanceled: false,
    trialExpired: false,
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
          .select('subscription_status, subscription_plan, subscription_ends_at, ai_credits_balance')
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

        const tier: SubscriptionTier =
          (isCanceled && hasTimeLeft) ? 'trial'
          : TRIAL_STATUSES.includes(effectiveStatus) ? 'trial'
          : PRO_STATUSES.includes(effectiveStatus) ? 'pro'
          : 'basic'

        const aiCredits = data?.ai_credits_balance || 0
        const canUseAI = hasAccess || aiCredits > 0

        setState({
          tier,
          status: effectiveStatus,
          plan,
          daysRemaining,
          isPro: hasAccess,
          isCanceled,
          trialExpired,
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
