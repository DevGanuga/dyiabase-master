'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

export function TrialBanner() {
  const { tier, daysRemaining, isCanceled, trialExpired, isLoading } = useSubscription()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    const stored = sessionStorage.getItem('dyia_trial_banner_dismissed')
    return stored === 'true'
  })
  const [hiding, setHiding] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isLoading && (tier === 'trial' || tier === 'basic') && !dismissed) {
      const timer = setTimeout(() => setVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, tier, dismissed])

  if (isLoading || dismissed) return null
  if (tier !== 'trial' && tier !== 'basic') return null

  const urgent = tier === 'trial' && daysRemaining <= 2
  const canceledWithTime = isCanceled && daysRemaining > 0

  const handleDismiss = () => {
    setHiding(true)
    setTimeout(() => {
      setDismissed(true)
      sessionStorage.setItem('dyia_trial_banner_dismissed', 'true')
    }, 400)
  }

  const bgClass = trialExpired
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

  if (trialExpired) {
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
      className={`w-full ${bgClass} text-white overflow-hidden transition-all duration-400 ease-in-out ${
        hiding ? 'max-h-0 opacity-0' : visible ? 'max-h-28 sm:max-h-20 opacity-100' : 'max-h-0 opacity-0'
      }`}
      style={visible && !hiding ? { animation: 'bannerSlideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' } : undefined}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-sm font-medium">
        <span className="flex items-center gap-1.5">{message}</span>
        <div className="flex items-center gap-3">
          <Link 
            href="/app?view=settings" 
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-semibold transition-colors"
          >
            {ctaLabel}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          {!trialExpired && (
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
