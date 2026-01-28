'use client'

import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

export function TrialBanner() {
  const { tier, daysRemaining, isLoading } = useSubscription()

  if (isLoading || tier !== 'trial') {
    return null
  }

  const urgent = daysRemaining <= 2

  return (
    <div className={`w-full ${urgent ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm font-medium">
        <span>
          {urgent ? '⏰ Trial ending soon' : '✨ Pro trial active'} — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
        </span>
        <Link href="/#pricing" className="underline hover:no-underline">
          Upgrade to Pro
        </Link>
      </div>
    </div>
  )
}
