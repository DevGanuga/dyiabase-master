'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { IntelScanData, IntelActionStep } from '@/types/database'
import { Suspense } from 'react'

function ReportContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const scanId = searchParams.get('scan_id')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [scanData, setScanData] = useState<IntelScanData | null>(null)
  const [actionPlan, setActionPlan] = useState<IntelActionStep[] | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'reviews' | 'keywords' | 'ads'>('all')

  useEffect(() => {
    async function load() {
      try {
        const param = sessionId ? `session_id=${sessionId}` : scanId ? `scan_id=${scanId}` : null
        if (!param) {
          setError('No report identifier provided.')
          setLoading(false)
          return
        }

        const res = await fetch(`/api/intel/report?${param}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to load report')
        }

        const data = await res.json()
        setBusinessName(data.scan.businessName)
        setScanData(data.scan.scanData)
        setActionPlan(data.scan.actionPlan)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [sessionId, scanId])

  const filteredSteps = actionPlan?.filter(
    s => activeFilter === 'all' || s.category === activeFilter
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your action plan...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <Link href="/intel" className="text-purple-400 hover:text-purple-300 underline">
            Generate a new report
          </Link>
        </div>
      </div>
    )
  }

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    quick_win: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    ongoing: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  }

  const filterTabs = [
    { id: 'all' as const, label: 'All' },
    { id: 'reviews' as const, label: 'Reviews' },
    { id: 'keywords' as const, label: 'Keywords' },
    { id: 'ads' as const, label: 'Ads' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/dyia-logo-full.png" alt="dyia" width={100} height={33} className="brightness-0 invert opacity-90" />
            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">Intel</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Payment successful
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Your 90-Day Action Plan
          </h1>
          <p className="text-slate-400">{businessName}</p>
        </div>

        {/* Quick Stats */}
        {scanData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">#{scanData.local_rank}</p>
              <p className="text-xs text-slate-400">Local Rank</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{scanData.review_gap}</p>
              <p className="text-xs text-slate-400">Reviews Behind</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{scanData.missing_keywords_count}</p>
              <p className="text-xs text-slate-400">Missing Keywords</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">${scanData.competitor_ad_spend_avg}</p>
              <p className="text-xs text-slate-400">Avg Ad Spend</p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === tab.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Steps */}
        <div className="space-y-4 mb-12">
          {filteredSteps?.map(step => (
            <div
              key={step.step_number}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-lg font-bold text-purple-300 shrink-0">
                  {step.step_number}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${priorityColors[step.priority] || ''}`}>
                      {step.priority.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-500 uppercase font-medium">{step.category}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-slate-400">{step.description}</p>
                </div>
              </div>
            </div>
          ))}

          {filteredSteps?.length === 0 && (
            <p className="text-center text-slate-500 py-8">No steps in this category.</p>
          )}
        </div>

        {/* Dyia CTA */}
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Want this updated automatically every month?</h2>
          <p className="text-slate-400 mb-6 max-w-lg mx-auto">
            Dyia CRM subscribers get a fresh Intel report and action plan every month — included in your subscription at no extra cost.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/20"
          >
            Start your free Dyia trial
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function IntelReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ReportContent />
    </Suspense>
  )
}
