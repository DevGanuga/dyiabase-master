'use client'

import { useState, useMemo, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'

type JobType = 'volume' | 'multipleLoads' | 'specialty' | 'mixed'

const NATIONAL_AVERAGES = [
  { size: 'Minimum Pickup', range: '$75 – $150' },
  { size: '1/4 Load', range: '$150 – $250' },
  { size: '1/2 Load', range: '$250 – $450' },
  { size: '3/4 Load', range: '$400 – $600' },
  { size: 'Full Load', range: '$550 – $850' },
]

export function ProfitCalculator() {
  const [jobType, setJobType] = useState<JobType>('volume')
  const [estimatedHours, setEstimatedHours] = useState(0)

  const [loadPrice, setLoadPrice] = useState(0)
  const [numLoads, setNumLoads] = useState(2)
  const [pricePerLoad, setPricePerLoad] = useState(0)
  const [loadDiscount, setLoadDiscount] = useState(0)
  const [specialtyPrice, setSpecialtyPrice] = useState(0)
  const [mixedSpecialtyPrice, setMixedSpecialtyPrice] = useState(0)
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

    const totalCost = costLandfill + costDumpster + costDemoMachine + costTruckRental + costFuel + costLabor
    const profit = subtotal - totalCost
    const margin = subtotal > 0 ? (profit / subtotal) * 100 : 0
    const hourlyRate = estimatedHours > 0 ? profit / estimatedHours : 0

    let recommendLow = '—'; let recommendMed = '—'; let recommendHigh = '—'
    if (totalCost > 0) {
      recommendLow = `${formatCurrency(Math.ceil(totalCost / 0.80))} – ${formatCurrency(Math.ceil(totalCost / 0.70))}`
      recommendMed = `${formatCurrency(Math.ceil(totalCost / 0.69))} – ${formatCurrency(Math.ceil(totalCost / 0.51))}`
      recommendHigh = `${formatCurrency(Math.ceil(totalCost / 0.50))} – ${formatCurrency(Math.ceil(totalCost / 0.35))}`
    }

    return { subtotal, totalCost, profit, margin, hourlyRate, recommendLow, recommendMed, recommendHigh }
  }, [jobType, loadPrice, numLoads, pricePerLoad, loadDiscount, specialtyPrice, mixedSpecialtyPrice, mixedLoadPrice,
    applyStairs, stairsCharge, applyDisassembly, disassemblyCharge, applyExtraLabor, extraLaborCharge, applyDemolition, demolitionCharge,
    costLandfill, costDumpster, costDemoMachine, costTruckRental, costFuel, costLabor, estimatedHours])

  const { margin, subtotal, totalCost, profit, hourlyRate } = calc
  const hasInput = subtotal > 0 || totalCost > 0

  const marginColor = margin >= 50 ? 'text-green-600 dark:text-green-400' : margin >= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'

  const clearAll = useCallback(() => {
    setJobType('volume'); setEstimatedHours(0); setLoadPrice(0); setNumLoads(2); setPricePerLoad(0); setLoadDiscount(0)
    setSpecialtyPrice(0); setMixedSpecialtyPrice(0); setMixedLoadPrice(0)
    setApplyStairs(false); setStairsCharge(0); setApplyDisassembly(false); setDisassemblyCharge(0)
    setApplyExtraLabor(false); setExtraLaborCharge(0); setApplyDemolition(false); setDemolitionCharge(0)
    setCostLandfill(0); setCostDumpster(0); setCostDemoMachine(0); setCostTruckRental(0); setCostFuel(0); setCostLabor(0)
  }, [])

  const costBreakdown = [
    { label: 'Landfill', value: costLandfill, color: 'bg-red-400' },
    { label: 'Dumpster', value: costDumpster, color: 'bg-pink-400' },
    { label: 'Equipment', value: costDemoMachine, color: 'bg-purple-400' },
    { label: 'Truck', value: costTruckRental, color: 'bg-blue-400' },
    { label: 'Fuel', value: costFuel, color: 'bg-cyan-400' },
    { label: 'Labor', value: costLabor, color: 'bg-amber-400' },
  ].filter(c => c.value > 0)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit Calculator</h1>
          <p className="page-subtitle">Price jobs and know your real margin before you quote</p>
        </div>
        {hasInput && (
          <button onClick={clearAll} className="app-btn-secondary text-sm px-4 py-2">Clear All</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* Left: Inputs */}
        <div className="space-y-4">
          {/* Job Pricing */}
          <div className="app-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              Job Pricing
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="app-label">Job Type</label>
                <select value={jobType} onChange={(e) => setJobType(e.target.value as JobType)} className="app-select">
                  <option value="volume">Volume (by truck load)</option>
                  <option value="multipleLoads">Multiple Full Loads</option>
                  <option value="specialty">Specialty Item</option>
                  <option value="mixed">Mixed (Specialty + Volume)</option>
                </select>
              </div>
              <div>
                <label className="app-label">Estimated Hours</label>
                <input type="number" value={estimatedHours || ''} onChange={(e) => setEstimatedHours(Number(e.target.value) || 0)} className="app-input" placeholder="e.g. 2" min="0" />
              </div>
            </div>

            {jobType === 'volume' && (
              <div>
                <label className="app-label">Your Price ($)</label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                  <input type="number" value={loadPrice || ''} onChange={(e) => setLoadPrice(Number(e.target.value) || 0)} className="app-input pl-7" placeholder="0" min="0" />
                </div>
              </div>
            )}
            {jobType === 'multipleLoads' && (
              <div className="grid grid-cols-3 gap-3">
                <div><label className="app-label"># Loads</label><input type="number" value={numLoads || ''} onChange={(e) => setNumLoads(Number(e.target.value) || 0)} className="app-input" min="1" /></div>
                <div><label className="app-label">Price/Load</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span><input type="number" value={pricePerLoad || ''} onChange={(e) => setPricePerLoad(Number(e.target.value) || 0)} className="app-input pl-7" min="0" /></div></div>
                <div><label className="app-label">Discount %</label><input type="number" value={loadDiscount || ''} onChange={(e) => setLoadDiscount(Number(e.target.value) || 0)} className="app-input" min="0" max="100" /></div>
              </div>
            )}
            {jobType === 'specialty' && (
              <div><label className="app-label">Specialty Price ($)</label><div className="relative max-w-xs"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span><input type="number" value={specialtyPrice || ''} onChange={(e) => setSpecialtyPrice(Number(e.target.value) || 0)} className="app-input pl-7" min="0" /></div></div>
            )}
            {jobType === 'mixed' && (
              <div className="grid grid-cols-2 gap-3">
                <div><label className="app-label">Specialty Price ($)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span><input type="number" value={mixedSpecialtyPrice || ''} onChange={(e) => setMixedSpecialtyPrice(Number(e.target.value) || 0)} className="app-input pl-7" min="0" /></div></div>
                <div><label className="app-label">Additional Load ($)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span><input type="number" value={mixedLoadPrice || ''} onChange={(e) => setMixedLoadPrice(Number(e.target.value) || 0)} className="app-input pl-7" min="0" /></div></div>
              </div>
            )}

            {/* Surcharges */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-2">Surcharges</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: 'Stairs', checked: applyStairs, onToggle: setApplyStairs, charge: stairsCharge, onChange: setStairsCharge },
                  { label: 'Disassembly', checked: applyDisassembly, onToggle: setApplyDisassembly, charge: disassemblyCharge, onChange: setDisassemblyCharge },
                  { label: 'Heavy Items', checked: applyExtraLabor, onToggle: setApplyExtraLabor, charge: extraLaborCharge, onChange: setExtraLaborCharge },
                  { label: 'Demolition', checked: applyDemolition, onToggle: setApplyDemolition, charge: demolitionCharge, onChange: setDemolitionCharge },
                ] as const).map(({ label, checked, onToggle, charge, onChange }) => (
                  <div key={label} className={`rounded-lg border p-2.5 transition-all ${checked ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/30' : 'border-[var(--color-border)]'}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="w-4 h-4 rounded accent-orange-500" />
                      <span className="text-sm">{label}</span>
                    </label>
                    {checked && (
                      <div className="mt-2 relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-xs">$</span>
                        <input type="number" value={charge || ''} onChange={(e) => onChange(Number(e.target.value) || 0)} className="app-input pl-6 text-sm py-1.5" min="0" placeholder="0" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Costs */}
          <div className="app-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Your Costs
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                { label: 'Landfill/Dump', value: costLandfill, set: setCostLandfill },
                { label: 'Dumpster', value: costDumpster, set: setCostDumpster },
                { label: 'Equipment', value: costDemoMachine, set: setCostDemoMachine },
                { label: 'Truck Rental', value: costTruckRental, set: setCostTruckRental },
                { label: 'Fuel', value: costFuel, set: setCostFuel },
                { label: 'Labor', value: costLabor, set: setCostLabor },
              ] as const).map(({ label, value, set }) => (
                <div key={label}>
                  <label className="app-label">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-xs">$</span>
                    <input type="number" value={value || ''} onChange={(e) => set(Number(e.target.value) || 0)} className="app-input pl-7 text-sm" min="0" placeholder="0" />
                  </div>
                </div>
              ))}
            </div>

            {costBreakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="flex h-2 rounded-full overflow-hidden gap-px">
                  {costBreakdown.map(c => (
                    <div key={c.label} className={`${c.color}`} style={{ width: `${(c.value / totalCost) * 100}%` }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {costBreakdown.map(c => (
                    <span key={c.label} className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                      <span className={`w-2 h-2 rounded-full ${c.color}`} />
                      {c.label} {formatCurrency(c.value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* National Averages */}
          <div className="app-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              National Averages (USA)
            </h3>
            <div className="space-y-1.5">
              {NATIONAL_AVERAGES.map(r => (
                <div key={r.size} className="flex justify-between text-sm py-1 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[var(--color-text-muted)]">{r.size}</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">{r.range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Results (sticky) */}
        <div className="lg:sticky lg:top-24 space-y-4">
          {/* Margin card */}
          <div className="app-card p-5">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-center mb-2">Gross Profit Margin</p>
            <p className={`text-5xl font-bold text-center tabular-nums ${hasInput ? marginColor : 'text-[var(--color-text-faint)]'}`}>
              {margin.toFixed(1)}%
            </p>

            <div className="w-full h-2 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden mt-3">
              <div className={`h-full rounded-full transition-all duration-500 ${margin >= 50 ? 'bg-green-500' : margin >= 30 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(Math.max(margin, 0), 100)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--color-text-faint)] mt-1 px-0.5">
              <span>0%</span><span>30%</span><span>50%</span><span>100%</span>
            </div>

            <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
              margin >= 50 ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-300'
              : margin >= 30 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-300'
              : margin > 0 ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300'
              : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)] text-[var(--color-text-muted)]'
            }`}>
              {margin >= 50 ? 'Excellent — target profit zone.' : margin >= 30 ? 'Moderate margin. Push to 50%+.' : margin > 0 ? 'Low margin — raise your price.' : margin < 0 ? 'Losing money on this job.' : 'Enter quote & costs to see margin.'}
            </div>

            {/* Breakdown */}
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Quote price</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Your costs</span><span className="font-medium text-red-500">{formatCurrency(totalCost)}</span></div>
              <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
                <span className="font-medium">Your profit</span>
                <span className={`font-bold text-lg ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{formatCurrency(profit)}</span>
              </div>
            </div>

            {hasInput && estimatedHours > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex justify-between text-sm">
                <span className="text-[var(--color-text-muted)]">$/Hour</span>
                <span className={`font-bold ${hourlyRate >= 75 ? 'text-green-600 dark:text-green-400' : hourlyRate >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>{formatCurrency(hourlyRate)}</span>
              </div>
            )}
          </div>

          {/* Recommended */}
          <div className="app-card p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Recommended Pricing</h3>
            <div className="space-y-2">
              {([
                { label: '20–30%', sub: 'Minimum viable', value: calc.recommendLow, color: 'bg-red-400' },
                { label: '31–49%', sub: 'Moderate profit', value: calc.recommendMed, color: 'bg-amber-400' },
                { label: '50–65%', sub: 'Target zone', value: calc.recommendHigh, color: 'bg-green-500' },
              ] as const).map(r => (
                <div key={r.label} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${r.color}`} />
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-[11px] text-[var(--color-text-faint)]">{r.sub}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
