'use client'

import { useState, useEffect, useCallback } from 'react'
import { INTEL_INDUSTRIES, INTEL_RADIUS_OPTIONS } from '@/types/database'
import type { IntelScanData, IntelActionStep, IntelActionCategory, IntelResearchSource } from '@/types/database'

interface IntelProps { businessName: string; showSuccess: (msg: string) => void }
type FilterTab = 'all' | IntelActionCategory
interface Changes { localRank: number; reviewCount: number; reviewGap: number; missingKeywords: number }

interface CrmIntelData {
  currentScan: {
    id: string; businessName: string; zipCode: string; industry: string; radiusMiles: number
    scanData: IntelScanData; researchSources: IntelResearchSource[] | null; actionPlan: IntelActionStep[]; createdAt: string
  } | null
  changes: Changes | null; daysUntilRefresh: number; hasNewReport: boolean
  monthlyStatus: { jobStatus: string; monthYear: string } | null
}

function sevColor(p: number) { return p >= 70 ? 'text-emerald-500' : p >= 40 ? 'text-amber-500' : 'text-red-500' }
function sevBg(p: number) { return p >= 70 ? 'bg-emerald-500' : p >= 40 ? 'bg-amber-500' : 'bg-red-500' }
function sevLabel(p: number) { return p >= 70 ? 'Strong' : p >= 40 ? 'Room to grow' : 'Critical gap' }

const IC = 'w-full px-4 py-2.5 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)]'

export function Intel({ businessName, showSuccess }: IntelProps) {
  const [data, setData] = useState<CrmIntelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [showSetup, setShowSetup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupIndustry, setSetupIndustry] = useState('')
  const [setupZipCode, setSetupZipCode] = useState('')
  const [setupRadius, setSetupRadius] = useState(25)
  const [setupWebsite, setSetupWebsite] = useState('')

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/intel/crm')
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to load Intel data') }
      const d = await res.json() as CrmIntelData
      setData(d)
      if (!d.currentScan) setShowSetup(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleRefresh() {
    setRefreshing(true); setError(null)
    try {
      const body = showSetup ? { industry: setupIndustry, zipCode: setupZipCode, radiusMiles: setupRadius, websiteUrl: setupWebsite || undefined } : {}
      const res = await fetch('/api/intel/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Refresh failed') }
      showSuccess('Intel report refreshed!'); setShowSetup(false); await loadData()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to refresh') }
    finally { setRefreshing(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-32"><div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>

  if (showSetup && !data?.currentScan) return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center mx-auto mb-4"><svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Set Up Intel</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Tell us about your market to generate your first competitive intelligence report.</p>
      </div>
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 space-y-4">
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Business name</label><input type="text" disabled value={businessName} className={`${IC} opacity-70`} /><p className="text-xs text-[var(--color-text-secondary)] mt-1">From your Settings</p></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Zip code *</label><input type="text" required maxLength={5} value={setupZipCode} onChange={e => setSetupZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))} className={IC} placeholder="77001" /></div>
          <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Industry *</label><select required value={setupIndustry} onChange={e => setSetupIndustry(e.target.value)} className={IC}><option value="">Select</option>{INTEL_INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Radius</label><select value={setupRadius} onChange={e => setSetupRadius(Number(e.target.value))} className={IC}>{INTEL_RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} mi</option>)}</select></div>
        </div>
        <div><label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Website <span className="text-[var(--color-text-secondary)]">(optional)</span></label><input type="url" value={setupWebsite} onChange={e => setSetupWebsite(e.target.value)} className={IC} placeholder="https://www.yourbusiness.com" /></div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={handleRefresh} disabled={refreshing || !setupIndustry || !setupZipCode || setupZipCode.length !== 5} className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">{refreshing ? 'Generating report...' : 'Generate Intel Report'}</button>
      </div>
    </div>
  )

  const scan = data?.currentScan; const scanData = scan?.scanData; const actionPlan = scan?.actionPlan
  if (!scan || !scanData) return <div className="text-center py-20"><p className="text-[var(--color-text-secondary)]">No Intel data yet.</p><button onClick={() => setShowSetup(true)} className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg">Set up Intel</button></div>

  const changes = data?.changes
  const filteredSteps = actionPlan?.filter(s => activeFilter === 'all' || s.category === activeFilter)
  const sources = scan.researchSources
  const competitors = (() => {
    const has = scanData.top_competitors.some(c => c.name.toLowerCase() === scan.businessName.toLowerCase())
    if (has) return scanData.top_competitors
    return [...scanData.top_competitors.slice(0, 4), { name: scan.businessName, reviews: scanData.review_count_mine, estimated_ad_spend: 0, rank: scanData.local_rank }].sort((a, b) => a.rank - b.rank)
  })()
  const maxRev = Math.max(...competitors.map(c => c.reviews), 1)
  const overall = Math.round((scanData.gap_scores.reviews_pct + scanData.gap_scores.keywords_pct + scanData.gap_scores.ads_pct + scanData.gap_scores.gbp_pct) / 4)

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{scan.businessName}</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">{scan.zipCode} · {scan.radiusMiles}mi · Updated monthly · Next update in {data?.daysUntilRefresh ?? '—'} days</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Last scanned: {new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
          {refreshing ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Refreshing...</> : <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh now</>}
        </button>
      </div>

      {error && <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">{error}</div>}

      {/* Competitive Score */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl">
        <div className={`text-3xl font-black ${sevColor(overall)}`}>{overall}</div>
        <div><p className="text-sm font-semibold text-[var(--color-text)]">Competitive Score</p><p className={`text-xs ${sevColor(overall)}`}>{sevLabel(overall)} — #{scanData.local_rank} of {scanData.total_competitors}</p></div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Local Rank', value: `#${scanData.local_rank}`, sub: `of ${scanData.total_competitors}`, change: changes?.localRank, changeLabel: 'positions', pct: 50 },
          { label: 'Your Reviews', value: String(scanData.review_count_mine), sub: `Leader: ${scanData.review_count_leader}`, change: changes?.reviewCount, changeLabel: 'reviews', pct: scanData.gap_scores.reviews_pct },
          { label: 'Reviews Behind', value: String(scanData.review_gap), sub: 'vs #1 competitor', change: changes?.reviewGap, changeLabel: '', pct: scanData.gap_scores.reviews_pct },
          { label: 'Missing Keywords', value: String(scanData.missing_keywords_count), sub: 'competitors rank for', change: changes?.missingKeywords, changeLabel: '', pct: scanData.gap_scores.keywords_pct },
        ].map((c, i) => (
          <div key={i} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-4">
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${sevBg(c.pct)}/20 ${sevColor(c.pct)}`}>{sevLabel(c.pct)}</span>
            <p className="text-2xl font-bold text-[var(--color-text)] mt-1">{c.value}</p>
            <p className="text-sm text-[var(--color-text)] mt-0.5">{c.label}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{c.sub}</p>
            {c.change !== undefined && c.change !== null && c.change !== 0 && <p className={`text-xs mt-1 font-medium ${c.change > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{c.change > 0 ? '+' : ''}{c.change} {c.changeLabel} vs last month</p>}
          </div>
        ))}
      </div>

      {/* Action Plan Banner */}
      {actionPlan && actionPlan.length > 0 && (
        <div className="bg-gradient-to-r from-purple-600/10 to-indigo-600/10 border border-purple-500/20 rounded-xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div><h3 className="font-semibold text-[var(--color-text)]">Your {new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'long' })} action plan is ready</h3><p className="text-sm text-[var(--color-text-secondary)]">6 prioritized steps from your latest scan</p></div>
          <a href="#action-plan" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors">View plan</a>
        </div>
      )}

      {/* Competitor Rankings */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Competitor Rankings</h3>
        <div className="space-y-2">
          {competitors.map((comp, i) => {
            const isMe = comp.name.toLowerCase() === scan.businessName.toLowerCase()
            const bw = Math.max(5, (comp.reviews / maxRev) * 100)
            return (
              <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${isMe ? 'bg-purple-500/5 border-purple-500/20' : 'border-[var(--color-border)]'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${comp.rank === 1 ? 'bg-amber-500/10 text-amber-500' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'}`}>{comp.rank}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className={`text-sm font-medium truncate ${isMe ? 'text-purple-600 dark:text-purple-400' : 'text-[var(--color-text)]'}`}>{comp.name}</span>{isMe && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">You</span>}</div>
                  <div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden"><div className={`h-full rounded-full ${isMe ? 'bg-purple-500' : 'bg-slate-400 dark:bg-slate-600'}`} style={{ width: `${bw}%` }} /></div><span className="text-xs text-[var(--color-text-secondary)] shrink-0 w-16 text-right">{comp.reviews} reviews</span></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Gap Analysis */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">Gap Analysis</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-5">How close you are to the market leader</p>
        <div className="space-y-5">
          {[
            { label: 'Reviews', pct: scanData.gap_scores.reviews_pct, insight: `${scanData.review_count_mine} reviews vs ${scanData.review_count_leader} (leader)` },
            { label: 'Keywords', pct: scanData.gap_scores.keywords_pct, insight: `${scanData.missing_keywords_count} missing keywords` },
            { label: 'Ad Presence', pct: scanData.gap_scores.ads_pct, insight: `Competitors avg $${scanData.competitor_ad_spend_avg}/mo` },
            { label: 'Google Profile', pct: scanData.gap_scores.gbp_pct, insight: scanData.gbp_gaps[0] || 'GBP completeness vs leader' },
          ].map((g, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-2"><span className="text-sm font-medium text-[var(--color-text)]">{g.label}</span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevBg(g.pct)}/20 ${sevColor(g.pct)}`}>{g.pct}%</span></div><span className={`text-xs ${sevColor(g.pct)}`}>{sevLabel(g.pct)}</span></div>
              <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden mb-1"><div className={`h-full rounded-full ${sevBg(g.pct)} transition-all duration-1000`} style={{ width: `${g.pct}%` }} /></div>
              <p className="text-xs text-[var(--color-text-secondary)]">{g.insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Missing Keywords */}
      {scanData.missing_keywords.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">Missing Keywords</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Terms your competitors rank for</p>
          <div className="flex flex-wrap gap-2">{scanData.missing_keywords.map((kw, i) => <span key={i} className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-medium text-amber-600 dark:text-amber-400">{kw}</span>)}</div>
        </div>
      )}

      {/* GBP Gaps */}
      {scanData.gbp_gaps.length > 0 && (
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">Google Business Profile Gaps</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">Issues to fix vs the top competitor</p>
          <div className="space-y-2">{scanData.gbp_gaps.map((gap, i) => <div key={i} className="flex items-center gap-3 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg"><svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span className="text-sm text-[var(--color-text)]">{gap}</span></div>)}</div>
        </div>
      )}

      {/* Ad Spend */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">Competitor Ad Spend</h3>
        <p className="text-2xl font-bold text-amber-500">${scanData.competitor_ad_spend_avg}<span className="text-base font-normal text-[var(--color-text-secondary)]">/mo avg</span></p>
        <div className="mt-3 space-y-2">{scanData.top_competitors.slice(0, 3).map((c, i) => <div key={i} className="flex items-center justify-between text-sm"><span className="text-[var(--color-text)]">{c.name}</span><span className="text-[var(--color-text-secondary)] font-medium">${c.estimated_ad_spend}/mo</span></div>)}</div>
      </div>

      {/* Action Plan */}
      {actionPlan && actionPlan.length > 0 && (
        <div id="action-plan" className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Action Plan</h3>
            <div className="flex gap-1.5">{(['all','reviews','keywords','ads'] as const).map(tab => <button key={tab} onClick={() => setActiveFilter(tab)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeFilter === tab ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-card)]'}`}>{tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}</div>
          </div>
          <div className="space-y-3">{filteredSteps?.map(step => (
            <div key={step.step_number} className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-sm font-bold text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">{step.step_number}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${step.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' : step.priority === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : step.priority === 'quick_win' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400'}`}>{step.priority.replace('_', ' ')}</span>
                    <span className="text-xs text-[var(--color-text-secondary)] uppercase">{step.category}</span>
                  </div>
                  <h4 className="font-medium text-[var(--color-text)] mb-1">{step.title}</h4>
                  <p className="text-sm text-[var(--color-text-secondary)]">{step.description}</p>
                </div>
              </div>
            </div>
          ))}</div>
        </div>
      )}

      {/* Sources */}
      {sources && sources.length > 0 && (
        <details className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 mb-6 group">
          <summary className="text-sm font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text)] flex items-center gap-2"><svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>{sources.length} research sources</summary>
          <div className="space-y-2 mt-4">{sources.slice(0, 10).map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg hover:border-purple-500/20 transition-colors"><p className="text-xs font-medium text-[var(--color-text)] truncate">{s.title}</p><p className="text-[11px] text-[var(--color-text-secondary)] truncate">{s.url}</p></a>)}</div>
        </details>
      )}

      {/* Pro upsell */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-6 text-center">
        <h3 className="font-semibold text-[var(--color-text)] mb-1">Want these steps done for you?</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">Our Pro service handles execution — reviews, keywords, ads, and GBP optimization.</p>
        <button className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all text-sm">Learn about Pro</button>
      </div>
    </div>
  )
}
