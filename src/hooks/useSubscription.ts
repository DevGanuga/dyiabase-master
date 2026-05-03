'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { createClient } from '@/lib/supabase/client'
import {
  computeSubscriptionState,
  type SubscriptionState,
} from '@/lib/subscription'

const INITIAL_STATE: SubscriptionState = {
  tier: 'basic',
  planTier: 'basic',
  productTier: null,
  status: null,
  plan: null,
  daysRemaining: 0,
  isPro: false,
  isAdmin: false,
  isCanceled: false,
  isInDunning: false,
  dunningGraceDaysLeft: 0,
  dunningExpired: false,
  trialExpired: false,
  trialConsumed: false,
  aiCredits: 0,
  canUseAI: false,
  hasStripeHistory: false,
}

interface SubscriptionStateWithLoading extends SubscriptionState {
  isLoading: boolean
}

/**
 * Single source of truth for subscription state on the client.
 * Round 4 (BUG-022): refactored to delegate all logic to
 * `computeSubscriptionState` so this hook, `app/page.tsx`, and `Settings.tsx`
 * cannot drift apart.
 */
export function useSubscription(): SubscriptionStateWithLoading {
  const { user, isLoaded } = useUser()
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<SubscriptionStateWithLoading>({
    ...INITIAL_STATE,
    isLoading: true,
  })

  useEffect(() => {
    const loadSubscription = async () => {
      if (!isLoaded) return
      if (!user) {
        setState({ ...INITIAL_STATE, isLoading: false })
        return
      }

      try {
        const { data, error } = await supabase
          .from('dyia_users')
          .select(
            'subscription_status, subscription_plan, subscription_tier, subscription_ends_at, trial_consumed_at, payment_failed_at, ai_credits_balance, is_admin, role, stripe_customer_id, stripe_subscription_id'
          )
          .eq('clerk_user_id', user.id)
          .maybeSingle()

        if (error) throw error

        const computed = computeSubscriptionState(data ?? null)
        setState({ ...computed, isLoading: false })
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
