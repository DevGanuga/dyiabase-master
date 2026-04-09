'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { IntelScanData, IntelActionStep, IntelResearchSource } from '@/types/database'
import { Suspense } from 'react'

function sevColor(pct: number) { return pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400' }
function sevLabel(pct: number) { return pct >= 70 ? 'Strong' : pct >= 40 ? 'Needs work' : 'Critical' }

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  quick_win: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  ongoing: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
}

const CATEGORY_ICONS: Record<string, string> = {
  reviews: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  keywords: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ads: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  gbp: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
}

const FILTER_TABS = [
  { id: 'all' as const, label: 'All' },
  { id: 'reviews' as const, label: 'Reviews' },
  { id: 'keywords' as const, label: 'Keywords' },
  { id: 'ads' as const, label: 'Ads' },
]

function ReportContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const scanId = searchParams.get('scan_id')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [scanData, setScanData] = useState<IntelScanData | null>(null)
  const [researchSources, setResearchSources] = useState<IntelResearchSource[] | null>(null)
  const [actionPlan, setActionPlan] = useState<IntelActionStep[] | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'reviews' | 'keywords' | 'ads'>('all')

  useEffect(() => {
    (async () => {
      try {
        const param = sessionId ? `session_id=${sessionId}` : scanId ? `scan_id=${scanId}` : null
        if (!param) { setError('No report identifier provided.'); setLoading(false); return }
        const res = await fetch(`/api/intel/report?${param}`)
        if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to load report') }
        const data = await res.json()
        setBusinessName(data.scan.businessName); setScanData(data.scan.scanData)
        setResearchSources(data.scan.researchSources || null); setActionPlan(data.scan.actionPlan)
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load report') }
      finally { setLoading(false) }
    })()
  }, [sessionId, scanId])

  const filteredSteps = actionPlan?.filter(s => activeFilter === 'all' || s.category === activeFilter)

  if (loading) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>

  if (error) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/intel" className="text-purple-400 hover:text-purple-300 underline">Generate a new report</Link>
      </div>
    </div>
  )

  const overall = scanData ? Math.round((scanData.gap_scores.reviews_pct + scanData.gap_scores.keywords_pct + scanData.gap_scores.ads_pct + scanData.gap_scores.gbp_pct) / 4) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <nav className="border-b border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2"><Image src="/dyia-logo-full.png" alt="dyia" width={100} height={33} className="brightness-0 invert opacity-90" /><span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">Intel</span></Link>
          <button className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:text-white hover:border-slate-500 transition-colors">Download PDF</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Payment successful
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Your 90-Day Action Plan</h1>
          <p className="text-slate-400 mb-4">{businessName}</p>
          {scanData && (
            <div className="inline-flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-full px-5 py-2">
              <span className={`text-2xl font-black ${sevColor(overall)}`}>{overall}</span>
              <span className="text-sm text-slate-300">Competitive Score — <span className={sevColor(overall)}>{sevLabel(overall)}</span></span>
            </div>
          )}
        </div>

        {/* Summary cards */}
        {scanData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            {[
              { label: 'Local Rank', value: `#${scanData.local_rank}`, pct: scanData.gap_scores.reviews_pct },
              { label: 'Reviews Behind', value: String(scanData.review_gap), pct: scanData.gap_scores.reviews_pct },
              { label: 'Missing Keywords', value: String(scanData.missing_keywords_count), pct: scanData.gap_scores.keywords_pct },
              { label: 'Avg Ad Spend', value: `$${scanData.competitor_ad_spend_avg}`, pct: scanData.gap_scores.ads_pct },
            ].map((c, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${sevColor(c.pct)}`}>{sevLabel(c.pct)}</span>
                <p className="text-2xl font-bold text-white mt-1">{c.value}</p>
                <p className="text-xs text-slate-400">{c.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {FILTER_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveFilter(tab.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeFilter === tab.id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{tab.label}</button>
          ))}
        </div>

        {/* Action Steps */}
        <div className="space-y-4 mb-12">
          {filteredSteps?.map(step => (
            <div key={step.step_number} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={CATEGORY_ICONS[step.category] || CATEGORY_ICONS.reviews} /></svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-bold text-white bg-slate-700/50 px-2 py-0.5 rounded">Step {step.step_number}</span>
                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full border ${PRIORITY_STYLES[step.priority] || ''}`}>{step.priority.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-500 uppercase font-medium">{step.category}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1.5">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
          {filteredSteps?.length === 0 && <p className="text-center text-slate-500 py-8">No steps in this category.</p>}
        </div>

        {/* Sources */}
        {researchSources && researchSources.length > 0 && (
          <details className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-12 group">
            <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-300 flex items-center gap-2"><svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>{researchSources.length} research sources</summary>
            <div className="space-y-2 mt-4">{researchSources.slice(0, 10).map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block px-3 py-2 bg-slate-900/50 rounded-lg hover:border-purple-500/20 transition-colors"><p className="text-xs font-medium text-white truncate">{s.title}</p><p className="text-[11px] text-slate-500 truncate">{s.url}</p></a>)}</div>
          </details>
        )}

        {/* Dyia CTA */}
        <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-2xl p-8 text-center">
          <div className="grid sm:grid-cols-2 gap-6 items-center text-left max-w-xl mx-auto">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Free scan = one-time snapshot</h3>
              <p className="text-sm text-slate-400">Your competitors don&apos;t stop. Neither should your intel.</p>
            </div>
            <div>
              <h3 className="text-lg font-bold text-orange-400 mb-2">Dyia Pro = fresh report every month</h3>
              <p className="text-sm text-slate-400">Auto-refreshed intel + action plan included in your subscription.</p>
            </div>
          </div>
          <Link href="/sign-up" className="inline-flex items-center gap-2 px-8 py-3 mt-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/20">
            Start your free Dyia trial
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function IntelReportPage() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>}><ReportContent /></Suspense>
}
