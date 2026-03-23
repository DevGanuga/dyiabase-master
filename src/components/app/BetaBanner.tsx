'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export function BetaBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('dyia_beta_banner_dismissed') === 'true'
  })
  const [hiding, setHiding] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!dismissed) {
      const timer = setTimeout(() => setVisible(true), 250)
      return () => clearTimeout(timer)
    }
  }, [dismissed])

  if (dismissed) return null

  const handleDismiss = () => {
    setHiding(true)
    setTimeout(() => {
      setDismissed(true)
      sessionStorage.setItem('dyia_beta_banner_dismissed', 'true')
    }, 300)
  }

  return (
    <div
      className={`border-b border-orange-500/20 bg-gradient-to-r from-orange-500/8 via-amber-500/6 to-orange-500/8 overflow-hidden transition-all duration-300 ${
        hiding ? 'max-h-0 opacity-0' : visible ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              Beta
            </span>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Early access is live
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            You&apos;re one of our early testers. Some features, especially email sending integrations, are still being finalized.
            If anything looks off, let us know or request beta access for Gmail/Google testing.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <Link
            href="/support"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            Support
          </Link>
          <Link
            href="/app?view=massEmail"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 transition-colors"
          >
            Open Email Blast
          </Link>
          <button
            onClick={handleDismiss}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            aria-label="Dismiss beta banner"
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
