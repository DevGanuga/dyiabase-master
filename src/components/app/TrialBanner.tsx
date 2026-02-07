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
  const expired = tier === 'basic'

  const handleDismiss = () => {
    setHiding(true)
    setTimeout(() => {
      setDismissed(true)
      sessionStorage.setItem('dyia_trial_banner_dismissed', 'true')
    }, 400)
  }

  return (
    <div
      className={`w-full ${urgent || expired ? 'bg-red-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'} text-white overflow-hidden transition-all duration-400 ease-in-out ${
        hiding ? 'max-h-0 opacity-0' : visible ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
      }`}
      style={visible && !hiding ? { animation: 'bannerSlideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' } : undefined}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-2 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          {expired ? (
            <>Your free trial has ended — pro features are locked</>
          ) : urgent ? (
            <>⏰ Trial ending soon — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left</>
          ) : (
            <>✨ Pro trial — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</>
          )}
        </span>
        <div className="flex items-center gap-3">
          <Link 
            href="/app?view=settings" 
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm font-semibold transition-colors"
          >
            {expired ? 'Subscribe Now' : 'Upgrade to Pro'}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
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
