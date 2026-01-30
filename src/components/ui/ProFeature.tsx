'use client'

import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'

interface ProFeatureProps {
  children: React.ReactNode
  title?: string
  description?: string
  ctaLabel?: string
}

export function ProFeature({
  children,
  title = 'Pro feature',
  description = 'Upgrade to Pro to unlock this feature.',
  ctaLabel = 'Upgrade to Pro',
}: ProFeatureProps) {
  const { isPro, isLoading } = useSubscription()

  if (isLoading) {
    return (
      <div className="relative">
        <div className="opacity-60">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--color-bg-card)]/70">
          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <div className="w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-text-muted)] rounded-full animate-spin" />
            Checking subscription...
          </div>
        </div>
      </div>
    )
  }

  if (isPro) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      <div className="blur-sm opacity-70 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--color-bg-card)]/80">
        <div className="text-center max-w-xs">
          <div className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">{title}</div>
          <div className="text-sm text-[var(--color-text-muted)] mb-4">{description}</div>
          <Link href="/#pricing" className="app-btn-primary text-sm">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
