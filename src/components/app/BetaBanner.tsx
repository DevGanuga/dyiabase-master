'use client'

import { useState, useEffect } from 'react'

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('dyia-beta-banner-dismissed')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard: must read sessionStorage after mount
    setDismissed(wasDismissed === 'true')
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('dyia-beta-banner-dismissed', 'true')
  }

  if (dismissed) return null

  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-b border-orange-500/20 px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-500 uppercase tracking-wide">
        Beta
      </span>
      <span className="text-[var(--color-text-secondary)]">
        dyia is in early access. Found a bug or have feedback?{' '}
        <a href="/support" className="text-orange-500 hover:text-orange-400 underline underline-offset-2">
          Let us know
        </a>
      </span>
      <button
        onClick={handleDismiss}
        className="ml-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
        aria-label="Dismiss beta banner"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
