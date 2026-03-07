'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'

type JobType = 'volume' | 'multipleLoads' | 'specialty' | 'mixed'

const NATIONAL_AVERAGES = [
  { size: 'Minimum Pickup', range: '$75 - $150' },
  { size: '1/4 Load', range: '$150 - $250' },
  { size: '1/2 Load', range: '$250 - $450' },
  { size: '3/4 Load', range: '$400 - $600' },
  { size: 'Full Load', range: '$550 - $850' },
]

export default function PricingCalculatorPage() {
  const [jobType, setJobType] = useState<JobType>('volume')
  const [mounted, setMounted] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
    setMounted(true)
  }, [])

  // Volume
  const [loadSize, setLoadSize] = useState('half')
  const [loadPrice, setLoadPrice] = useState(0)

  // Multiple loads
  const [numLoads, setNumLoads] = useState(2)
  const [pricePerLoad, setPricePerLoad] = useState(0)
  const [loadDiscount, setLoadDiscount] = useState(0)

  // Specialty
  const [specialtyType, setSpecialtyType] = useState('hottub')
  const [specialtyPrice, setSpecialtyPrice] = useState(0)

  // Mixed
  const [mixedSpecialtyType, setMixedSpecialtyType] = useState('hottub')
  const [mixedSpecialtyPrice, setMixedSpecialtyPrice] = useState(0)
  const [mixedLoadSize, setMixedLoadSize] = useState('quarter')
  const [mixedLoadPrice, setMixedLoadPrice] = useState(0)

  // Complexity
  const [applyStairs, setApplyStairs] = useState(false)
  const [stairsCharge, setStairsCharge] = useState(0)
  const [applyDisassembly, setApplyDisassembly] = useState(false)
  const [disassemblyCharge, setDisassemblyCharge] = useState(0)
  const [applyExtraLabor, setApplyExtraLabor] = useState(false)
  const [extraLaborCharge, setExtraLaborCharge] = useState(0)
  const [applyDemolition, setApplyDemolition] = useState(false)
  const [demolitionCharge, setDemolitionCharge] = useState(0)

  // Costs
  const [costLandfill, setCostLandfill] = useState(0)
  const [costDumpster, setCostDumpster] = useState(0)
  const [costDemoMachine, setCostDemoMachine] = useState(0)
  const [costTruckRental, setCostTruckRental] = useState(0)
  const [costFuel, setCostFuel] = useState(0)
  const [costLabor, setCostLabor] = useState(0)

  const calculations = useMemo(() => {
    let basePrice = 0
    if (jobType === 'volume') {
      basePrice = loadPrice
    } else if (jobType === 'multipleLoads') {
      const subtotal = numLoads * pricePerLoad
      basePrice = subtotal - subtotal * (loadDiscount / 100)
    } else if (jobType === 'specialty') {
      basePrice = specialtyPrice
    } else if (jobType === 'mixed') {
      basePrice = mixedSpecialtyPrice + mixedLoadPrice
    }

    let totalQuotePrice = basePrice
    if (applyStairs) totalQuotePrice += stairsCharge
    if (applyDisassembly) totalQuotePrice += disassemblyCharge
    if (applyExtraLabor) totalQuotePrice += extraLaborCharge
    if (applyDemolition) totalQuotePrice += demolitionCharge

    const totalCost = costLandfill + costDumpster + costDemoMachine + costTruckRental + costFuel + costLabor
    const profit = totalQuotePrice - totalCost
    const margin = totalQuotePrice > 0 ? (profit / totalQuotePrice) * 100 : 0

    let recommendLow = 'Enter costs'
    let recommendMedium = 'Enter costs'
    let recommendHigh = 'Enter costs'
    if (totalCost > 0) {
      recommendLow = `$${Math.ceil(totalCost / 0.80)} – $${Math.ceil(totalCost / 0.70)}`
      recommendMedium = `$${Math.ceil(totalCost / 0.69)} – $${Math.ceil(totalCost / 0.51)}`
      recommendHigh = `$${Math.ceil(totalCost / 0.50)} – $${Math.ceil(totalCost / 0.35)}`
    }

    const multiLoadTotal = jobType === 'multipleLoads'
      ? numLoads * pricePerLoad - (numLoads * pricePerLoad * loadDiscount / 100)
      : 0

    return { totalQuotePrice, totalCost, profit, margin, recommendLow, recommendMedium, recommendHigh, multiLoadTotal }
  }, [
    jobType, loadPrice, numLoads, pricePerLoad, loadDiscount,
    specialtyPrice, mixedSpecialtyPrice, mixedLoadPrice,
    applyStairs, stairsCharge, applyDisassembly, disassemblyCharge,
    applyExtraLabor, extraLaborCharge, applyDemolition, demolitionCharge,
    costLandfill, costDumpster, costDemoMachine, costTruckRental, costFuel, costLabor,
  ])

  const { margin, totalQuotePrice, totalCost, profit } = calculations
  const hasInput = totalQuotePrice > 0 || totalCost > 0

  const marginColor = margin >= 50 ? 'text-orange-400' : margin >= 30 ? 'text-amber-400' : 'text-red-400'
  const marginBarGradient = margin >= 50
    ? 'from-orange-500 to-amber-400'
    : margin >= 30
      ? 'from-amber-400 to-yellow-400'
      : 'from-red-500 to-red-400'

  const marginStatus = margin >= 50
    ? { text: 'Excellent — you\'re in the target profit zone.', icon: '✓', style: 'bg-orange-500/10 border-orange-500/30 text-orange-300' }
    : margin >= 30
      ? { text: 'Moderate margin. Push to 50%+ for healthy growth.', icon: '⚠', style: 'bg-amber-500/10 border-amber-500/30 text-amber-300' }
      : margin > 0
        ? { text: 'Low margin — increase prices to stay profitable.', icon: '⚠', style: 'bg-red-500/10 border-red-500/30 text-red-300' }
        : margin < 0
          ? { text: 'You\'re losing money on this job.', icon: '🚨', style: 'bg-red-500/20 border-red-500/50 text-red-300' }
          : { text: 'Enter your quote and costs to see your margin.', icon: '→', style: 'bg-white/5 border-white/10 text-white/50' }

  const clearAll = useCallback(() => {
    setJobType('volume')
    setLoadSize('half')
    setLoadPrice(0)
    setNumLoads(2)
    setPricePerLoad(0)
    setLoadDiscount(0)
    setSpecialtyType('hottub')
    setSpecialtyPrice(0)
    setMixedSpecialtyType('hottub')
    setMixedSpecialtyPrice(0)
    setMixedLoadSize('quarter')
    setMixedLoadPrice(0)
    setApplyStairs(false)
    setStairsCharge(0)
    setApplyDisassembly(false)
    setDisassemblyCharge(0)
    setApplyExtraLabor(false)
    setExtraLaborCharge(0)
    setApplyDemolition(false)
    setDemolitionCharge(0)
    setCostLandfill(0)
    setCostDumpster(0)
    setCostDemoMachine(0)
    setCostTruckRental(0)
    setCostFuel(0)
    setCostLabor(0)
  }, [])

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ─── Header ─── */}
      <div className={`text-center mb-8 sm:mb-10 transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-[13px] font-medium mb-5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          Free tool — no account required
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 tracking-tight font-space-grotesk leading-tight">
          Know your{' '}
          <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradientShift_6s_ease-in-out_infinite]">
            real profit.
          </span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
          Quote any junk removal job and see your true margin instantly.
        </p>
      </div>

      {/* ─── Main grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

        {/* ═══ Left: Inputs ═══ */}
        <div className={`space-y-5 transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>

          {/* Quote card */}
          <Card>
            <CardHeader icon={<ClipboardIcon />} title="Quote This Job" />
            <p className="text-white/40 text-sm mb-5">Choose your job type and enter your pricing.</p>

            <SectionLabel>Job Type</SectionLabel>
            <FormGroup label="What are you quoting?">
              <Select value={jobType} onChange={(e) => setJobType(e.target.value as JobType)}>
                <option value="volume">Volume-Based (by truck load)</option>
                <option value="multipleLoads">Multiple Full Loads</option>
                <option value="specialty">Specialty Item Removal</option>
                <option value="mixed">Mixed (Specialty + Volume)</option>
              </Select>
            </FormGroup>

            {/* Volume */}
            {jobType === 'volume' && (
              <div className="space-y-4 mt-4 animate-fade-in">
                <FormGroup label="Load Size">
                  <Select value={loadSize} onChange={(e) => setLoadSize(e.target.value)}>
                    <option value="minimum">Minimum Pickup (1-2 items)</option>
                    <option value="quarter">1/4 Load</option>
                    <option value="half">1/2 Load</option>
                    <option value="three-quarter">3/4 Load</option>
                    <option value="full">Full Load</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Your Price for This Load ($)">
                  <NumberInput value={loadPrice} onChange={setLoadPrice} />
                </FormGroup>
              </div>
            )}

            {/* Multiple Loads */}
            {jobType === 'multipleLoads' && (
              <div className="space-y-4 mt-4 animate-fade-in">
                <Tip>Price large jobs requiring multiple truck trips. Consider offering a per-load discount to close bigger deals.</Tip>
                <FormGroup label="Number of Full Loads" hint="How many full truck loads?">
                  <NumberInput value={numLoads} onChange={setNumLoads} min={1} />
                </FormGroup>
                <FormGroup label="Price Per Load ($)">
                  <NumberInput value={pricePerLoad} onChange={setPricePerLoad} />
                </FormGroup>
                <FormGroup label="Discount Per Load (%) — Optional" hint="E.g., 10% off each load for multi-load jobs">
                  <NumberInput value={loadDiscount} onChange={setLoadDiscount} max={100} />
                </FormGroup>
                <SummaryBox rows={[
                  { label: 'Loads', value: `${numLoads} load${numLoads > 1 ? 's' : ''}` },
                  { label: 'Price/load', value: `$${pricePerLoad}` },
                  { label: 'Discount', value: `${loadDiscount}%` },
                  { label: 'Total Quote', value: `$${calculations.multiLoadTotal.toFixed(2)}`, highlight: true },
                ]} />
              </div>
            )}

            {/* Specialty */}
            {jobType === 'specialty' && (
              <div className="space-y-4 mt-4 animate-fade-in">
                <FormGroup label="Specialty Item Type">
                  <Select value={specialtyType} onChange={(e) => setSpecialtyType(e.target.value)}>
                    <option value="hottub">Hot Tub Removal</option>
                    <option value="trampoline">Trampoline Removal</option>
                    <option value="playset">Play Set Removal</option>
                    <option value="shed">Shed Removal/Demo</option>
                    <option value="pool">Above Ground Pool Removal</option>
                    <option value="piano">Piano Removal</option>
                    <option value="custom">Custom Specialty Item</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Your Price for This Item ($)">
                  <NumberInput value={specialtyPrice} onChange={setSpecialtyPrice} />
                </FormGroup>
                <Tip>Factor in labor hours, equipment needs, disposal fees, and complexity. Hot tubs and pools often need cutting/disassembly.</Tip>
              </div>
            )}

            {/* Mixed */}
            {jobType === 'mixed' && (
              <div className="space-y-4 mt-4 animate-fade-in">
                <Tip>Enter pricing for both the specialty item and additional volume-based junk.</Tip>
                <SectionLabel>Specialty Item</SectionLabel>
                <FormGroup label="Item Type">
                  <Select value={mixedSpecialtyType} onChange={(e) => setMixedSpecialtyType(e.target.value)}>
                    <option value="hottub">Hot Tub</option>
                    <option value="trampoline">Trampoline</option>
                    <option value="playset">Play Set</option>
                    <option value="shed">Shed/Demo</option>
                    <option value="pool">Above Ground Pool</option>
                    <option value="piano">Piano</option>
                    <option value="custom">Custom Item</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Specialty Item Price ($)">
                  <NumberInput value={mixedSpecialtyPrice} onChange={setMixedSpecialtyPrice} />
                </FormGroup>
                <SectionLabel>Additional Volume</SectionLabel>
                <FormGroup label="Additional Load Size">
                  <Select value={mixedLoadSize} onChange={(e) => setMixedLoadSize(e.target.value)}>
                    <option value="none">None</option>
                    <option value="minimum">Minimum (1-2 items)</option>
                    <option value="quarter">1/4 Load</option>
                    <option value="half">1/2 Load</option>
                    <option value="three-quarter">3/4 Load</option>
                    <option value="full">Full Load</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Additional Load Price ($)" hint="Price for the extra junk beyond the specialty item">
                  <NumberInput value={mixedLoadPrice} onChange={setMixedLoadPrice} />
                </FormGroup>
              </div>
            )}

            {/* Complexity */}
            <div className="mt-6">
              <SectionLabel>Job Complexity</SectionLabel>
              <div className="space-y-2.5">
                <ComplexityToggle label="Stairs" checked={applyStairs} onToggle={setApplyStairs} charge={stairsCharge} onChargeChange={setStairsCharge} />
                <ComplexityToggle label="Disassembly" checked={applyDisassembly} onToggle={setApplyDisassembly} charge={disassemblyCharge} onChargeChange={setDisassemblyCharge} />
                <ComplexityToggle label="Heavy Items Surcharge" checked={applyExtraLabor} onToggle={setApplyExtraLabor} charge={extraLaborCharge} onChargeChange={setExtraLaborCharge} />
                <ComplexityToggle label="Demolition Labor Fee" checked={applyDemolition} onToggle={setApplyDemolition} charge={demolitionCharge} onChargeChange={setDemolitionCharge} />
              </div>
            </div>
          </Card>

          {/* Costs card */}
          <Card>
            <CardHeader icon={<DollarIcon />} title="Your Costs" />
            <div className="space-y-4">
              <FormGroup label="Landfill / Dump Fee ($)" hint="Enter 0 if donating/recycling">
                <NumberInput value={costLandfill} onChange={setCostLandfill} />
              </FormGroup>
              <FormGroup label="Dumpster Rental ($)" hint="For large jobs requiring a dumpster">
                <NumberInput value={costDumpster} onChange={setCostDumpster} />
              </FormGroup>
              <FormGroup label="Demo Machine Rental ($)" hint="Excavator, bobcat, etc.">
                <NumberInput value={costDemoMachine} onChange={setCostDemoMachine} />
              </FormGroup>
              <FormGroup label="Truck / U-Haul Rental ($)">
                <NumberInput value={costTruckRental} onChange={setCostTruckRental} />
              </FormGroup>
              <FormGroup label="Fuel Cost ($)">
                <NumberInput value={costFuel} onChange={setCostFuel} />
              </FormGroup>
              <FormGroup label="Labor Cost — Wages Paid ($)" hint="Rate × hours × workers">
                <NumberInput value={costLabor} onChange={setCostLabor} />
              </FormGroup>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={clearAll}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 text-sm font-medium hover:border-white/20 hover:text-white/60 transition-all"
              >
                Clear all
              </button>
              <button
                onClick={scrollToResults}
                className="flex-1 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/25 text-orange-400 text-sm font-semibold hover:bg-orange-500/20 transition-all lg:hidden"
              >
                See results ↓
              </button>
            </div>
          </Card>

          {/* Pro tips — collapsible on mobile */}
          <Card>
            <CardHeader icon={<LightbulbIcon />} title="Pro Tips" />
            <div className="space-y-4 text-sm text-white/60 leading-relaxed">
              <div className="rounded-xl bg-orange-500/5 border border-orange-500/10 p-4">
                <p className="text-orange-400 font-semibold text-xs uppercase tracking-wider mb-2">Debris Type Matters</p>
                <p><strong className="text-orange-300">Higher Price:</strong> Wood, construction debris, concrete → landfill (high dump fees)</p>
                <p className="mt-1"><strong className="text-amber-300">Lower Price:</strong> Furniture, appliances → can be donated (low/no fees)</p>
              </div>
              <ul className="space-y-2.5 pl-1">
                <li className="flex gap-2.5"><span className="text-orange-500 mt-px">•</span>Always quote a price range when calling customers</li>
                <li className="flex gap-2.5"><span className="text-orange-500 mt-px">•</span>Confirm the exact price on-site after seeing the actual load</li>
                <li className="flex gap-2.5"><span className="text-orange-500 mt-px">•</span>Track your real costs weekly to stay profitable</li>
                <li className="flex gap-2.5"><span className="text-orange-500 mt-px">•</span>Donate items when possible — skip landfill fees and keep margins high</li>
              </ul>
            </div>
          </Card>
        </div>

        {/* ═══ Right: Results (sticky on desktop) ═══ */}
        <div ref={resultsRef} className="lg:sticky lg:top-24 space-y-5">

          {/* Margin card */}
          <div className={`rounded-2xl border overflow-hidden transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'} ${hasInput ? 'bg-white/[0.04] border-white/[0.08]' : 'bg-white/[0.02] border-white/[0.06]'}`}>
            {/* Margin hero */}
            <div className="relative px-6 pt-6 pb-5 text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.04] to-transparent" />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">Gross Profit Margin</p>
                <div className={`text-5xl sm:text-6xl font-bold font-space-grotesk tabular-nums transition-colors duration-300 ${marginColor}`}>
                  {margin.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-6 pb-2">
              <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${marginBarGradient} transition-all duration-500 ease-out`}
                  style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-white/25 mt-1.5 px-0.5">
                <span>0%</span><span>30%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* Status message */}
            <div className="px-6 pb-4">
              <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${marginStatus.style}`}>
                <span className="mr-1.5">{marginStatus.icon}</span>{marginStatus.text}
              </div>
            </div>

            {/* Breakdown */}
            <div className="border-t border-white/[0.06] px-6 py-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Revenue</span>
                <span className="font-medium text-white/80">${totalQuotePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Costs</span>
                <span className="font-medium text-red-400/80">${totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-white/[0.06]">
                <span className="text-white/50 font-medium">Profit</span>
                <span className={`font-bold text-lg tabular-nums ${profit >= 0 ? 'text-orange-400' : 'text-red-400'}`}>
                  ${profit.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Save quote CTA — the natural conversion hook */}
            {hasInput && (
              <div className="border-t border-white/[0.06] px-6 py-4 animate-fade-in">
                <Link
                  href="/sign-up?redirect_url=/app"
                  className="group flex items-center justify-center gap-2.5 w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all"
                >
                  Save quote & track this job
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <p className="text-center text-white/25 text-xs mt-2">Free 14-day trial — no card required</p>
              </div>
            )}
          </div>

          {/* Recommended pricing */}
          <Card>
            <CardHeader icon={<TargetIcon />} title="Recommended Pricing" />
            <div className="space-y-2.5">
              <RecommendRow label="20–30% Margin" sublabel="Minimum viable" value={calculations.recommendLow} variant="red" />
              <RecommendRow label="31–49% Margin" sublabel="Moderate profit" value={calculations.recommendMedium} variant="amber" />
              <RecommendRow label="50–65% Margin" sublabel="Target zone" value={calculations.recommendHigh} variant="orange" />
            </div>
          </Card>

          {/* National averages */}
          <Card>
            <CardHeader icon={<ChartIcon />} title="National Averages (USA)" />
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-4 py-2.5 text-white/50 font-medium text-xs uppercase tracking-wider">Load Size</th>
                    <th className="text-right px-4 py-2.5 text-white/50 font-medium text-xs uppercase tracking-wider">Range</th>
                  </tr>
                </thead>
                <tbody>
                  {NATIONAL_AVERAGES.map((row) => (
                    <tr key={row.size} className="border-b border-white/[0.04] last:border-b-0">
                      <td className="px-4 py-2.5 text-white/60">{row.size}</td>
                      <td className="px-4 py-2.5 text-right text-orange-400 font-semibold">{row.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-white/30 leading-relaxed">
              Pricing varies by region. Research 3–5 competitors in your area for local benchmarks.
            </p>
          </Card>

          {/* Upgrade nudge — contextual, not salesy */}
          <div className="rounded-2xl border border-orange-500/15 bg-gradient-to-b from-orange-500/[0.06] to-transparent p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
                <span className="text-white font-black text-sm">d</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">You&apos;re already pricing smarter.</p>
                <p className="text-white/40 text-xs mt-0.5">Take the next step — track every job, customer, and dollar.</p>
              </div>
            </div>
            <div className="space-y-2 text-[13px] text-white/50 mb-5">
              {[
                'Generate professional PDF quotes',
                'AI-powered business insights',
                'Follow-up manager for pending quotes',
                'Real expense & profit tracking',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-orange-500/70 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
            <Link
              href="/sign-up?redirect_url=/app"
              className="group flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-orange-500/25 text-orange-400 text-sm font-semibold hover:bg-orange-500/10 transition-all"
            >
              Try dyia free for 14 days
              <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
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

      {/* ─── Mobile floating margin pill ─── */}
      {hasInput && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden animate-slide-up">
          <div className="bg-[#09090b]/95 backdrop-blur-xl border-t border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-3">
                <span className={`text-2xl font-bold font-space-grotesk tabular-nums ${marginColor}`}>
                  {margin.toFixed(1)}%
                </span>
                <div className="text-xs text-white/40 leading-tight">
                  <p>${totalQuotePrice.toFixed(0)} rev</p>
                  <p className={profit >= 0 ? 'text-orange-400/70' : 'text-red-400/70'}>${profit.toFixed(0)} profit</p>
                </div>
              </div>
              <Link
                href="/sign-up?redirect_url=/app"
                className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/25 whitespace-nowrap"
              >
                Save quote →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Sub-components ──────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 sm:p-6">
      {children}
    </div>
  )
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="text-base font-semibold mb-4 flex items-center gap-2.5 font-space-grotesk text-white/90">
      {icon}
      {title}
    </h2>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400/70 mb-2.5 mt-5">{children}</p>
}

function FormGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/70 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-white/30">{hint}</p>}
    </div>
  )
}

function Select({ value, onChange, children }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all appearance-none cursor-pointer"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.75rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1.5em 1.5em',
      }}
    >
      {children}
    </select>
  )
}

function NumberInput({ value, onChange, min = 0, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      min={min}
      max={max}
      placeholder="0"
      className="w-full bg-white/[0.05] border border-white/10 rounded-xl text-white px-4 py-3 text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-orange-500/[0.06] border-l-[3px] border-orange-500/30 px-4 py-3 text-sm text-white/55 leading-relaxed">
      {children}
    </div>
  )
}

function SummaryBox({ rows }: { rows: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 text-sm space-y-2">
      {rows.map((row, i) => (
        <div key={i} className={`flex justify-between ${row.highlight ? 'border-t border-white/[0.06] pt-2 mt-1' : ''}`}>
          <span className="text-white/40">{row.label}</span>
          <span className={row.highlight ? 'font-semibold text-orange-400' : 'font-medium text-white/70'}>{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function ComplexityToggle({ label, checked, onToggle, charge, onChargeChange }: {
  label: string
  checked: boolean
  onToggle: (v: boolean) => void
  charge: number
  onChargeChange: (v: number) => void
}) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${checked ? 'bg-orange-500/[0.04] border-orange-500/15' : 'bg-white/[0.02] border-white/[0.06]'}`}>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="w-4.5 h-4.5 rounded accent-orange-500 cursor-pointer"
        />
        <span className={`text-sm font-medium ${checked ? 'text-white/80' : 'text-white/50'}`}>{label}</span>
      </label>
      {checked && (
        <div className="mt-3 pl-7.5 animate-fade-in">
          <label className="block text-[11px] text-white/40 mb-1">Additional charge ($)</label>
          <NumberInput value={charge} onChange={onChargeChange} />
        </div>
      )}
    </div>
  )
}

function RecommendRow({ label, sublabel, value, variant }: { label: string; sublabel: string; value: string; variant: 'red' | 'amber' | 'orange' }) {
  const dot = variant === 'orange' ? 'bg-orange-500' : variant === 'amber' ? 'bg-amber-400' : 'bg-red-400'
  const border = variant === 'orange' ? 'border-orange-500/15' : variant === 'amber' ? 'border-amber-400/15' : 'border-red-400/15'
  return (
    <div className={`flex items-center justify-between rounded-xl bg-white/[0.02] border ${border} px-4 py-3`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <div>
          <p className="text-sm font-medium text-white/70">{label}</p>
          <p className="text-[11px] text-white/30">{sublabel}</p>
        </div>
      </div>
      <span className="text-sm font-bold text-orange-400 tabular-nums">{value}</span>
    </div>
  )
}


// ─── Icons ───────────────────────────────────────────────────────

function ClipboardIcon() {
  return (
    <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}

function DollarIcon() {
  return (
    <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function LightbulbIcon() {
  return (
    <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className="w-[18px] h-[18px] text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}
