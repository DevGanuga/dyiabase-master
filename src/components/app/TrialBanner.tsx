'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

export function TrialBanner() {
  const { tier, daysRemaining, isLoading } = useSubscription()
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
  const trialExpired = tier === 'basic' && daysRemaining === 0

  const handleDismiss = () => {
    setHiding(true)
    setTimeout(() => {
      setDismissed(true)
      sessionStorage.setItem('dyia_trial_banner_dismissed', 'true')
    }, 400)
  }

  // Active trial = positive green, urgent = amber warning, expired/basic = orange CTA
  const bgClass = urgent
    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
    : tier === 'trial'
      ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
      : trialExpired
        ? 'bg-red-500'
        : 'bg-gradient-to-r from-orange-500 to-amber-500'

  return (
    <div
      className={`w-full ${bgClass} text-white overflow-hidden transition-all duration-400 ease-in-out ${
        hiding ? 'max-h-0 opacity-0' : visible ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
      }`}
      style={visible && !hiding ? { animation: 'bannerSlideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' } : undefined}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          {tier === 'trial' && urgent ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Free trial ends soon — billing starts in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
            </>
          ) : tier === 'trial' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Pro plan active — free trial, {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} until billing starts
            </>
          ) : trialExpired ? (
            <>Your trial has ended — subscribe to restore Pro features</>
          ) : (
            <>Try Pro free for 14 days — AI assistant, marketing tools, email blasts</>
          )}
        </span>
        <div className="flex items-center gap-3">
          {/* Trial users already have card on file — just link to manage billing */}
          {tier === 'trial' ? (
            <Link 
              href="/app?view=settings" 
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-semibold transition-colors"
            >
              Manage Plan
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <Link 
              href="/app?view=settings" 
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-semibold transition-colors"
            >
              {trialExpired ? 'Subscribe Now' : 'Start Free Trial'}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
          <button
            onClick={handleDismiss}
            className="hover:opacity-70 transition-opacity p-0.5"
            aria-label="Dismiss banner"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
