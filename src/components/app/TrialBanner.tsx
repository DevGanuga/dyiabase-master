'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

export function TrialBanner() {
  const {
    tier,
    productTier,
    status,
    daysRemaining,
    isCanceled,
    isInDunning,
    dunningGraceDaysLeft,
    trialExpired,
    hasStripeHistory,
    isLoading,
  } = useSubscription()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = sessionStorage.getItem('dyia_trial_banner_dismissed')
    return stored === 'true'
  })
  const [hiding, setHiding] = useState(false)
  const [visible, setVisible] = useState(false)

  // Round 4 (BUG-022): a user with any Stripe history must NEVER see the
  // "Try Pro free" offer again. computeSubscriptionState already calculates
  // `hasStripeHistory` — paid plans, consumed trials, or any non-inactive
  // status all flip it true. Trial countdown still renders during a live
  // trial because `tier === 'trial'` short-circuits.
  const isPaidPlan =
    productTier !== null && (status === 'active' || status === 'past_due')

  // Dunning banner takes priority over the trial-offer banner — show it
  // for any past_due subscription (Basic or Pro) until they recover or the
  // grace window expires.
  const showDunning = isInDunning && !dismissed

  const shouldShow =
    showDunning ||
    (!isLoading &&
      (tier === 'trial' || tier === 'basic') &&
      !dismissed &&
      !isPaidPlan &&
      // Trial is currently running → keep showing trial countdown banner.
      // Otherwise, any prior Stripe engagement → suppress the upsell.
      !(hasStripeHistory && tier !== 'trial'))

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [shouldShow])

  if (isLoading || dismissed) return null
  if (!shouldShow) return null

  const urgent = tier === 'trial' && daysRemaining <= 2
  const canceledWithTime = isCanceled && daysRemaining > 0

  const handleDismiss = () => {
    setHiding(true)
    setTimeout(() => {
      setDismissed(true)
      sessionStorage.setItem('dyia_trial_banner_dismissed', 'true')
    }, 400)
  }

  const bgClass =
    showDunning
      ? 'bg-gradient-to-r from-red-500 to-orange-500'
      : trialExpired
        ? 'bg-red-500'
        : canceledWithTime
          ? 'bg-gradient-to-r from-amber-500 to-orange-500'
          : urgent
            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
            : tier === 'trial'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
              : 'bg-gradient-to-r from-orange-500 to-amber-500'

  let message: string
  let ctaLabel: string

  if (showDunning) {
    message = `Payment failed — your access continues for ${dunningGraceDaysLeft} more day${dunningGraceDaysLeft !== 1 ? 's' : ''}. Update your card to avoid an interruption.`
    ctaLabel = 'Update Payment'
  } else if (trialExpired) {
    message = 'Your free trial has ended — upgrade to keep using Pro features'
    ctaLabel = 'Upgrade Now'
  } else if (canceledWithTime) {
    message = `Plan canceled — you still have ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} of Pro access remaining`
    ctaLabel = 'Resubscribe'
  } else if (urgent) {
    message = `Free trial ends soon — ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left`
    ctaLabel = 'Manage Plan'
  } else if (tier === 'trial') {
    message = `Pro active — ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left in your free trial`
    ctaLabel = 'Manage Plan'
  } else {
    message = 'Try Pro free for 14 days — AI assistant, marketing tools, email blasts'
    ctaLabel = 'Start Free Trial'
  }

  return (
    <div
      // BUG-018: allow the banner to grow on mobile when the CTA wraps to a
      // second line so it is never clipped by its own max-height. Kept a
      // bounded desktop max-height for tidy layout.
      // BUG-007/017: explicit z-10 keeps the banner below the header dropdown.
      className={`w-full relative z-10 ${bgClass} text-white overflow-hidden transition-all duration-400 ease-in-out ${
        hiding ? 'max-h-0 opacity-0' : visible ? 'max-h-60 sm:max-h-20 opacity-100' : 'max-h-0 opacity-0'
      }`}
      style={visible && !hiding ? { animation: 'bannerSlideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' } : undefined}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-2 text-sm font-medium text-center sm:text-left">
        <span className="flex items-center gap-1.5 min-w-0 break-words">{message}</span>
        <div className="flex items-center gap-3">
          <Link
            href="/app?view=settings&tab=account#subscription"
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-semibold transition-colors"
          >
            {ctaLabel}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          {!trialExpired && !showDunning && (
            <button
              onClick={handleDismiss}
              className="hover:opacity-70 transition-opacity p-0.5"
              aria-label="Dismiss banner"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
