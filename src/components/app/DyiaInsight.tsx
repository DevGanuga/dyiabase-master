'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface DyiaInsightProps {
  context: 'jobs' | 'quotes' | 'followUps' | 'reports' | 'customers'
  contextData?: Record<string, unknown>
  className?: string
  isPro?: boolean
}

export function DyiaInsight({ context, className = '', isPro = true }: DyiaInsightProps) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current || !isPro) return
    fetchedRef.current = true

    const fetchInsight = async () => {
      try {
        const response = await fetch(`/api/ai/insights?type=${context}&compact=true`)
        if (response.ok) {
          const data = await response.json()
          if (data.insight) setInsight(data.insight)
        }
      } catch (err) {
        console.error('Failed to fetch insight:', err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchInsight, 500)
    return () => clearTimeout(timer)
  }, [context, isPro])

  if (dismissed) return null

  // Non-pro: show teaser
  if (!isPro) {
    return (
      <Link
        href="/app?view=settings"
        className={`flex items-center gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all group ${className}`}
      >
        <img src="/dyia-agent.png" alt="" className="w-5 h-5 object-contain shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
        <p className="flex-1 text-sm text-slate-400 dark:text-slate-500 group-hover:text-[var(--color-text-secondary)] transition-colors">
          Unlock AI insights with <span className="font-semibold text-orange-500">Dyia Pro</span>
        </p>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-500 shrink-0">PRO</span>
      </Link>
    )
  }

  if (!loading && !insight) return null

  return (
    <div className={`flex items-start gap-3 px-4 py-3 bg-gradient-to-r from-orange-50/80 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10 border border-orange-200/50 dark:border-orange-800/30 rounded-xl ${className}`}>
      <img src="/dyia-agent.png" alt="" className="w-5 h-5 object-contain mt-0.5 shrink-0" />
      
      {loading ? (
        <div className="flex-1 flex items-center gap-2">
          <div className="h-3.5 w-3/4 bg-orange-200/50 dark:bg-orange-800/30 rounded animate-pulse" />
        </div>
      ) : (
        <p className="flex-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">{insight}</p>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] rounded transition-colors shrink-0"
        aria-label="Dismiss insight"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
