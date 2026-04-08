'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { INTEL_INDUSTRIES, INTEL_RADIUS_OPTIONS } from '@/types/database'
import type { IntelScanData, IntelActionStep, IntelResearchSource } from '@/types/database'

type Stage = 'form' | 'email' | 'loading' | 'report'

const LOADING_MESSAGES = [
  'Scanning your market...',
  'Analyzing competitors...',
  'Building your report...',
  'Researching deeper findings...',
  'Finalizing your report...',
]

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'] as const

export default function IntelPage() {
  const [stage, setStage] = useState<Stage>('form')

  // Form state — business info
  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [city, setCity] = useState('')
  const [usState, setUsState] = useState('')
  const [industry, setIndustry] = useState('')
  const [radiusMiles, setRadiusMiles] = useState(25)
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('')
  const [mainServices, setMainServices] = useState('')
  const [yearsInBusiness, setYearsInBusiness] = useState('')
  const [teamSize, setTeamSize] = useState('')

  // Form state — lead contact (captured in email gate)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // Loading state
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // Report state
  const [scanId, setScanId] = useState<string | null>(null)
  const [scanData, setScanData] = useState<IntelScanData | null>(null)
  const [researchSources, setResearchSources] = useState<IntelResearchSource[] | null>(null)
  const [actionPlanPreview, setActionPlanPreview] = useState<IntelActionStep[] | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  // Check for returning users with scan_id in URL (or cancelled checkout)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const existingScanId = params.get('scan_id')
    if (params.get('cancelled') === 'true') {
      setLoadingError('Payment was not completed. You can try again below.')
    }
    if (existingScanId) {
      setScanId(existingScanId)
      fetchExistingScan(existingScanId)
    }
  }, [])

  async function fetchExistingScan(id: string) {
    try {
      const res = await fetch(`/api/intel/report?scan_id=${id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.scan?.scanData) {
          setScanData(data.scan.scanData)
          setResearchSources(data.scan.researchSources || null)
          setActionPlanPreview(data.scan.actionPlanPreview || null)
          setBusinessName(data.scan.businessName)
          setStage('report')
        }
      }
    } catch {
      // Ignore — user can start fresh
    }
  }

  // Rotate loading messages
  useEffect(() => {
    if (stage !== 'loading') return
    const interval = setInterval(() => {
      setLoadingMsgIdx(prev => Math.min(prev + 1, LOADING_MESSAGES.length - 1))
    }, 15000)
    return () => clearInterval(interval)
  }, [stage])

  // Deep research can take longer than standard model runs.
  useEffect(() => {
    if (stage !== 'loading') return
    const timeout = setTimeout(() => {
      setLoadingError('The research is taking longer than expected. Please try again in a moment.')
      setStage('form')
    }, 300000)
    return () => clearTimeout(timeout)
  }, [stage])

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim() || !zipCode.trim() || !industry) return
    if (!/^\d{5}$/.test(zipCode)) return
    setStage('email')
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setStage('loading')
    setLoadingMsgIdx(0)
    setLoadingError(null)

    try {
      const serviceTags = mainServices.split(',').map(s => s.trim()).filter(Boolean)

      // Start the research (returns immediately)
      const res = await fetch('/api/intel/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          websiteUrl: websiteUrl.trim() || undefined,
          zipCode: zipCode.trim(),
          city: city.trim() || undefined,
          state: usState || undefined,
          industry,
          radiusMiles,
          email: email.trim(),
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          googleBusinessUrl: googleBusinessUrl.trim() || undefined,
          mainServices: serviceTags.length > 0 ? serviceTags : undefined,
          yearsInBusiness: yearsInBusiness ? parseInt(yearsInBusiness) : undefined,
          teamSize: teamSize ? parseInt(teamSize) : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Scan failed')
      }

      const data = await res.json()
      setScanId(data.scanId)

      // If the scan was already completed (duplicate email), show it immediately
      if (data.status === 'complete' && data.scanData) {
        setScanData(data.scanData)
        setResearchSources(data.researchSources || null)
        setStage('report')
        return
      }

      // Poll the status endpoint until deep research completes
      const deadline = Date.now() + 600_000
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000))

        const statusRes = await fetch(`/api/intel/scan/status?scanId=${data.scanId}`)
        const statusData = await statusRes.json()

        if (statusData.status === 'complete') {
          setScanData(statusData.scanData)
          setResearchSources(statusData.researchSources || null)
          setStage('report')
          return
        }

        if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Research failed')
        }
      }

      throw new Error('Research is taking longer than expected. Please try again.')
    } catch (err) {
      setLoadingError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('form')
    }
  }

  async function handleCheckout() {
    if (!scanId || !email) return
    setCheckoutLoading(true)

    try {
      const res = await fetch('/api/intel/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId, email }),
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Checkout failed. Please try again.')
      }
    } catch {
      alert('Could not connect to payment provider.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const publicCompetitorRows = scanData
    ? (() => {
        const alreadyIncluded = scanData.top_competitors.some(
          comp => comp.name.toLowerCase() === businessName.toLowerCase()
        )
        if (alreadyIncluded) return scanData.top_competitors

        return [
          ...scanData.top_competitors.slice(0, 4),
          {
            name: businessName,
            reviews: scanData.review_count_mine,
            estimated_ad_spend: 0,
            rank: scanData.local_rank,
          },
        ].sort((a, b) => a.rank - b.rank)
      })()
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Nav */}
      <nav className="border-b border-slate-800/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/dyia-logo-full.png" alt="dyia" width={100} height={33} className="brightness-0 invert opacity-90" />
            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">Intel</span>
          </Link>
          <Link href="/sign-up" className="text-sm text-slate-400 hover:text-white transition-colors">
            Sign up for Dyia
          </Link>
        </div>
      </nav>

      {/* Error toast */}
      {loadingError && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 max-w-sm">
          <p className="text-sm font-medium">{loadingError}</p>
          <button onClick={() => setLoadingError(null)} className="absolute top-1 right-2 text-white/70 hover:text-white text-lg">&times;</button>
        </div>
      )}

      {/* FORM STAGE */}
      {stage === 'form' && (
        <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent mb-4">
              How does your business stack up?
            </h1>
            <p className="text-lg text-slate-400 max-w-lg mx-auto">
              Get a free competitive intelligence report for your local service business in 60 seconds.
            </p>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-5 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 sm:p-8">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Business name *</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="e.g. Quick Haul Junk Removal"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Website URL <span className="text-slate-500">(optional)</span></label>
              <input
                type="url"
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="https://www.yourbusiness.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Google Business Profile URL <span className="text-slate-500">(optional — helps us find your exact listing)</span></label>
              <input
                type="url"
                value={googleBusinessUrl}
                onChange={e => setGoogleBusinessUrl(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="https://g.co/kgs/..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Zip code *</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  pattern="\d{5}"
                  value={zipCode}
                  onChange={e => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="77001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="Houston"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">State</label>
                <select
                  value={usState}
                  onChange={e => setUsState(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                >
                  <option value="">—</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Industry *</label>
                <select
                  required
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                >
                  <option value="">Select your industry</option>
                  {INTEL_INDUSTRIES.map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Search radius</label>
                <select
                  value={radiusMiles}
                  onChange={e => setRadiusMiles(Number(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                >
                  {INTEL_RADIUS_OPTIONS.map(r => (
                    <option key={r} value={r}>{r} miles</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Main services <span className="text-slate-500">(comma-separated)</span></label>
              <input
                type="text"
                value={mainServices}
                onChange={e => setMainServices(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="e.g. Junk removal, Demolition, Cleanouts"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Years in business</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={yearsInBusiness}
                  onChange={e => setYearsInBusiness(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Team size</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={teamSize}
                  onChange={e => setTeamSize(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  placeholder="4"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
            >
              Generate my report
            </button>

            <p className="text-center text-xs text-slate-500">Free and instant. No credit card required.</p>
          </form>
        </div>
      )}

      {/* EMAIL GATE */}
      {stage === 'email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Where should we send your report?</h2>
              <p className="text-sm text-slate-400">We&apos;ll email you a copy so you can reference it later.</p>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="Your full name"
              />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="you@business.com"
              />
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                placeholder="(555) 123-4567 (optional)"
              />
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold rounded-lg transition-all"
              >
                Show my report
              </button>
              <button
                type="button"
                onClick={() => setStage('form')}
                className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Go back
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOADING STATE */}
      {stage === 'loading' && (
        <div className="max-w-lg mx-auto px-4 py-32 text-center">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-purple-400/20" />
            <div className="absolute inset-2 rounded-full border-4 border-purple-400 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="text-xl font-semibold text-white mb-2 animate-pulse">
            {LOADING_MESSAGES[loadingMsgIdx]}
          </p>
          <p className="text-sm text-slate-400">Deep research usually takes 1–3 minutes</p>
          <div className="mt-8 flex justify-center gap-2">
            {LOADING_MESSAGES.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i <= loadingMsgIdx ? 'w-12 bg-purple-500' : 'w-8 bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* REPORT STAGE */}
      {stage === 'report' && scanData && (
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
          {/* Report header */}
          <div className="text-center mb-10">
            <p className="text-sm text-purple-400 font-medium mb-2">Competitive Intelligence Report</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">{businessName}</h1>
            <p className="text-slate-400">
              Scanned on {new Date(scanData.scan_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {' '}· {scanData.total_competitors} competitors in range
            </p>
          </div>

          {/* 4 Metric Cards (spec 3.1 step 5) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              label="Local Rank"
              value={`#${scanData.local_rank}`}
              sub={`of ${scanData.total_competitors}`}
              color="purple"
            />
            <MetricCard
              label="Reviews Behind"
              value={String(scanData.review_gap)}
              sub={`You: ${scanData.review_count_mine} · Leader: ${scanData.review_count_leader}`}
              color="red"
            />
            <MetricCard
              label="Missing Keywords"
              value={String(scanData.missing_keywords_count)}
              sub="competitors rank for"
              color="amber"
            />
            <MetricCard
              label="Avg Ad Spend"
              value={`$${scanData.competitor_ad_spend_avg}`}
              sub="competitor avg/month"
              color="blue"
            />
          </div>

          {/* Competitor Table */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Top Competitors</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-3 px-2 font-medium">Rank</th>
                    <th className="text-left py-3 px-2 font-medium">Business</th>
                    <th className="text-right py-3 px-2 font-medium">Reviews</th>
                    <th className="text-right py-3 px-2 font-medium hidden sm:table-cell">Est. Ad Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {publicCompetitorRows.map((comp, i) => {
                    const isMe = comp.name.toLowerCase() === businessName.toLowerCase()
                    return (
                      <tr
                        key={i}
                        className={`border-b border-slate-700/50 ${isMe ? 'bg-purple-500/10' : ''}`}
                      >
                        <td className="py-3 px-2 font-medium text-slate-300">#{comp.rank}</td>
                        <td className="py-3 px-2 text-white">
                          {comp.name}
                          {isMe && <span className="ml-2 text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">You</span>}
                        </td>
                        <td className="py-3 px-2 text-right text-slate-300">{comp.reviews}</td>
                        <td className="py-3 px-2 text-right text-slate-300 hidden sm:table-cell">${comp.estimated_ad_spend}/mo</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gap Score Bars */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Gap Scores</h3>
            <p className="text-sm text-slate-400 mb-6">How close you are to matching the market leader</p>
            <div className="space-y-4">
              <GapBar label="Reviews" pct={scanData.gap_scores.reviews_pct} color="bg-blue-500" />
              <GapBar label="Keywords" pct={scanData.gap_scores.keywords_pct} color="bg-emerald-500" />
              <GapBar label="Ad Presence" pct={scanData.gap_scores.ads_pct} color="bg-amber-500" />
              <GapBar label="GBP Profile" pct={scanData.gap_scores.gbp_pct} color="bg-purple-500" />
            </div>
          </div>

          {/* Avg competitor ad spend */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-2">Competitor Ad Spend</h3>
            <p className="text-3xl font-bold text-amber-400">${scanData.competitor_ad_spend_avg}<span className="text-lg font-normal text-slate-400">/mo avg</span></p>
            <p className="text-sm text-slate-400 mt-1">Average monthly ad spend across top 3 competitors</p>
          </div>

          {researchSources && researchSources.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-white mb-3">Research Sources</h3>
              <p className="text-sm text-slate-400 mb-4">This report is grounded in live web research. OpenAI requires visible source citations for web-derived output.</p>
              <div className="space-y-2">
                {researchSources.slice(0, 8).map(source => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block px-4 py-3 bg-slate-900/60 border border-slate-700/40 rounded-lg hover:border-purple-500/30 hover:bg-slate-900 transition-colors"
                  >
                    <p className="text-sm font-medium text-white">{source.title}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{source.url}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Action Plan Preview */}
          {actionPlanPreview && actionPlanPreview.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-4">
              <h3 className="text-lg font-semibold text-white mb-4">Action Plan Preview</h3>
              {actionPlanPreview.map(step => (
                <ActionStepCard key={step.step_number} step={step} />
              ))}
              <div className="mt-4 space-y-2">
                {[3, 4, 5, 6].map(n => (
                  <div key={n} className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 border border-slate-700/30 rounded-lg opacity-50">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-500">{n}</div>
                    <div className="h-3 bg-slate-700 rounded w-2/3" />
                    <svg className="w-4 h-4 text-slate-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upsell Banner */}
          <div className="bg-gradient-to-r from-purple-600/90 to-indigo-600/90 border border-purple-500/30 rounded-2xl p-8 text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-3">Get your 90-day action plan</h2>
            <p className="text-purple-100 mb-6 max-w-lg mx-auto">
              6 prioritized steps built from your data. Each step tells you exactly what to do, with specific numbers from your report.
            </p>
            <ul className="text-left max-w-md mx-auto space-y-2 mb-8 text-sm text-purple-100">
              {[
                'Prioritized by impact — tackle the biggest gaps first',
                'Specific to your market data, not generic advice',
                'Covers reviews, keywords, ads, and Google profile',
                'Step-by-step with exact actions and benchmarks',
                'Delivered instantly + emailed to you',
                'Money-back guarantee — no questions asked',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-300 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="px-8 py-3.5 bg-white text-purple-700 font-bold rounded-lg hover:bg-purple-50 transition-colors shadow-xl disabled:opacity-50 text-lg"
            >
              {checkoutLoading ? 'Opening checkout...' : 'Get my action plan — $27'}
            </button>
            <p className="text-xs text-purple-200/70 mt-3">One-time payment. Instant delivery.</p>
          </div>

          {/* Dyia CTA */}
          <div className="text-center py-8 border-t border-slate-800">
            <p className="text-slate-400 mb-3">Want this updated automatically every month?</p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              Start your free Dyia trial
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// --- Subcomponents ---

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  }
  const textColors: Record<string, string> = {
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5 text-center`}>
      <p className={`text-3xl font-bold ${textColors[color]}`}>{value}</p>
      <p className="text-sm font-medium text-white mt-1">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}

function GapBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 font-medium">{pct}%</span>
      </div>
      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ActionStepCard({ step }: { step: IntelActionStep }) {
  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400',
    medium: 'bg-amber-500/20 text-amber-400',
    quick_win: 'bg-emerald-500/20 text-emerald-400',
    ongoing: 'bg-indigo-500/20 text-indigo-400',
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 bg-slate-900/50 border border-slate-700/30 rounded-lg mb-2">
      <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-300 shrink-0 mt-0.5">
        {step.step_number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${priorityColors[step.priority] || ''}`}>
            {step.priority.replace('_', ' ')}
          </span>
          <span className="text-sm font-medium text-white">{step.title}</span>
        </div>
        <p className="text-sm text-slate-400">{step.description}</p>
      </div>
    </div>
  )
}
