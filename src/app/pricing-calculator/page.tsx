'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'

type JobType = 'volume' | 'multipleLoads' | 'specialty' | 'mixed'

interface SavedQuote {
  id: string
  date: string
  jobType: JobType
  customerName: string
  address: string
  quotePrice: number
  totalCost: number
  profit: number
  margin: number
}

const LICENSE_KEY = 'DDE65C3A-9BB04BFF-B79018FB-EBC11933'
const LICENSE_STORAGE_KEY = 'dyia_calc_license'
const QUOTES_STORAGE_KEY = 'dyia_saved_quotes'

const NATIONAL_AVERAGES = [
  { size: 'Minimum Pickup', range: '$75 - $150' },
  { size: '1/4 Load', range: '$150 - $250' },
  { size: '1/2 Load', range: '$250 - $450' },
  { size: '3/4 Load', range: '$400 - $600' },
  { size: 'Full Load', range: '$550 - $850' },
]

const JOB_TYPE_LABELS: Record<JobType, string> = {
  volume: 'Volume', multipleLoads: 'Multi-Load', specialty: 'Specialty', mixed: 'Mixed',
}

function normalize(key: string) {
  return key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }


// ═════════════════════════════════════════════════════════════════
// LICENSE GATE
// ═════════════════════════════════════════════════════════════════

function LicenseGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 300) }, [])

  const handleSubmit = () => {
    if (normalize(key) === normalize(LICENSE_KEY)) {
      setError('')
      setSuccess(true)
      localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify({ validated: new Date().toISOString() }))
      setTimeout(onUnlock, 800)
    } else {
      setError('Invalid license key. Check your purchase email and try again.')
      setKey('')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img src="/dyia-logo-full.png" alt="dyia" className="h-10 mx-auto object-contain brightness-0 invert mb-6" />
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs font-semibold uppercase tracking-wider mb-5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            Upgraded version
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-space-grotesk tracking-tight mb-3">
            Welcome back. Your calculator got an upgrade.
          </h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
            Same tool you know, rebuilt with a better engine. Enter your license key to pick up where you left off.
          </p>
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">What&apos;s new</p>
          <div className="space-y-2.5 text-[13px] text-white/50">
            {['Multi-load pricing with bulk discounts', 'Live $/hour & breakeven calculations', 'Save quotes locally & review history', 'Cost breakdown visualization', 'Save directly into your dyia pipeline'].map((t) => (
              <div key={t} className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-orange-500/70 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-6 sm:p-8">
          {success ? (
            <div className="text-center py-4 animate-fade-in">
              <div className="w-14 h-14 mx-auto rounded-full bg-orange-500/15 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-white font-semibold text-lg mb-1">Welcome back</p>
              <p className="text-white/40 text-sm">Loading your upgraded calculator...</p>
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-white/60 mb-2">Your License Key</label>
              <input ref={inputRef} type="text" value={key} onChange={(e) => { setKey(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                spellCheck={false} autoComplete="off"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3.5 text-sm font-mono tracking-wider placeholder:text-white/20 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all" />
              {error && <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-sm text-red-400 animate-fade-in">{error}</div>}
              <button onClick={handleSubmit} disabled={!key.trim()} className="w-full mt-5 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Unlock upgraded calculator
              </button>
              <p className="text-center text-white/25 text-xs mt-4">Same key from your original Gumroad purchase. Check your confirmation email.</p>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3"><div className="w-6 h-px bg-white/10" /><span className="text-white/20 text-xs">or go even further</span><div className="w-6 h-px bg-white/10" /></div>
          <p className="text-white/30 text-sm mb-3">Get the full business platform — quotes, job tracking, AI insights, and more.</p>
          <Link href="/sign-up?redirect_url=/app&utm_source=pricing-calculator" className="inline-flex items-center gap-2 text-orange-400 text-sm font-semibold hover:text-orange-300 transition-colors">
            Start free 14-day trial of dyia
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════
// SAVE QUOTE MODAL
// ═════════════════════════════════════════════════════════════════

function SaveQuoteModal({ onClose, onSaveLocal, quotePrice, profit, margin }: {
  onClose: () => void; onSaveLocal: (name: string, address: string) => void
  quotePrice: number; profit: number; margin: number
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [savedLocally, setSavedLocally] = useState(false)

  const handleSaveLocal = () => {
    onSaveLocal(name, address)
    setSavedLocally(true)
  }

  const handleSaveToDyia = () => {
    const params = new URLSearchParams({
      redirect_url: '/app', utm_source: 'pricing-calculator',
      ...(name && { quote_customer: name }), ...(phone && { quote_phone: phone }),
      ...(email && { quote_email: email }), quote_amount: quotePrice.toFixed(2),
    })
    window.location.href = `/sign-up?${params.toString()}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-[#131315] border border-white/[0.08] p-6 sm:p-7 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0"><span className="text-white font-black text-lg">d</span></div>
          <div>
            <h3 className="text-white font-semibold text-base">Save this quote</h3>
            <p className="text-white/40 text-xs mt-0.5">Save locally or send it straight to your dyia pipeline.</p>
          </div>
          <button onClick={onClose} className="ml-auto text-white/30 hover:text-white/60 transition p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 mb-5 flex items-center justify-between text-sm">
          <div><p className="text-white/40 text-xs">Quote total</p><p className="text-white font-semibold text-lg tabular-nums">${fmt(quotePrice)}</p></div>
          <div className="text-right"><p className="text-white/40 text-xs">Profit ({margin.toFixed(0)}%)</p><p className={`font-semibold text-lg tabular-nums ${profit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>${fmt(profit)}</p></div>
        </div>

        <div className="space-y-3">
          <InputField label="Customer name" value={name} onChange={setName} placeholder="e.g. John Smith" />
          <InputField label="Job address (optional)" value={address} onChange={setAddress} placeholder="123 Main St" />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Phone (optional)" value={phone} onChange={setPhone} placeholder="(555) 123-4567" type="tel" />
            <InputField label="Email (optional)" value={email} onChange={setEmail} placeholder="john@email.com" type="email" />
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {savedLocally ? (
            <div className="w-full py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium text-center animate-fade-in">
              Saved to local history
            </div>
          ) : (
            <button onClick={handleSaveLocal} className="w-full py-3 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:border-white/20 hover:text-white/80 transition-all">
              Save to local history
            </button>
          )}
          <button onClick={handleSaveToDyia} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2">
            Save to dyia & create account
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
          </button>
        </div>
        <p className="text-center text-white/20 text-[11px] mt-2.5">Free 14-day trial · Quotes sync to your dashboard</p>
      </div>
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3 text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all" />
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════
// QUOTE HISTORY PANEL
// ═════════════════════════════════════════════════════════════════

function QuoteHistory({ quotes, onDelete }: { quotes: SavedQuote[]; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  if (quotes.length === 0) return null

  const visible = expanded ? quotes : quotes.slice(0, 3)

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <CardHeader icon={<HistoryIcon />} title={`Saved Quotes (${quotes.length})`} />
      </div>
      <div className="space-y-2">
        {visible.map((q) => (
          <div key={q.id} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3 group">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white/70 truncate">{q.customerName || 'Untitled quote'}</p>
              <p className="text-[11px] text-white/30">{q.address ? `${q.address} · ` : ''}{JOB_TYPE_LABELS[q.jobType]} · {new Date(q.date).toLocaleDateString()}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold tabular-nums text-white/80">${fmt(q.quotePrice)}</p>
              <p className={`text-[11px] font-medium tabular-nums ${q.margin >= 50 ? 'text-orange-400' : q.margin >= 30 ? 'text-amber-400' : 'text-red-400'}`}>{q.margin.toFixed(0)}% margin</p>
            </div>
            <button onClick={() => onDelete(q.id)} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-1 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        ))}
      </div>
      {quotes.length > 3 && (
        <button onClick={() => setExpanded(!expanded)} className="w-full mt-3 text-xs text-white/30 hover:text-white/50 transition">
          {expanded ? 'Show less' : `Show all ${quotes.length} quotes`}
        </button>
      )}
      <div className="mt-4 pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5 text-[12px] text-white/25">
          <svg className="w-3.5 h-3.5 text-orange-500/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Quotes saved locally on this device. <Link href="/sign-up?redirect_url=/app&utm_source=pricing-calculator" className="text-orange-400/60 hover:text-orange-400 transition">Sync everywhere with dyia →</Link>
        </div>
      </div>
    </Card>
  )
}


// ═════════════════════════════════════════════════════════════════
// COST BREAKDOWN BAR
// ═════════════════════════════════════════════════════════════════

function CostBreakdown({ costs }: { costs: { label: string; value: number; color: string }[] }) {
  const total = costs.reduce((s, c) => s + c.value, 0)
  if (total === 0) return null
  const items = costs.filter(c => c.value > 0)

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/25 mb-2.5">Cost Breakdown</p>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {items.map((c) => (
          <div key={c.label} className={`${c.color} transition-all duration-500`} style={{ width: `${(c.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {items.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 text-[11px] text-white/40">
            <div className={`w-2 h-2 rounded-full ${c.color}`} />
            {c.label} <span className="text-white/60 font-medium">${fmt(c.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


// ═════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════

export default function PricingCalculatorPage() {
  const [licensed, setLicensed] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([])
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
    setMounted(true)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
    setLicensed(!!localStorage.getItem(LICENSE_STORAGE_KEY))
    try {
      const raw = localStorage.getItem(QUOTES_STORAGE_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
      if (raw) setSavedQuotes(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const [jobType, setJobType] = useState<JobType>('volume')
  const [jobNotes, setJobNotes] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [jobAddress, setJobAddress] = useState('')
  const [estimatedHours, setEstimatedHours] = useState(0)

  const [loadSize, setLoadSize] = useState('half')
  const [loadPrice, setLoadPrice] = useState(0)
  const [numLoads, setNumLoads] = useState(2)
  const [pricePerLoad, setPricePerLoad] = useState(0)
  const [loadDiscount, setLoadDiscount] = useState(0)
  const [specialtyType, setSpecialtyType] = useState('hottub')
  const [specialtyPrice, setSpecialtyPrice] = useState(0)
  const [mixedSpecialtyType, setMixedSpecialtyType] = useState('hottub')
  const [mixedSpecialtyPrice, setMixedSpecialtyPrice] = useState(0)
  const [mixedLoadSize, setMixedLoadSize] = useState('quarter')
  const [mixedLoadPrice, setMixedLoadPrice] = useState(0)

  const [applyStairs, setApplyStairs] = useState(false)
  const [stairsCharge, setStairsCharge] = useState(0)
  const [applyDisassembly, setApplyDisassembly] = useState(false)
  const [disassemblyCharge, setDisassemblyCharge] = useState(0)
  const [applyExtraLabor, setApplyExtraLabor] = useState(false)
  const [extraLaborCharge, setExtraLaborCharge] = useState(0)
  const [applyDemolition, setApplyDemolition] = useState(false)
  const [demolitionCharge, setDemolitionCharge] = useState(0)

  const [costLandfill, setCostLandfill] = useState(0)
  const [costDumpster, setCostDumpster] = useState(0)
  const [costDemoMachine, setCostDemoMachine] = useState(0)
  const [costTruckRental, setCostTruckRental] = useState(0)
  const [costFuel, setCostFuel] = useState(0)
  const [costLabor, setCostLabor] = useState(0)
  const [taxRate, setTaxRate] = useState(0)

  const calc = useMemo(() => {
    let basePrice = 0
    if (jobType === 'volume') basePrice = loadPrice
    else if (jobType === 'multipleLoads') { const s = numLoads * pricePerLoad; basePrice = s - s * (loadDiscount / 100) }
    else if (jobType === 'specialty') basePrice = specialtyPrice
    else if (jobType === 'mixed') basePrice = mixedSpecialtyPrice + mixedLoadPrice

    let subtotal = basePrice
    if (applyStairs) subtotal += stairsCharge
    if (applyDisassembly) subtotal += disassemblyCharge
    if (applyExtraLabor) subtotal += extraLaborCharge
    if (applyDemolition) subtotal += demolitionCharge

    const taxAmount = taxRate > 0 ? subtotal * (taxRate / 100) : 0
    const totalQuotePrice = subtotal + taxAmount

    const totalCost = costLandfill + costDumpster + costDemoMachine + costTruckRental + costFuel + costLabor
    const profit = subtotal - totalCost
    const margin = subtotal > 0 ? (profit / subtotal) * 100 : 0
    const hourlyRate = estimatedHours > 0 ? profit / estimatedHours : 0
    const breakeven = totalCost

    let recommendLow = 'Enter costs'; let recommendMed = 'Enter costs'; let recommendHigh = 'Enter costs'
    if (totalCost > 0) {
      recommendLow = `$${Math.ceil(totalCost / 0.80)} – $${Math.ceil(totalCost / 0.70)}`
      recommendMed = `$${Math.ceil(totalCost / 0.69)} – $${Math.ceil(totalCost / 0.51)}`
      recommendHigh = `$${Math.ceil(totalCost / 0.50)} – $${Math.ceil(totalCost / 0.35)}`
    }
    const multiLoadTotal = jobType === 'multipleLoads' ? numLoads * pricePerLoad - (numLoads * pricePerLoad * loadDiscount / 100) : 0

    return { subtotal, totalQuotePrice, totalCost, profit, margin, hourlyRate, breakeven, taxAmount, recommendLow, recommendMed, recommendHigh, multiLoadTotal }
  }, [jobType, loadPrice, numLoads, pricePerLoad, loadDiscount, specialtyPrice, mixedSpecialtyPrice, mixedLoadPrice,
    applyStairs, stairsCharge, applyDisassembly, disassemblyCharge, applyExtraLabor, extraLaborCharge, applyDemolition, demolitionCharge,
    costLandfill, costDumpster, costDemoMachine, costTruckRental, costFuel, costLabor, estimatedHours, taxRate])

  const { margin, subtotal, totalQuotePrice, totalCost, profit, hourlyRate, breakeven, taxAmount } = calc
  const hasInput = totalQuotePrice > 0 || totalCost > 0

  const marginColor = margin >= 50 ? 'text-orange-400' : margin >= 30 ? 'text-amber-400' : 'text-red-400'
  const marginBarGrad = margin >= 50 ? 'from-orange-500 to-amber-400' : margin >= 30 ? 'from-amber-400 to-yellow-400' : 'from-red-500 to-red-400'
  const marginStatus = margin >= 50
    ? { text: 'Excellent — target profit zone.', icon: '✓', style: 'bg-orange-500/10 border-orange-500/30 text-orange-300' }
    : margin >= 30 ? { text: 'Moderate margin. Push to 50%+.', icon: '⚠', style: 'bg-amber-500/10 border-amber-500/30 text-amber-300' }
    : margin > 0 ? { text: 'Low margin — raise your price.', icon: '⚠', style: 'bg-red-500/10 border-red-500/30 text-red-300' }
    : margin < 0 ? { text: 'Losing money on this job.', icon: '🚨', style: 'bg-red-500/20 border-red-500/50 text-red-300' }
    : { text: 'Enter quote & costs to see margin.', icon: '→', style: 'bg-white/5 border-white/10 text-white/50' }

  const costItems = [
    { label: 'Landfill', value: costLandfill, color: 'bg-red-400' },
    { label: 'Dumpster', value: costDumpster, color: 'bg-pink-400' },
    { label: 'Equipment', value: costDemoMachine, color: 'bg-purple-400' },
    { label: 'Truck', value: costTruckRental, color: 'bg-blue-400' },
    { label: 'Fuel', value: costFuel, color: 'bg-cyan-400' },
    { label: 'Labor', value: costLabor, color: 'bg-amber-400' },
  ]

  const clearAll = useCallback(() => {
    setJobType('volume'); setJobNotes(''); setCustomerName(''); setJobAddress(''); setEstimatedHours(0)
    setLoadSize('half'); setLoadPrice(0); setNumLoads(2); setPricePerLoad(0); setLoadDiscount(0)
    setSpecialtyType('hottub'); setSpecialtyPrice(0); setMixedSpecialtyType('hottub'); setMixedSpecialtyPrice(0)
    setMixedLoadSize('quarter'); setMixedLoadPrice(0)
    setApplyStairs(false); setStairsCharge(0); setApplyDisassembly(false); setDisassemblyCharge(0)
    setApplyExtraLabor(false); setExtraLaborCharge(0); setApplyDemolition(false); setDemolitionCharge(0)
    setCostLandfill(0); setCostDumpster(0); setCostDemoMachine(0); setCostTruckRental(0); setCostFuel(0); setCostLabor(0); setTaxRate(0)
  }, [])

  const saveQuoteLocally = useCallback((name: string, address: string) => {
    const quote: SavedQuote = {
      id: Date.now().toString(), date: new Date().toISOString(), jobType,
      customerName: name || customerName, address: address || jobAddress,
      quotePrice: totalQuotePrice, totalCost, profit, margin,
    }
    const updated = [quote, ...savedQuotes].slice(0, 50)
    setSavedQuotes(updated)
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(updated))
  }, [jobType, customerName, jobAddress, totalQuotePrice, totalCost, profit, margin, savedQuotes])

  const deleteQuote = useCallback((id: string) => {
    const updated = savedQuotes.filter(q => q.id !== id)
    setSavedQuotes(updated)
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(updated))
  }, [savedQuotes])

  if (licensed === null) return <div className="min-h-[60vh] flex items-center justify-center"><div className="loading-spinner" /></div>
  if (!licensed) return <LicenseGate onUnlock={() => setLicensed(true)} />

  return (
    <div className="max-w-[1400px] mx-auto">
      {showSaveModal && <SaveQuoteModal onClose={() => setShowSaveModal(false)} onSaveLocal={saveQuoteLocally} quotePrice={totalQuotePrice} profit={profit} margin={margin} />}

      {/* Header */}
      <div className={`text-center mb-8 sm:mb-10 transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-[13px] font-medium mb-5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
          Upgraded calculator &middot; Powered by dyia
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 tracking-tight font-space-grotesk leading-tight">
          Know your{' '}<span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradientShift_6s_ease-in-out_infinite]">real profit.</span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
          The calculator you know — rebuilt with live margins, hourly rates, and quote saving.
        </p>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

        {/* Left: Inputs */}
        <div className={`space-y-5 transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>

          {/* Job details card */}
          <Card>
            <CardHeader icon={<ClipboardIcon />} title="Job Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <FormGroup label="Customer name (optional)"><TextInput value={customerName} onChange={setCustomerName} placeholder="e.g. John Smith" /></FormGroup>
              <FormGroup label="Job address (optional)"><TextInput value={jobAddress} onChange={setJobAddress} placeholder="123 Main St" /></FormGroup>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SectionLabel>Job Type</SectionLabel>
                <Select value={jobType} onChange={(e) => setJobType(e.target.value as JobType)}>
                  <option value="volume">Volume-Based (by truck load)</option>
                  <option value="multipleLoads">Multiple Full Loads</option>
                  <option value="specialty">Specialty Item Removal</option>
                  <option value="mixed">Mixed (Specialty + Volume)</option>
                </Select>
              </div>
              <FormGroup label="Estimated hours on-site" hint="Used to calculate your $/hr">
                <NumberInput value={estimatedHours} onChange={setEstimatedHours} placeholder="e.g. 2" />
              </FormGroup>
            </div>

            {/* Volume */}
            {jobType === 'volume' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-fade-in">
                <FormGroup label="Load Size"><Select value={loadSize} onChange={(e) => setLoadSize(e.target.value)}>
                  <option value="minimum">Minimum Pickup (1-2 items)</option><option value="quarter">1/4 Load</option>
                  <option value="half">1/2 Load</option><option value="three-quarter">3/4 Load</option><option value="full">Full Load</option>
                </Select></FormGroup>
                <FormGroup label="Your Price ($)"><NumberInput value={loadPrice} onChange={setLoadPrice} /></FormGroup>
              </div>
            )}

            {/* Multiple Loads */}
            {jobType === 'multipleLoads' && (
              <div className="space-y-4 mt-4 animate-fade-in">
                <div className="grid grid-cols-3 gap-3">
                  <FormGroup label="# of Loads"><NumberInput value={numLoads} onChange={setNumLoads} min={1} /></FormGroup>
                  <FormGroup label="Price/Load ($)"><NumberInput value={pricePerLoad} onChange={setPricePerLoad} /></FormGroup>
                  <FormGroup label="Discount (%)"><NumberInput value={loadDiscount} onChange={setLoadDiscount} max={100} /></FormGroup>
                </div>
                <SummaryBox rows={[
                  { label: `${numLoads} loads × $${pricePerLoad}`, value: `$${fmt(numLoads * pricePerLoad)}` },
                  ...(loadDiscount > 0 ? [{ label: `${loadDiscount}% discount`, value: `-$${fmt(numLoads * pricePerLoad * loadDiscount / 100)}` }] : []),
                  { label: 'Total Quote', value: `$${fmt(calc.multiLoadTotal)}`, highlight: true },
                ]} />
              </div>
            )}

            {/* Specialty */}
            {jobType === 'specialty' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 animate-fade-in">
                <FormGroup label="Specialty Item"><Select value={specialtyType} onChange={(e) => setSpecialtyType(e.target.value)}>
                  <option value="hottub">Hot Tub Removal</option><option value="trampoline">Trampoline</option>
                  <option value="playset">Play Set</option><option value="shed">Shed/Demo</option>
                  <option value="pool">Above Ground Pool</option><option value="piano">Piano</option><option value="custom">Custom Item</option>
                </Select></FormGroup>
                <FormGroup label="Your Price ($)"><NumberInput value={specialtyPrice} onChange={setSpecialtyPrice} /></FormGroup>
              </div>
            )}

            {/* Mixed */}
            {jobType === 'mixed' && (
              <div className="space-y-4 mt-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Specialty Item"><Select value={mixedSpecialtyType} onChange={(e) => setMixedSpecialtyType(e.target.value)}>
                    <option value="hottub">Hot Tub</option><option value="trampoline">Trampoline</option><option value="playset">Play Set</option>
                    <option value="shed">Shed/Demo</option><option value="pool">Pool</option><option value="piano">Piano</option><option value="custom">Custom</option>
                  </Select></FormGroup>
                  <FormGroup label="Specialty Price ($)"><NumberInput value={mixedSpecialtyPrice} onChange={setMixedSpecialtyPrice} /></FormGroup>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormGroup label="Additional Load Size"><Select value={mixedLoadSize} onChange={(e) => setMixedLoadSize(e.target.value)}>
                    <option value="none">None</option><option value="minimum">Minimum</option><option value="quarter">1/4 Load</option>
                    <option value="half">1/2 Load</option><option value="three-quarter">3/4 Load</option><option value="full">Full Load</option>
                  </Select></FormGroup>
                  <FormGroup label="Additional Price ($)"><NumberInput value={mixedLoadPrice} onChange={setMixedLoadPrice} /></FormGroup>
                </div>
              </div>
            )}

            {/* Complexity */}
            <div className="mt-6">
              <SectionLabel>Surcharges</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <ComplexityToggle label="Stairs" checked={applyStairs} onToggle={setApplyStairs} charge={stairsCharge} onChargeChange={setStairsCharge} />
                <ComplexityToggle label="Disassembly" checked={applyDisassembly} onToggle={setApplyDisassembly} charge={disassemblyCharge} onChargeChange={setDisassemblyCharge} />
                <ComplexityToggle label="Heavy Items" checked={applyExtraLabor} onToggle={setApplyExtraLabor} charge={extraLaborCharge} onChargeChange={setExtraLaborCharge} />
                <ComplexityToggle label="Demolition" checked={applyDemolition} onToggle={setApplyDemolition} charge={demolitionCharge} onChargeChange={setDemolitionCharge} />
              </div>
            </div>

            {/* Job notes */}
            <div className="mt-5">
              <FormGroup label="Job notes (optional)">
                <textarea value={jobNotes} onChange={(e) => setJobNotes(e.target.value)} placeholder="Describe the job, special instructions, access notes..."
                  rows={2} className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3 text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all resize-none" />
              </FormGroup>
            </div>
          </Card>

          {/* Costs card */}
          <Card>
            <CardHeader icon={<DollarIcon />} title="Your Costs" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormGroup label="Landfill / Dump ($)" hint="0 if donating"><NumberInput value={costLandfill} onChange={setCostLandfill} /></FormGroup>
              <FormGroup label="Dumpster Rental ($)"><NumberInput value={costDumpster} onChange={setCostDumpster} /></FormGroup>
              <FormGroup label="Equipment Rental ($)" hint="Excavator, bobcat, etc."><NumberInput value={costDemoMachine} onChange={setCostDemoMachine} /></FormGroup>
              <FormGroup label="Truck Rental ($)"><NumberInput value={costTruckRental} onChange={setCostTruckRental} /></FormGroup>
              <FormGroup label="Fuel ($)"><NumberInput value={costFuel} onChange={setCostFuel} /></FormGroup>
              <FormGroup label="Labor / Wages ($)" hint="Rate × hours × workers"><NumberInput value={costLabor} onChange={setCostLabor} /></FormGroup>
            </div>

            <CostBreakdown costs={costItems} />

            {/* Tax rate */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/70">Add tax to quote</p>
                  <p className="text-[11px] text-white/30">Optional — adds sales tax on top of your price</p>
                </div>
                <div className="w-24">
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={taxRate || ''}
                      onChange={(e) => setTaxRate(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                      min={0}
                      max={100}
                      placeholder="30"
                      className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-3 py-2.5 text-sm text-right pr-8 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={clearAll} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm font-medium hover:border-white/20 hover:text-white/60 transition-all">Clear all</button>
              <button onClick={() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="flex-1 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 text-sm font-semibold hover:bg-orange-500/20 transition-all lg:hidden">See results ↓</button>
            </div>
          </Card>

          {/* Quote history */}
          <QuoteHistory quotes={savedQuotes} onDelete={deleteQuote} />

          {/* Pro tips */}
          <Card>
            <CardHeader icon={<LightbulbIcon />} title="Pro Tips" />
            <div className="space-y-4 text-sm text-white/60 leading-relaxed">
              <div className="rounded-xl bg-orange-500/5 border border-orange-500/10 p-4">
                <p className="text-orange-400 font-semibold text-xs uppercase tracking-wider mb-2">Debris Type = Profit</p>
                <p><strong className="text-orange-300">Higher Price:</strong> Wood, construction, concrete → landfill fees</p>
                <p className="mt-1"><strong className="text-amber-300">Lower Price:</strong> Furniture, appliances → donate (no fees)</p>
              </div>
              <ul className="space-y-2 pl-1">
                <li className="flex gap-2"><span className="text-orange-500 mt-px">•</span>Always quote a range — confirm on-site</li>
                <li className="flex gap-2"><span className="text-orange-500 mt-px">•</span>Track your real costs weekly</li>
                <li className="flex gap-2"><span className="text-orange-500 mt-px">•</span>Offer 10-15% multi-load discounts to close bigger jobs</li>
              </ul>
            </div>
          </Card>
        </div>

        {/* Right: Results (sticky) */}
        <div ref={resultsRef} className="lg:sticky lg:top-24 space-y-5">

          {/* Margin card */}
          <div className={`rounded-2xl border overflow-hidden transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} ${hasInput ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-white/[0.02] border-white/[0.06]'}`}>
            <div className="relative px-6 pt-6 pb-5 text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.04] to-transparent" />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">Gross Profit Margin</p>
                <div className={`text-5xl sm:text-6xl font-bold font-space-grotesk tabular-nums transition-colors duration-300 ${marginColor}`}>{margin.toFixed(1)}%</div>
              </div>
            </div>

            <div className="px-6 pb-2">
              <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${marginBarGrad} transition-all duration-500 ease-out`} style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-white/25 mt-1.5 px-0.5"><span>0%</span><span>30%</span><span>50%</span><span>100%</span></div>
            </div>

            <div className="px-6 pb-4">
              <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${marginStatus.style}`}><span className="mr-1.5">{marginStatus.icon}</span>{marginStatus.text}</div>
            </div>

            {/* Breakdown */}
            <div className="border-t border-white/[0.06] px-6 py-4 space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-white/40">Subtotal</span><span className="font-medium text-white/80 tabular-nums">${fmt(subtotal)}</span></div>
              {taxRate > 0 && (
                <div className="flex justify-between text-white/40">
                  <span>Tax ({taxRate}%)</span>
                  <span className="tabular-nums">+${fmt(taxAmount)}</span>
                </div>
              )}
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-white/50 font-medium">Customer pays</span>
                  <span className="font-semibold text-white/90 tabular-nums">${fmt(totalQuotePrice)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-white/40">Your costs</span><span className="font-medium text-red-400/80 tabular-nums">${fmt(totalCost)}</span></div>
              <div className="flex justify-between pt-2.5 border-t border-white/[0.06]">
                <span className="text-white/50 font-medium">Your profit</span>
                <span className={`font-bold text-lg tabular-nums ${profit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>${fmt(profit)}</span>
              </div>
            </div>

            {/* Hourly rate + breakeven */}
            {hasInput && (
              <div className="border-t border-white/[0.06] px-6 py-4 grid grid-cols-2 gap-4 animate-fade-in">
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold mb-1">$/Hour</p>
                  <p className={`text-xl font-bold tabular-nums font-space-grotesk ${estimatedHours > 0 ? (hourlyRate >= 75 ? 'text-orange-400' : hourlyRate >= 40 ? 'text-amber-400' : 'text-red-400') : 'text-white/20'}`}>
                    {estimatedHours > 0 ? `$${fmt(hourlyRate)}` : '—'}
                  </p>
                  {estimatedHours <= 0 && <p className="text-[10px] text-white/20 mt-0.5">Add hours above</p>}
                </div>
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold mb-1">Breakeven Price</p>
                  <p className="text-xl font-bold tabular-nums font-space-grotesk text-white/60">${fmt(breakeven)}</p>
                  <p className="text-[10px] text-white/20 mt-0.5">Min. to cover costs</p>
                </div>
              </div>
            )}

            {/* Save CTA */}
            {hasInput && (
              <div className="border-t border-white/[0.06] px-6 py-4 animate-fade-in">
                <button onClick={() => setShowSaveModal(true)} className="group flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  Save this quote
                </button>
                <p className="text-center text-white/25 text-xs mt-2">Save locally or to your dyia pipeline</p>
              </div>
            )}
          </div>

          {/* Recommended pricing */}
          <Card>
            <CardHeader icon={<TargetIcon />} title="Recommended Pricing" />
            <div className="space-y-2.5">
              <RecommendRow label="20–30%" sublabel="Minimum viable" value={calc.recommendLow} variant="red" />
              <RecommendRow label="31–49%" sublabel="Moderate profit" value={calc.recommendMed} variant="amber" />
              <RecommendRow label="50–65%" sublabel="Target zone" value={calc.recommendHigh} variant="orange" />
            </div>
          </Card>

          {/* National averages */}
          <Card>
            <CardHeader icon={<ChartIcon />} title="National Averages (USA)" />
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2.5 text-white/50 font-medium text-xs uppercase tracking-wider">Load</th>
                  <th className="text-right px-4 py-2.5 text-white/50 font-medium text-xs uppercase tracking-wider">Range</th>
                </tr></thead>
                <tbody>{NATIONAL_AVERAGES.map((r) => (
                  <tr key={r.size} className="border-b border-white/[0.04] last:border-b-0">
                    <td className="px-4 py-2.5 text-white/60">{r.size}</td>
                    <td className="px-4 py-2.5 text-right text-orange-400 font-semibold">{r.range}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </Card>

          {/* Upgrade nudge */}
          <div className="rounded-2xl border border-orange-500/15 bg-gradient-to-b from-orange-500/[0.06] to-transparent p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0"><span className="text-white font-black text-sm">d</span></div>
              <div><p className="text-white font-semibold text-sm">This calculator is just the start.</p><p className="text-white/40 text-xs mt-0.5">dyia is the full platform built for service businesses like yours.</p></div>
            </div>
            <div className="space-y-2 text-[13px] text-white/50 mb-5">
              {['Send professional PDF quotes to customers', 'Track every job, expense, and dollar earned', 'AI assistant that knows your business', 'Follow-up manager so no lead goes cold'].map((t) => (
                <div key={t} className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-orange-500/70 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>{t}</div>
              ))}
            </div>
            <Link href="/sign-up?redirect_url=/app&utm_source=pricing-calculator" className="group flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-orange-500/25 text-orange-400 text-sm font-semibold hover:bg-orange-500/10 transition-all">
              Try the full platform — 14 days free
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-12 sm:mt-16 py-6 border-t border-white/[0.04]">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/25">
          <Link href="/" className="hover:text-white/50 transition">dyia.io</Link>
          <Link href="/profit-calculator" className="hover:text-white/50 transition">Profit Quiz</Link>
          <Link href="/#features" className="hover:text-white/50 transition">Features</Link>
          <Link href="/#pricing" className="hover:text-white/50 transition">Pricing</Link>
          <Link href="/support" className="hover:text-white/50 transition">Support</Link>
        </div>
        <p className="text-white/15 text-[11px] mt-3">Part of the dyia ecosystem — your day, decoded.</p>
      </div>

      {/* Mobile floating bar */}
      {hasInput && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden animate-slide-up">
          <div className="bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3">
                <span className={`text-2xl font-bold font-space-grotesk tabular-nums ${marginColor}`}>{margin.toFixed(1)}%</span>
                <div className="text-xs text-white/40 leading-tight">
                  <p>${subtotal.toFixed(0)}{taxRate > 0 ? ` + ${taxRate}% tax` : ' rev'}{estimatedHours > 0 && <span className="text-white/30"> · ${hourlyRate.toFixed(0)}/hr</span>}</p>
                  <p className={profit >= 0 ? 'text-orange-400/70' : 'text-red-400/70'}>${profit.toFixed(0)} profit</p>
                </div>
              </div>
              <button onClick={() => setShowSaveModal(true)} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/25 whitespace-nowrap">Save quote →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Sub-components ──────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 sm:p-6">{children}</div>
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <h2 className="text-base font-semibold mb-4 flex items-center gap-2.5 font-space-grotesk text-white/90">{icon}{title}</h2>
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400/70 mb-2.5 mt-1">{children}</p>
}

function FormGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-medium text-white/70 mb-1.5">{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}</div>
}

function Select({ value, onChange, children }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return <select value={value} onChange={onChange} className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all appearance-none cursor-pointer"
    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.75rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}>{children}</select>
}

function NumberInput({ value, onChange, min = 0, max, placeholder = '0' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; placeholder?: string }) {
  return <input type="number" inputMode="decimal" value={value || ''} onChange={(e) => onChange(Number(e.target.value) || 0)} min={min} max={max} placeholder={placeholder}
    className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3 text-sm placeholder:text-white/20 focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all" />
}

function SummaryBox({ rows }: { rows: { label: string; value: string; highlight?: boolean }[] }) {
  return <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-sm space-y-2">
    {rows.map((r, i) => <div key={i} className={`flex justify-between ${r.highlight ? 'border-t border-white/[0.06] pt-2 mt-1' : ''}`}>
      <span className="text-white/40">{r.label}</span><span className={r.highlight ? 'font-semibold text-orange-400' : 'font-medium text-white/70'}>{r.value}</span>
    </div>)}
  </div>
}

function ComplexityToggle({ label, checked, onToggle, charge, onChargeChange }: { label: string; checked: boolean; onToggle: (v: boolean) => void; charge: number; onChargeChange: (v: number) => void }) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${checked ? 'bg-orange-500/[0.04] border-orange-500/15' : 'bg-white/[0.02] border-white/[0.06]'}`}>
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="w-4 h-4 rounded accent-orange-500 cursor-pointer" />
        <span className={`text-sm font-medium ${checked ? 'text-white/80' : 'text-white/50'}`}>{label}</span>
      </label>
      {checked && <div className="mt-2.5 pl-6.5 animate-fade-in"><NumberInput value={charge} onChange={onChargeChange} placeholder="$ charge" /></div>}
    </div>
  )
}

function RecommendRow({ label, sublabel, value, variant }: { label: string; sublabel: string; value: string; variant: 'red' | 'amber' | 'orange' }) {
  const dot = variant === 'orange' ? 'bg-orange-500' : variant === 'amber' ? 'bg-amber-400' : 'bg-red-400'
  const border = variant === 'orange' ? 'border-orange-500/15' : variant === 'amber' ? 'border-amber-400/15' : 'border-red-400/15'
  return <div className={`flex items-center justify-between rounded-xl bg-white/[0.02] border ${border} px-4 py-3`}>
    <div className="flex items-center gap-2.5"><div className={`w-2 h-2 rounded-full ${dot}`} /><div><p className="text-sm font-medium text-white/70">{label}</p><p className="text-[11px] text-white/30">{sublabel}</p></div></div>
    <span className="text-sm font-bold text-orange-400 tabular-nums">{value}</span>
  </div>
}


// ─── Icons ───────────────────────────────────────────────────────

function ClipboardIcon() { return <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> }
function DollarIcon() { return <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
function LightbulbIcon() { return <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> }
function TargetIcon() { return <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg> }
function ChartIcon() { return <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> }
function HistoryIcon() { return <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> }
