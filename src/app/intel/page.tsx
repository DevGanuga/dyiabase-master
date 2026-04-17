'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import { PublicHeader } from '@/components/PublicHeader'
import { INTEL_INDUSTRIES, INTEL_RADIUS_OPTIONS } from '@/types/database'
import type { IntelScanData, IntelActionStep, IntelResearchSource } from '@/types/database'

type Stage = 'form' | 'email' | 'loading' | 'report'

const RESEARCH_STEPS = [
  'Finding your business...',
  'Scanning competitors...',
  'Analyzing reviews...',
  'Checking keyword rankings...',
  'Evaluating ad presence...',
  'Building your report...',
]

function sevColor(pct: number) { return pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400' }
function sevBg(pct: number) { return pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500' }
function sevLabel(pct: number) { return pct >= 70 ? 'Strong' : pct >= 40 ? 'Room to grow' : 'Critical gap' }

export default function IntelPage() {
  const [stage, setStage] = useState<Stage>('form')
  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [industry, setIndustry] = useState('')
  const [radiusMiles, setRadiusMiles] = useState(25)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [usState, setUsState] = useState('')
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('')
  const [mainServices, setMainServices] = useState('')
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const [scanId, setScanId] = useState<string | null>(null)
  const [scanData, setScanData] = useState<IntelScanData | null>(null)
  const [researchSources, setResearchSources] = useState<IntelResearchSource[] | null>(null)
  const [researchReport, setResearchReport] = useState<string | null>(null)
  const [actionPlanPreview, setActionPlanPreview] = useState<IntelActionStep[] | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('cancelled') === 'true') setLoadingError('Payment was not completed. You can try again below.')
    const sid = params.get('scan_id')
    if (sid) { setScanId(sid); fetchExistingScan(sid) }
  }, [])

  async function fetchExistingScan(id: string) {
    try {
      const res = await fetch(`/api/intel/report?scan_id=${id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.scan?.scanData) {
        setScanData(data.scan.scanData)
        setResearchSources(data.scan.researchSources || null)
        setActionPlanPreview(data.scan.actionPlanPreview || null)
        setBusinessName(data.scan.businessName)
        setStage('report')
      }
    } catch { /* fresh start */ }
  }

  useEffect(() => {
    if (stage !== 'loading') return
    const iv = setInterval(() => setLoadingStep(p => Math.min(p + 1, RESEARCH_STEPS.length - 1)), 12000)
    return () => clearInterval(iv)
  }, [stage])

  useEffect(() => {
    if (stage !== 'loading') return
    // Safety timeout: 25 minutes (deep research can take 15-20 minutes)
    const t = setTimeout(() => {
      setLoadingError('Research is taking longer than usual. We'll email your report to ' + email + ' when it's ready.')
      setStage('form')
    }, 1_500_000) // 25 minutes
    return () => clearTimeout(t)
  }, [stage, scanId, email])

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim() || !zipCode.trim() || !industry) return
    if (!/^\d{5}$/.test(zipCode)) return
    setStage('email')
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setStage('loading'); setLoadingStep(0); setPollCount(0); setLoadingError(null)
    try {
      const serviceTags = mainServices.split(',').map(s => s.trim()).filter(Boolean)
      const res = await fetch('/api/intel/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(), websiteUrl: websiteUrl.trim() || undefined,
          zipCode: zipCode.trim(), city: city.trim() || undefined, state: usState || undefined,
          industry, radiusMiles, email: email.trim(), fullName: fullName.trim() || undefined,
          phone: phone.trim() || undefined, googleBusinessUrl: googleBusinessUrl.trim() || undefined,
          mainServices: serviceTags.length > 0 ? serviceTags : undefined,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Scan failed') }
      const data = await res.json()
      setScanId(data.scanId)
      if (data.status === 'complete' && data.scanData) {
        setScanData(data.scanData); setResearchSources(data.researchSources || null)
        setResearchReport(data.researchReport || null)
        setActionPlanPreview(data.actionPlanPreview || null); setStage('report'); return
      }
      // Poll for up to 20 minutes (deep research typically takes 5-15 minutes)
      const deadline = Date.now() + 1_200_000 // 20 minutes
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000)); setPollCount(p => p + 1)
        const sr = await fetch(`/api/intel/scan/status?scanId=${data.scanId}`)
        const sd = await sr.json()
        if (sd.status === 'complete') {
          setScanData(sd.scanData); setResearchSources(sd.researchSources || null)
          setResearchReport(sd.researchReport || null)
          setActionPlanPreview(sd.actionPlanPreview || null); setStage('report'); return
        }
        if (sd.status === 'failed') throw new Error(sd.error || 'Research failed')
      }
      throw new Error('Research is taking longer than usual. We'll email your report when it's ready.')
    } catch (err) { setLoadingError(err instanceof Error ? err.message : 'Something went wrong.'); setStage('form') }
  }

  async function handleCheckout() {
    if (!scanId || !email) return; setCheckoutLoading(true)
    try {
      const res = await fetch('/api/intel/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scanId, email }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url; else alert(data.error || 'Checkout failed.')
    } catch { alert('Could not connect to payment provider.') } finally { setCheckoutLoading(false) }
  }

  const competitors = scanData ? (() => {
    const has = scanData.top_competitors.some(c => c.name.toLowerCase() === businessName.toLowerCase())
    if (has) return scanData.top_competitors
    return [...scanData.top_competitors.slice(0, 4), { name: businessName, reviews: scanData.review_count_mine, estimated_ad_spend: 0, rank: scanData.local_rank }].sort((a, b) => a.rank - b.rank)
  })() : []
  const maxRev = Math.max(...competitors.map(c => c.reviews), 1)
  const overall = scanData ? Math.round((scanData.gap_scores.reviews_pct + scanData.gap_scores.keywords_pct + scanData.gap_scores.ads_pct + scanData.gap_scores.gbp_pct) / 4) : 0

  const IC = 'w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <PublicHeader variant="simple" activePage="/intel" />

      {loadingError && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg max-w-sm">
          <p className="text-sm font-medium">{loadingError}</p>
          <button onClick={() => setLoadingError(null)} className="absolute top-1 right-2 text-white/70 hover:text-white text-lg">&times;</button>
        </div>
      )}

      {/* FORM */}
      {stage === 'form' && (
        <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-xs font-medium mb-5">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" /></span>
              Powered by AI deep research
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent mb-4">How does your business stack up?</h1>
            <p className="text-lg text-slate-400 max-w-md mx-auto">Get a free competitive intelligence report with real competitor data, review gaps, and keyword opportunities.</p>
          </div>
          <form onSubmit={handleFormSubmit} className="space-y-4 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 sm:p-8">
            <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Business name *</label><input type="text" required value={businessName} onChange={e => setBusinessName(e.target.value)} className={IC} placeholder="e.g. Quick Haul Junk Removal" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Website URL <span className="text-slate-500">(optional)</span></label><input type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className={IC} placeholder="https://yourbusiness.com" /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Google review link <span className="text-slate-500">(recommended)</span></label><input type="url" value={googleBusinessUrl} onChange={e => setGoogleBusinessUrl(e.target.value)} className={IC} placeholder="https://g.co/kgs/..." /></div>
            </div>
            <p className="text-[11px] text-slate-500 -mt-2">Adding your Google review link helps us find your exact listing and get accurate review counts.</p>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Zip code *</label><input type="text" required maxLength={5} pattern="\d{5}" value={zipCode} onChange={e => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))} className={IC} placeholder="77001" /></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Industry *</label><select required value={industry} onChange={e => setIndustry(e.target.value)} className={IC}><option value="">Select</option>{INTEL_INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-1.5">Radius</label><select value={radiusMiles} onChange={e => setRadiusMiles(Number(e.target.value))} className={IC}>{INTEL_RADIUS_OPTIONS.map(r => <option key={r} value={r}>{r} mi</option>)}</select></div>
            </div>
            <button type="submit" className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-purple-500/25 active:scale-[0.98] text-base">Generate my report</button>
            <p className="text-center text-xs text-slate-500">Free. No credit card required.</p>
          </form>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-xs text-slate-500">
            {['AI-powered deep research', 'Real competitor data', 'Results in 5-15 minutes'].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5"><svg className="w-3.5 h-3.5 text-purple-400/60" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* EMAIL GATE */}
      {stage === 'email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-lg w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div>
              <h2 className="text-xl font-bold text-white mb-1">Where should we send your report?</h2>
              <p className="text-sm text-slate-400">We&apos;ll email you a copy so you can reference it later.</p>
            </div>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" required autoFocus value={fullName} onChange={e => setFullName(e.target.value)} className={IC} placeholder="Your name *" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={IC} placeholder="Email *" />
              </div>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={IC} placeholder="Phone (optional)" />
              <details className="group"><summary className="text-xs text-purple-400 cursor-pointer hover:text-purple-300 py-1">Help us find your business faster (optional)</summary>
                <div className="space-y-3 mt-3 pt-3 border-t border-slate-700/50">
                  <div className="grid grid-cols-2 gap-3"><input type="text" value={city} onChange={e => setCity(e.target.value)} className={IC} placeholder="City" /><input type="text" value={usState} onChange={e => setUsState(e.target.value.toUpperCase().slice(0, 2))} className={IC} placeholder="State (e.g. TX)" maxLength={2} /></div>
                  <input type="text" value={mainServices} onChange={e => setMainServices(e.target.value)} className={IC} placeholder="Main services (comma-separated)" />
                </div>
              </details>
              <button type="submit" className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg transition-all">Start research</button>
              <button type="button" onClick={() => setStage('form')} className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors">Go back</button>
            </form>
          </div>
        </div>
      )}

      {/* LOADING */}
      {stage === 'loading' && (
        <div className="max-w-md mx-auto px-4 py-20 sm:py-28">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5"><div className="w-8 h-8 border-[3px] border-purple-500/30 border-t-purple-500 rounded-full animate-spin" /></div>
            <h2 className="text-xl font-bold text-white mb-1">Researching {businessName}</h2>
            <p className="text-sm text-slate-400">Deep research takes 5-15 minutes for accurate data</p>
          </div>
          <div className="space-y-2.5">
            {RESEARCH_STEPS.map((label, i) => {
              const done = i < loadingStep, cur = i === loadingStep
              return (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all duration-500 ${done ? 'bg-emerald-500/5 border-emerald-500/20' : cur ? 'bg-purple-500/5 border-purple-500/20' : 'bg-slate-800/30 border-slate-700/30 opacity-40'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500/20' : cur ? 'bg-purple-500/20' : 'bg-slate-700/50'}`}>
                    {done ? <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : cur ? <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" /> : <div className="w-2 h-2 bg-slate-600 rounded-full" />}
                  </div>
                  <span className={`text-sm ${done ? 'text-emerald-400' : cur ? 'text-white font-medium' : 'text-slate-500'}`}>{label}</span>
                </div>
              )
            })}
          </div>
          {pollCount > 40 && <p className="text-center text-xs text-slate-500 mt-6">Still analyzing... verifying competitor data and review counts.</p>}
          {pollCount > 120 && <p className="text-center text-xs text-amber-400 mt-2">Taking longer than usual. We'll email you when it's ready — feel free to close this page.</p>}
        </div>
      )}

      {/* REPORT */}
      {stage === 'report' && scanData && (
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-10">
            <p className="text-sm text-purple-400 font-medium mb-3">Competitive Intelligence Report</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{businessName}</h1>
            <div className="inline-flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-full px-6 py-3">
              <div className={`text-3xl font-black ${sevColor(overall)}`}>{overall}</div>
              <div className="text-left"><p className="text-sm font-semibold text-white">Competitive Score</p><p className={`text-xs font-medium ${sevColor(overall)}`}>{sevLabel(overall)} — Ranked #{scanData.local_rank} of {scanData.total_competitors}</p></div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Local Rank', value: `#${scanData.local_rank}`, sub: `of ${scanData.total_competitors}`, pct: Math.max(0, 100 - (scanData.local_rank / Math.max(scanData.total_competitors, 1)) * 100) },
              { label: 'Reviews Behind', value: String(scanData.review_gap), sub: `You: ${scanData.review_count_mine} · Leader: ${scanData.review_count_leader}`, pct: scanData.gap_scores.reviews_pct },
              { label: 'Missing Keywords', value: String(scanData.missing_keywords_count), sub: 'competitors rank for', pct: scanData.gap_scores.keywords_pct },
              { label: 'Avg Ad Spend', value: `$${scanData.competitor_ad_spend_avg}`, sub: 'competitor avg/month', pct: scanData.gap_scores.ads_pct },
            ].map((c, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${sevBg(c.pct)}/20 ${sevColor(c.pct)}`}>{sevLabel(c.pct)}</span>
                <p className="text-3xl font-bold text-white mt-2">{c.value}</p>
                <p className="text-sm font-medium text-slate-300 mt-1">{c.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Competitor Rankings */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Competitor Rankings</h3>
            <div className="space-y-2">
              {competitors.map((comp, i) => {
                const isMe = comp.name.toLowerCase() === businessName.toLowerCase()
                const bw = Math.max(5, (comp.reviews / maxRev) * 100)
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${isMe ? 'bg-purple-500/10 border-purple-500/30' : 'bg-slate-900/30 border-slate-700/30'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${comp.rank === 1 ? 'bg-amber-500/20 text-amber-400' : comp.rank <= 3 ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-800/50 text-slate-500'}`}>{comp.rank}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className={`text-sm font-medium truncate ${isMe ? 'text-purple-300' : 'text-white'}`}>{comp.name}</span>{isMe && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0">You</span>}</div>
                      <div className="flex items-center gap-2 mt-1"><div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden"><div className={`h-full rounded-full ${isMe ? 'bg-purple-500' : 'bg-slate-500'}`} style={{ width: `${bw}%` }} /></div><span className="text-xs text-slate-400 shrink-0 w-16 text-right">{comp.reviews} reviews</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gap Analysis */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-1">Gap Analysis</h3>
            <p className="text-sm text-slate-400 mb-6">How close you are to the market leader</p>
            <div className="space-y-5">
              {[
                { label: 'Reviews', pct: scanData.gap_scores.reviews_pct, insight: `You have ${scanData.review_count_mine} reviews — the leader has ${scanData.review_count_leader}` },
                { label: 'Keywords', pct: scanData.gap_scores.keywords_pct, insight: `${scanData.missing_keywords_count} keywords your competitors rank for that you don't` },
                { label: 'Ad Presence', pct: scanData.gap_scores.ads_pct, insight: `Competitors spend avg $${scanData.competitor_ad_spend_avg}/mo on ads` },
                { label: 'Google Profile', pct: scanData.gap_scores.gbp_pct, insight: scanData.gbp_gaps[0] || 'Compare your GBP completeness vs leader' },
              ].map((g, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-2"><span className="text-sm font-medium text-white">{g.label}</span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sevBg(g.pct)}/20 ${sevColor(g.pct)}`}>{g.pct}%</span></div><span className={`text-xs ${sevColor(g.pct)}`}>{sevLabel(g.pct)}</span></div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden mb-1.5"><div className={`h-full rounded-full ${sevBg(g.pct)} transition-all duration-1000`} style={{ width: `${g.pct}%` }} /></div>
                  <p className="text-xs text-slate-500">{g.insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Research Report Preview — show executive summary only, rest is gated */}
          {researchReport && (() => {
            const lines = researchReport.split('\n')
            const execEnd = lines.findIndex((l, i) => i > 5 && l.startsWith('## '))
            const previewText = execEnd > 0 ? lines.slice(0, execEnd).join('\n') : lines.slice(0, 15).join('\n')
            return (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden mb-8">
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center"><svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg></div>
                    <div><h3 className="text-lg font-semibold text-white">Research Report</h3><p className="text-xs text-slate-400">AI-generated competitive analysis with verified data and citations</p></div>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-700/50 prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2 prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-white prose-strong:font-semibold prose-ul:my-3 prose-li:text-slate-300 prose-li:my-1.5 prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300 prose-a:transition-colors">
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 border-b border-purple-400/30 hover:border-purple-400/60">
                            {props.children}
                            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        ),
                      }}
                    >
                      {previewText}
                    </ReactMarkdown>
                  </div>
                </div>
                <div className="relative">
                  <div className="h-40 bg-gradient-to-b from-transparent via-slate-900/80 to-slate-900" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-center bg-slate-900/95">
                    <p className="text-sm text-slate-400 mb-2">Full report includes: Competitor Deep Dive, Review Analysis, Keyword Gap Analysis, GBP Audit, Ad Landscape, and Opportunity Assessment</p>
                    <p className="text-xs text-purple-400 font-medium">Included in the $27 action plan below</p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Missing Keywords */}
          {scanData.missing_keywords.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-white mb-1">Missing Keywords</h3>
              <p className="text-sm text-slate-400 mb-4">Search terms your competitors rank for that you don&apos;t</p>
              <div className="flex flex-wrap gap-2">{scanData.missing_keywords.map((kw, i) => <span key={i} className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs font-medium text-amber-300">{kw}</span>)}</div>
            </div>
          )}

          {/* GBP Gaps */}
          {scanData.gbp_gaps.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-white mb-1">Google Business Profile Gaps</h3>
              <p className="text-sm text-slate-400 mb-4">Issues to fix vs the top competitor</p>
              <div className="space-y-2">{scanData.gbp_gaps.map((gap, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg"><svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg><span className="text-sm text-slate-300">{gap}</span></div>
              ))}</div>
            </div>
          )}

          {/* Sources */}
          {researchSources && researchSources.length > 0 && (
            <details className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8 group">
              <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-300 flex items-center gap-2"><svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>{researchSources.length} research sources</summary>
              <div className="space-y-2 mt-4">{researchSources.slice(0, 10).map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="block px-3 py-2 bg-slate-900/50 border border-slate-700/30 rounded-lg hover:border-purple-500/20 transition-colors"><p className="text-xs font-medium text-white truncate">{s.title}</p><p className="text-[11px] text-slate-500 truncate">{s.url}</p></a>)}</div>
            </details>
          )}

          {/* Action Plan Preview */}
          {actionPlanPreview && actionPlanPreview.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-4">
              <h3 className="text-lg font-semibold text-white mb-1">Your Action Plan Preview</h3>
              <p className="text-sm text-slate-400 mb-4">Steps 1-2 free. Unlock the full plan below.</p>
              {actionPlanPreview.filter(s => s.include_in_free_preview).map(step => (
                <div key={step.step_number} className="flex items-start gap-3 px-4 py-4 bg-slate-900/50 border border-slate-700/30 rounded-lg mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-sm font-bold text-purple-300 shrink-0">{step.step_number}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${step.priority === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30' : step.priority === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : step.priority === 'quick_win' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'}`}>{step.priority.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-500 uppercase">{step.category}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white mb-0.5">{step.title}</h4>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </div>
                </div>
              ))}
              <div className="mt-3 space-y-2">{[3,4,5,6].map(n => <div key={n} className="flex items-center gap-3 px-4 py-3 bg-slate-900/30 border border-slate-700/20 rounded-lg relative overflow-hidden"><div className="absolute inset-0 backdrop-blur-[2px] bg-slate-900/40 z-10" /><div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-500">{n}</div><div className="h-3 bg-slate-700/50 rounded w-2/3" /><svg className="w-4 h-4 text-slate-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></div>)}</div>
            </div>
          )}

          {/* Upsell */}
          <div className="bg-gradient-to-br from-purple-600/90 via-indigo-600/80 to-purple-700/90 border border-purple-500/30 rounded-2xl p-8 sm:p-10 mb-8">
            <div className="max-w-lg mx-auto text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Your full competitive analysis + 90-day action plan</h2>
              <p className="text-purple-100/90 mb-6">A complete analyst-level research report + 6 prioritized action steps, all built from <span className="font-semibold text-white">your</span> verified market data.{scanData.review_gap > 0 ? ` Close your ${scanData.review_gap}-review gap.` : ''}{scanData.missing_keywords_count > 0 ? ` Capture ${scanData.missing_keywords_count} missing keywords.` : ''} Start winning.</p>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 text-left">
                <ul className="space-y-2.5 text-sm text-purple-100">{[
                    'Full analyst-level research report with citations',
                    '6 prioritized action steps built from your data',
                    'Competitor deep dive — strengths, weaknesses, ad spend',
                    'Keyword gap analysis with specific search terms',
                    'Google Business Profile audit vs #1 competitor',
                    'Delivered instantly + emailed to you',
                    'Money-back guarantee',
                  ].map((t,i) => <li key={i} className="flex items-start gap-2"><svg className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>{t}</li>)}</ul>
              </div>
              <p className="text-xs text-purple-200/60 mb-4">Businesses spend $1,500+/mo on consultants for this.</p>
              <button onClick={handleCheckout} disabled={checkoutLoading} className="px-10 py-4 bg-white text-purple-700 font-bold rounded-xl hover:bg-purple-50 transition-colors shadow-xl disabled:opacity-50 text-lg">{checkoutLoading ? 'Opening checkout...' : 'Get my action plan — $27'}</button>
              <p className="text-xs text-purple-200/50 mt-3">One-time payment. Instant delivery.</p>
            </div>
          </div>

          {/* Dyia CTA */}
          <div className="text-center py-8 border-t border-slate-800">
            <p className="text-slate-400 mb-1">Want this updated automatically every month?</p>
            <p className="text-sm text-slate-500 mb-4">Dyia subscribers get a fresh Intel report + action plan every month at no extra cost.</p>
            <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors">Start your free Dyia trial<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></Link>
          </div>
        </div>
      )}
    </div>
  )
}
