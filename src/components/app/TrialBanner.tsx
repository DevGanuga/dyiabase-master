'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

export function TrialBanner() {
  const { tier, daysRemaining, isLoading } = useSubscription()
  const [dismissed, setDismissed] = useState(false)

  if (isLoading || tier !== 'trial' || dismissed) {
    return null
  }

  const urgent = daysRemaining <= 2

  return (
    <div className={`w-full ${urgent ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-medium">
        <span>
          {urgent ? '⏰ Trial ending soon' : '✨ Pro trial active'} — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
        </span>
        <div className="flex items-center gap-3">
          <Link href="/#pricing" className="underline hover:no-underline">
            Upgrade to Pro
          </Link>
          <button
            onClick={() => setDismissed(true)}
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
