'use client'

import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

interface ProFeatureProps {
  children: React.ReactNode
  title?: string
  description?: string
  ctaLabel?: string
  /** Navigate to in-app upgrade page instead of landing page */
  inApp?: boolean
}

export function ProFeature({
  children,
  title = 'Pro Feature',
  description = 'Unlock this feature with a Pro subscription. Get full access to AI assistant, advanced reports, marketing tools, and more.',
  ctaLabel = 'Upgrade to Pro',
  inApp = true,
}: ProFeatureProps) {
  const { isPro, tier, daysRemaining, isLoading } = useSubscription()

  if (isLoading) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--color-bg-card)]/60 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
            <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    )
  }

  if (isPro) {
    return <>{children}</>
  }

  const upgradeUrl = inApp ? '/app?view=settings' : '/#pricing'

  return (
    <div className="relative group">
      <div className="blur-sm opacity-60 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--color-bg-card)]/85 backdrop-blur-[2px]">
        <div className="text-center max-w-sm px-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/10 mb-3">
            <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{title}</h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4 leading-relaxed">{description}</p>
          {tier === 'trial' && daysRemaining > 0 ? (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
              Your trial has {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left — this feature requires an active subscription.
            </p>
          ) : null}
          <Link href={upgradeUrl} className="app-btn-primary text-sm inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
