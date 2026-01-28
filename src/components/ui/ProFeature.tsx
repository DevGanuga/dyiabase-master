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
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
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
      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
        <div className="text-center max-w-xs">
          <div className="text-lg font-semibold text-slate-900 mb-1">{title}</div>
          <div className="text-sm text-slate-600 mb-4">{description}</div>
          <Link href="/#pricing" className="app-btn-primary text-sm">
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
