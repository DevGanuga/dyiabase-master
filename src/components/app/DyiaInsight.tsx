'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface DyiaInsightProps {
  context: 'jobs' | 'quotes' | 'followUps' | 'reports' | 'customers'
  className?: string
  isPro?: boolean
}

export function DyiaInsight({ context, className = '', isPro = true }: DyiaInsightProps) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const fetchedRef = useRef(false)

  const fetchInsight = useCallback(async (force = false) => {
    setLoading(true)
    setError(false)
    try {
      const apiType = context === 'reports' ? 'reports' : 'dashboard'
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: apiType, forceRefresh: force }),
      })
      if (!response.ok) throw new Error(`${response.status}`)
      const data = await response.json()
      const result = data.insight
      const text = result?.tip || result?.recommendation || result?.summary || null
      if (text) {
        setInsight(text)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [context])

  useEffect(() => {
    if (fetchedRef.current || !isPro) return
    fetchedRef.current = true
    fetchInsight()
  }, [isPro, fetchInsight])

  if (dismissed) return null

  if (!isPro) {
    return (
      <Link
        href="/app?view=settings"
        className={`flex items-center gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl hover:border-orange-300 dark:hover:border-orange-700 transition-all group ${className}`}
      >
        <div className="w-6 h-6 bg-gradient-to-br from-orange-500/20 to-amber-500/20 rounded-md flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-orange-500 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="flex-1 text-sm text-slate-400 dark:text-slate-500 group-hover:text-[var(--color-text-secondary)] transition-colors">
          Unlock AI insights with <span className="font-semibold text-orange-500">Dyia Pro</span>
        </p>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-500 shrink-0">PRO</span>
      </Link>
    )
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 bg-gradient-to-r from-orange-50/80 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10 border border-orange-200/50 dark:border-orange-800/30 rounded-xl transition-all ${className}`}>
      <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-amber-500 rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center gap-2 py-0.5">
          <p className="text-sm text-[var(--color-text-muted)]">Generating insight...</p>
          <div className="w-3 h-3 border-[1.5px] border-orange-500 border-t-transparent rounded-full animate-spin shrink-0" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-between gap-2 py-0.5">
          <p className="text-sm text-[var(--color-text-muted)]">Couldn&apos;t load insight right now.</p>
          <button
            onClick={() => { fetchedRef.current = false; fetchInsight(true) }}
            className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline shrink-0"
          >
            Retry
          </button>
        </div>
      ) : (
        <p className="flex-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">{insight}</p>
      )}

      {!loading && !error && (
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          <button
            onClick={() => fetchInsight(true)}
            className="p-0.5 text-[var(--color-text-faint)] hover:text-orange-500 rounded transition-colors"
            aria-label="Refresh insight"
            title="Refresh"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-0.5 text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] rounded transition-colors"
            aria-label="Dismiss insight"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
