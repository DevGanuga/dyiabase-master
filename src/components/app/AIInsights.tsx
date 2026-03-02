'use client'

import { useState, useEffect, useCallback } from 'react'
import type { InsightResult } from '@/app/api/ai/insights/route'

type InsightType = 'dashboard' | 'weekly' | 'monthly' | 'reports'

interface AIInsightsProps {
  type: InsightType
  className?: string
  compact?: boolean
  autoRefresh?: boolean
}

interface InsightState {
  insight: InsightResult | null
  loading: boolean
  refreshing: boolean
  error: string | null
  generatedAt: string | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function AIInsights({ type, className = '', compact = false, autoRefresh = false }: AIInsightsProps) {
  const [state, setState] = useState<InsightState>({
    insight: null,
    loading: true,
    refreshing: false,
    error: null,
    generatedAt: null,
  })

  const fetchInsight = useCallback(async (forceRefresh = false) => {
    const isRefresh = forceRefresh && state.insight !== null
    setState(prev => ({
      ...prev,
      ...(isRefresh ? { refreshing: true } : { loading: true }),
      error: null,
    }))

    try {
      const response = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, forceRefresh }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch insights')
      }

      const data = await response.json()
      setState({
        insight: data.insight,
        loading: false,
        refreshing: false,
        error: null,
        generatedAt: data.generatedAt,
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'Failed to load insights',
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  useEffect(() => {
    fetchInsight()
  }, [fetchInsight])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => fetchInsight(), 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchInsight])

  // Silently hide for non-Pro or unauthorized
  if (state.error && (state.error.includes('Pro subscription') || state.error.includes('Unauthorized'))) {
    return null
  }

  // Loading state
  if (state.loading) {
    return (
      <div className={`${className}`}>
        <div className={`bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/30 dark:via-amber-950/30 dark:to-yellow-950/30 border border-orange-200/50 dark:border-orange-800/30 rounded-xl ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
          <div className="flex items-center gap-3">
            <div className={`${compact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 sm:w-12 sm:h-12 rounded-xl'} bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20`}>
              <svg className={`${compact ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <p className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-900 dark:text-slate-100`}>
                  Dyia AI
                </p>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-orange-100/80 dark:bg-orange-900/40 rounded-full">
                  <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">Analyzing</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Reviewing your business data...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state with retry
  if (state.error) {
    return (
      <div className={`${className}`}>
        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Couldn&apos;t load AI insights</p>
          </div>
          <button
            onClick={() => fetchInsight(true)}
            className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline px-3 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!state.insight) return null

  const { insight } = state

  const RefreshButton = ({ size = 'sm' }: { size?: 'sm' | 'md' }) => (
    <button
      onClick={() => fetchInsight(true)}
      disabled={state.refreshing}
      className={`${size === 'md' ? 'p-2' : 'p-1.5'} text-slate-400 hover:text-orange-500 hover:bg-orange-100/50 dark:hover:bg-orange-900/20 rounded-lg transition-all disabled:opacity-50`}
      title="Refresh insight"
    >
      <svg className={`${size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} ${state.refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  )

  // Compact view for Dashboard
  if (compact) {
    return (
      <div className={`animate-fade-in ${className}`}>
        <div className={`bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/30 dark:via-amber-950/30 dark:to-yellow-950/30 border border-orange-200/50 dark:border-orange-800/30 rounded-xl p-4 sm:p-5 shadow-sm transition-all ${state.refreshing ? 'opacity-75' : ''}`}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-orange-500/20">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {insight.headline}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded font-medium flex-shrink-0">
                  AI
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {insight.summary}
              </p>
              
              {insight.metric && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{insight.metric.label}</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{insight.metric.value}</span>
                  {insight.metric.trend === 'up' && (
                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )}
                  {insight.metric.trend === 'down' && (
                    <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  )}
                </div>
              )}
              
              {insight.tip && (
                <p className="mt-3 text-xs text-orange-700 dark:text-orange-400 flex items-start gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {insight.tip}
                </p>
              )}
            </div>

            <RefreshButton />
          </div>
        </div>
      </div>
    )
  }

  // Full view for Reports
  return (
    <div className={`animate-fade-in ${className}`}>
      <div className={`bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/30 dark:via-amber-950/30 dark:to-yellow-950/30 border border-orange-200/50 dark:border-orange-800/30 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-sm transition-opacity ${state.refreshing ? 'opacity-75' : ''}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                  {insight.headline}
                </h3>
                <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full font-medium">
                  AI
                </span>
              </div>
              {state.generatedAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Updated {timeAgo(state.generatedAt)}
                </p>
              )}
            </div>
          </div>
          <RefreshButton size="md" />
        </div>

        {/* Summary */}
        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-5">
          {insight.summary}
        </p>

        {/* Key Metrics */}
        {insight.keyMetrics && insight.keyMetrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            {insight.keyMetrics.map((metric, idx) => (
              <div key={idx} className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200/50 dark:border-slate-700/50">
                <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{metric.value}</p>
                <p className={`text-xs ${metric.change.startsWith('+') ? 'text-green-600' : metric.change.startsWith('-') ? 'text-red-600' : 'text-slate-500'}`}>
                  {metric.change}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Insights list */}
        {insight.insights && insight.insights.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Key Insights
            </h4>
            <ul className="space-y-2">
              {insight.insights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="text-orange-500 mt-1">&bull;</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Highlights */}
        {insight.highlights && insight.highlights.length > 0 && (
          <div className="mb-5">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Highlights
            </h4>
            <ul className="space-y-2">
              {insight.highlights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <svg className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {insight.recommendations && insight.recommendations.length > 0 && (
          <div className="bg-gradient-to-r from-orange-100/50 to-amber-100/50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg p-4 border border-orange-200/50 dark:border-orange-800/30">
            <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-300 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recommendations
            </h4>
            <ul className="space-y-2">
              {insight.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-orange-800 dark:text-orange-400">
                  <span className="font-bold">{idx + 1}.</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Single recommendation */}
        {insight.recommendation && !insight.recommendations && (
          <div className="bg-gradient-to-r from-orange-100/50 to-amber-100/50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg p-4 border border-orange-200/50 dark:border-orange-800/30">
            <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-300 mb-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recommendation
            </h4>
            <p className="text-sm text-orange-800 dark:text-orange-400">{insight.recommendation}</p>
          </div>
        )}
      </div>
    </div>
  )
}
