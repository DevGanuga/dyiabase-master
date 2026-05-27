'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuthedFetch, type AuthedFetchResult } from '@/hooks/useAuthedFetch'

const INSIGHT_REQUEST_TIMEOUT_MS = 12000

interface DyiaInsightProps {
  context: 'jobs' | 'quotes' | 'followUps' | 'reports' | 'customers'
  className?: string
  isPro?: boolean
}

interface InsightApiResponse {
  insight?: {
    tip?: string
    recommendation?: string
    summary?: string
  }
}

export function DyiaInsight({ context, className = '', isPro = false }: DyiaInsightProps) {
  const { ready, authedFetch } = useAuthedFetch({ defaultTimeoutMs: INSIGHT_REQUEST_TIMEOUT_MS })
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [softError, setSoftError] = useState(false)
  const [unauthenticated, setUnauthenticated] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  /**
   * Apply API result to state. Always called after an await, so it never
   * triggers `react-hooks/set-state-in-effect`.
   */
  const applyResult = useCallback(
    (result: AuthedFetchResult<InsightApiResponse>) => {
      setLoading(false)
      setRefreshing(false)

      if (result.ok) {
        const r = result.data.insight
        const text = r?.tip || r?.recommendation || r?.summary || null
        if (text) {
          setInsight(text)
          setSoftError(false)
        } else {
          console.warn('[DyiaInsight] response missing usable text', { context })
          setSoftError(true)
        }
        return
      }

      if (result.kind === 'unauthenticated') {
        // Session race / mobile cookie blip. Hide rather than show a scary
        // "Unauthorized" banner on a screen the user is actively using.
        console.warn('[DyiaInsight] auth not available after refresh, hiding card', { context })
        setUnauthenticated(true)
        return
      }

      console.warn('[DyiaInsight] request failed', {
        context,
        status: result.status,
        message: result.message,
      })
      setSoftError(true)
    },
    [context]
  )

  /** Manual refresh — user click, NOT an effect, so sync setState is fine. */
  const handleRefresh = useCallback(async () => {
    if (!isPro || !ready) return
    setRefreshing(true)
    setSoftError(false)
    setUnauthenticated(false)
    const apiType = context === 'reports' ? 'reports' : 'dashboard'
    const result = await authedFetch<InsightApiResponse>('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: apiType, forceRefresh: true }),
    })
    applyResult(result)
  }, [applyResult, authedFetch, context, isPro, ready])

  // Initial fetch. Defers all state changes until AFTER the await so we don't
  // synchronously setState inside the effect body.
  const lastFetchTokenRef = useRef(0)
  useEffect(() => {
    if (!isPro || !ready) return
    const token = ++lastFetchTokenRef.current
    const apiType = context === 'reports' ? 'reports' : 'dashboard'
    void (async () => {
      const result = await authedFetch<InsightApiResponse>('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: apiType, forceRefresh: false }),
      })
      if (lastFetchTokenRef.current !== token) return
      applyResult(result)
    })()
  }, [isPro, ready, context, authedFetch, applyResult])

  if (dismissed || unauthenticated) return null

  if (!isPro) {
    return (
      <Link
        href="/app?view=settings&tab=account#subscription"
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

  if (loading) {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 ${className}`}
      >
        Loading insight…
      </div>
    )
  }

  if (softError) {
    return (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 dark:text-slate-400 ${className}`}
      >
        <span>AI insight is taking a moment.</span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-orange-600 dark:text-orange-400 font-medium hover:underline disabled:opacity-50"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!insight) return null

  return (
    <div className={`flex items-start gap-3 px-4 py-3 bg-gradient-to-r from-orange-50/80 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10 border border-orange-200/50 dark:border-orange-800/30 rounded-xl transition-all ${className}`}>
      <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-amber-500 rounded-md flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      <p className="flex-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">{insight}</p>

      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`p-0.5 text-[var(--color-text-faint)] hover:text-orange-500 rounded transition-colors disabled:opacity-50 ${refreshing ? 'animate-spin' : ''}`}
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
    </div>
  )
}
