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

        let status = (data?.subscription_status || 'inactive') as SubscriptionStatus
        const plan = (data?.subscription_plan || null) as SubscriptionPlan
        const endsAt = data?.subscription_ends_at ? new Date(data.subscription_ends_at) : null
        const now = Date.now()
        const daysRemaining = endsAt
          ? Math.max(0, Math.ceil((endsAt.getTime() - now) / 86400000))
          : 0

        // If trial has expired (past the end date) and no Stripe subscription is active,
        // treat as inactive so they lose Pro access and see upgrade prompts.
        const hasStripeSubscription = !!data?.subscription_plan
        if (status === 'trialing' && endsAt && endsAt.getTime() < now && !hasStripeSubscription) {
          status = 'inactive'
        }

        const tier: SubscriptionTier = TRIAL_STATUSES.includes(status)
          ? 'trial'
          : PRO_STATUSES.includes(status)
            ? 'pro'
            : 'basic'

        const aiCredits = data?.ai_credits_balance || 0
        const isPro = PRO_STATUSES.includes(status)
        const canUseAI = isPro || aiCredits > 0

        setState({
          tier,
          status,
          plan,
          daysRemaining,
          isPro,
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
