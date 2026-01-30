'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

export function TrialBanner() {
  const { tier, daysRemaining, isLoading } = useSubscription()
  const [dismissed, setDismissed] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isLoading && tier === 'trial' && !dismissed) {
      const timer = setTimeout(() => setVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, tier, dismissed])

  if (isLoading || tier !== 'trial' || dismissed) {
    return null
  }

  const urgent = daysRemaining <= 2

  const handleDismiss = () => {
    setHiding(true)
    setTimeout(() => setDismissed(true), 400)
  }

  return (
    <div
      className={`w-full ${urgent ? 'bg-red-500' : 'bg-amber-500'} text-white overflow-hidden transition-all duration-400 ease-in-out ${
        hiding ? 'max-h-0 opacity-0' : visible ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0'
      }`}
      style={visible && !hiding ? { animation: 'bannerSlideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' } : undefined}
    >
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-medium">
        <span>
          {urgent ? '⏰ Trial ending soon' : '✨ Pro trial active'} — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
        </span>
        <div className="flex items-center gap-3">
          <Link href="/#pricing" className="underline hover:no-underline">
            Upgrade to Pro
          </Link>
          <button
            onClick={handleDismiss}
            className="ml-1 hover:opacity-70 transition-opacity"
            aria-label="Dismiss banner"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
