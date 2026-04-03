'use client'

import { useState, useEffect, useCallback } from 'react'
import { INTEL_INDUSTRIES, INTEL_RADIUS_OPTIONS } from '@/types/database'
import type { IntelScanData, IntelActionStep, IntelActionCategory } from '@/types/database'

interface IntelProps {
  userId: string
  businessName: string
  showSuccess: (msg: string) => void
}

type FilterTab = 'all' | IntelActionCategory

interface Changes {
  localRank: number
  reviewCount: number
  reviewGap: number
  missingKeywords: number
}

interface CrmIntelData {
  currentScan: {
    id: string
    businessName: string
    zipCode: string
    industry: string
    radiusMiles: number
    scanData: IntelScanData
    actionPlan: IntelActionStep[]
    createdAt: string
  } | null
  changes: Changes | null
  daysUntilRefresh: number
  hasNewReport: boolean
  monthlyStatus: {
    jobStatus: string
    monthYear: string
  } | null
}

export function Intel({ userId, businessName, showSuccess }: IntelProps) {
  const [data, setData] = useState<CrmIntelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [showSetup, setShowSetup] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Setup form state (for first-time setup)
  const [setupIndustry, setSetupIndustry] = useState('')
  const [setupZipCode, setSetupZipCode] = useState('')
  const [setupRadius, setSetupRadius] = useState(25)
  const [setupWebsite, setSetupWebsite] = useState('')

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/intel/crm')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to load Intel data')
      }
      const intelData = await res.json() as CrmIntelData
      setData(intelData)

      if (!intelData.currentScan) {
        setShowSetup(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Intel data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    try {
      const body = showSetup
        ? {
            industry: setupIndustry,
            zipCode: setupZipCode,
            radiusMiles: setupRadius,
            websiteUrl: setupWebsite || undefined,
          }
        : {}

      const res = await fetch('/api/intel/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Refresh failed')
      }

      showSuccess('Intel report refreshed!')
      setShowSetup(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-secondary)]">Loading Intel...</p>
        </div>
      </div>
    )
  }

  // First-time setup
  if (showSetup && !data?.currentScan) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Set Up Intel</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">
            Tell us about your market so we can generate your first competitive intelligence report.
          </p>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Business name</label>
            <input
              type="text"
              disabled
              value={businessName}
              className="w-full px-4 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] opacity-70"
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">From your Settings</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Industry *</label>
            <select
              required
              value={setupIndustry}
              onChange={e => setSetupIndustry(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
            >
              <option value="">Select your industry</option>
              {INTEL_INDUSTRIES.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Zip code *</label>
              <input
                type="text"
                required
                maxLength={5}
                value={setupZipCode}
                onChange={e => setSetupZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="w-full px-4 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
                placeholder="77001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Radius</label>
              <select
                value={setupRadius}
                onChange={e => setSetupRadius(Number(e.target.value))}
                className="w-full px-4 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
              >
                {INTEL_RADIUS_OPTIONS.map(r => (
                  <option key={r} value={r}>{r} miles</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Website <span className="text-[var(--color-text-secondary)]">(optional)</span></label>
            <input
              type="url"
              value={setupWebsite}
              onChange={e => setSetupWebsite(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]"
              placeholder="https://www.yourbusiness.com"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing || !setupIndustry || !setupZipCode || setupZipCode.length !== 5}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {refreshing ? 'Generating your report...' : 'Generate Intel Report'}
          </button>
        </div>
      </div>
    )
  }

  const scan = data?.currentScan
  const scanData = scan?.scanData
  const actionPlan = scan?.actionPlan

  if (!scan || !scanData) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--color-text-secondary)]">No Intel data available yet.</p>
        <button
          onClick={() => setShowSetup(true)}
          className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
        >
          Set up Intel
        </button>
      </div>
    )
  }

  const changes = data?.changes
  const filteredSteps = actionPlan?.filter(
    s => activeFilter === 'all' || s.category === activeFilter
  )

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'ads', label: 'Ads' },
  ]

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
    quick_win: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
    ongoing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400',
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{scan.businessName}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {scan.zipCode} · {scan.radiusMiles}mi radius · Updated monthly · Next update in {data?.daysUntilRefresh ?? '—'} days
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {refreshing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh now
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Local Rank"
          value={`#${scanData.local_rank}`}
          sub={`of ${scanData.total_competitors}`}
          change={changes?.localRank}
          changeLabel="positions"
          positiveIsGood={true}
        />
        <MetricCard
          label="Your Reviews"
          value={String(scanData.review_count_mine)}
          sub={`Leader: ${scanData.review_count_leader}`}
          change={changes?.reviewCount}
          changeLabel="reviews"
          positiveIsGood={true}
        />
        <MetricCard
          label="Reviews Behind"
          value={String(scanData.review_gap)}
          sub="vs #1 competitor"
          change={changes?.reviewGap}
          changeLabel=""
          positiveIsGood={true}
        />
        <MetricCard
          label="Missing Keywords"
          value={String(scanData.missing_keywords_count)}
          sub="competitors rank for"
          change={changes?.missingKeywords}
          changeLabel=""
          positiveIsGood={true}
        />
      </div>

      {/* Monthly Action Plan Banner */}
      {actionPlan && actionPlan.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20 rounded-xl p-5 mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-[var(--color-text)]">
              Your {new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'long' })} action plan is ready
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">6 prioritized steps built from your latest scan data</p>
          </div>
          <a
            href="#action-plan"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            View plan
          </a>
        </div>
      )}

      {/* Competitor Ranking Table */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Top Competitors</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-2 font-medium">Rank</th>
                <th className="text-left py-3 px-2 font-medium">Business</th>
                <th className="text-right py-3 px-2 font-medium">Reviews</th>
                <th className="text-right py-3 px-2 font-medium hidden sm:table-cell">Est. Ad Spend</th>
              </tr>
            </thead>
            <tbody>
              {scanData.top_competitors.map((comp, i) => {
                const isMe = comp.name.toLowerCase() === scan.businessName.toLowerCase()
                return (
                  <tr
                    key={i}
                    className={`border-b border-[var(--color-border)] ${isMe ? 'bg-purple-500/5' : ''}`}
                  >
                    <td className="py-3 px-2 font-medium text-[var(--color-text-secondary)]">#{comp.rank}</td>
                    <td className="py-3 px-2 text-[var(--color-text)]">
                      {comp.name}
                      {isMe && <span className="ml-2 text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">You</span>}
                    </td>
                    <td className="py-3 px-2 text-right text-[var(--color-text-secondary)]">{comp.reviews}</td>
                    <td className="py-3 px-2 text-right text-[var(--color-text-secondary)] hidden sm:table-cell">${comp.estimated_ad_spend}/mo</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gap Score Bars */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">Gap Scores</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">How close you are to matching the market leader</p>
        <div className="space-y-4">
          <GapBar label="Reviews" pct={scanData.gap_scores.reviews_pct} color="bg-blue-500" />
          <GapBar label="Keywords" pct={scanData.gap_scores.keywords_pct} color="bg-emerald-500" />
          <GapBar label="Ad Presence" pct={scanData.gap_scores.ads_pct} color="bg-amber-500" />
          <GapBar label="GBP Profile" pct={scanData.gap_scores.gbp_pct} color="bg-purple-500" />
        </div>
      </div>

      {/* Competitor Ad Spend */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Competitor Ad Spend</h3>
        <p className="text-2xl font-bold text-amber-500">${scanData.competitor_ad_spend_avg}<span className="text-base font-normal text-[var(--color-text-secondary)]">/mo avg</span></p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Average monthly ad spend across top 3 competitors</p>
        <div className="mt-4 space-y-2">
          {scanData.top_competitors.slice(0, 3).map((comp, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-[var(--color-text)]">{comp.name}</span>
              <span className="text-[var(--color-text-secondary)] font-medium">${comp.estimated_ad_spend}/mo</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Plan */}
      {actionPlan && actionPlan.length > 0 && (
        <div id="action-plan" className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Action Plan</h3>
            <div className="flex gap-1.5">
              {filterTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === tab.id
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredSteps?.map(step => (
              <div
                key={step.step_number}
                className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                    {step.step_number}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${priorityColors[step.priority] || ''}`}>
                        {step.priority.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-[var(--color-text-secondary)] uppercase">{step.category}</span>
                    </div>
                    <h4 className="font-medium text-[var(--color-text)] mb-1">{step.title}</h4>
                    <p className="text-sm text-[var(--color-text-secondary)]">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pro upsell strip */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-6 text-center">
        <h3 className="font-semibold text-[var(--color-text)] mb-1">Want these steps done for you?</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Our Pro service handles execution — reviews, keywords, ads, and GBP optimization.
        </p>
        <button className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all text-sm">
          Learn about Pro
        </button>
      </div>
    </div>
  )
}

// --- Subcomponents ---

function MetricCard({
  label, value, sub, change, changeLabel, positiveIsGood,
}: {
  label: string
  value: string
  sub: string
  change?: number | null
  changeLabel?: string
  positiveIsGood: boolean
}) {
  const hasChange = change !== undefined && change !== null && change !== 0
  const isPositive = (change ?? 0) > 0
  const isGood = positiveIsGood ? isPositive : !isPositive

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5 text-center">
      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{value}</p>
      <p className="text-sm font-medium text-[var(--color-text)] mt-1">{label}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sub}</p>
      {hasChange && (
        <p className={`text-xs mt-2 font-medium ${isGood ? 'text-emerald-500' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{change} {changeLabel} vs last month
        </p>
      )}
    </div>
  )
}

function GapBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-[var(--color-text)]">{label}</span>
        <span className="text-[var(--color-text-secondary)] font-medium">{pct}%</span>
      </div>
      <div className="h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
