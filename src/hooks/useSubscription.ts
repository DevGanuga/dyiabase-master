'use client'

import { useEffect, useState } from 'react'
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
  isLoading: boolean
}

const TRIAL_STATUSES: SubscriptionStatus[] = ['trialing']
const PRO_STATUSES: SubscriptionStatus[] = ['active', 'trialing']

export function useSubscription(): SubscriptionState {
  const { user, isLoaded } = useUser()
  const supabase = createClient()
  const [state, setState] = useState<SubscriptionState>({
    tier: 'basic',
    status: null,
    plan: null,
    daysRemaining: 0,
    isPro: false,
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
          .select('subscription_status, subscription_plan, subscription_ends_at')
          .eq('clerk_user_id', user.id)
          .single()

        if (error) throw error

        const status = (data?.subscription_status || 'inactive') as SubscriptionStatus
        const plan = (data?.subscription_plan || null) as SubscriptionPlan
        const endsAt = data?.subscription_ends_at ? new Date(data.subscription_ends_at) : null
        const now = Date.now()
        const daysRemaining = endsAt
          ? Math.max(0, Math.ceil((endsAt.getTime() - now) / 86400000))
          : 0

        const tier: SubscriptionTier = TRIAL_STATUSES.includes(status)
          ? 'trial'
          : PRO_STATUSES.includes(status)
            ? 'pro'
            : 'basic'

        setState({
          tier,
          status,
          plan,
          daysRemaining,
          isPro: PRO_STATUSES.includes(status),
          isLoading: false,
        })
      } catch (error) {
        console.error('Error loading subscription:', error)
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    }

    loadSubscription()
  }, [isLoaded, user, supabase])

  return state
}
