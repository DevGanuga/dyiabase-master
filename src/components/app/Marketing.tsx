'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { SourceROI } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'

const CHANNEL_PRESETS = [
  'Google Ads', 'Facebook Ads', 'Yard Signs', 'Thumbtack', 'HomeAdvisor',
  'Yelp', 'Craigslist', 'Instagram', 'Nextdoor', 'Website', 'Referral', 'Word of Mouth', 'Other',
]

interface MarketingSpendItem {
  id: string
  source: string
  month: string
  amount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface MarketingProps {
  showSuccess: (message: string) => void
  isPro?: boolean
}

export function Marketing({ showSuccess, isPro = false }: MarketingProps) {
  const [spendItems, setSpendItems] = useState<MarketingSpendItem[]>([])
  const [roiItems, setRoiItems] = useState<SourceROI[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'all'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Inline add form state (always visible at bottom)
  const [addSource, setAddSource] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Edit modal state
  const [editItem, setEditItem] = useState<MarketingSpendItem | null>(null)
  const [editSource, setEditSource] = useState('')
  const [editMonth, setEditMonth] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [sortBy, setSortBy] = useState<'revenue' | 'roi' | 'spend'>('revenue')

  const { confirm, alert } = useConfirm()

  const loadSpend = useCallback(async () => {
    try {
      let params = ''
      if (period === 'month') params = `?month=${selectedMonth}`
      if (period === 'quarter') {
        const [y, m] = selectedMonth.split('-').map(Number)
        const startMonth = Math.floor((m - 1) / 3) * 3 + 1
        const endMonth = startMonth + 2
        const startStr = `${y}-${String(startMonth).padStart(2, '0')}`
        const endStr = `${y}-${String(endMonth).padStart(2, '0')}`
        const res = await fetch('/api/marketing/spend')
        if (!res.ok) throw new Error('Failed to load spend')
        const data = await res.json()
        const all = (data.items || []) as MarketingSpendItem[]
        setSpendItems(all.filter(i => { const m = i.month.slice(0, 7); return m >= startStr && m <= endStr }))
        return
      }
      const res = await fetch(`/api/marketing/spend${params}`)
      if (!res.ok) throw new Error('Failed to load spend')
      const data = await res.json()
      setSpendItems(data.items || [])
    } catch { setSpendItems([]) }
  }, [period, selectedMonth])

  const loadRoi = useCallback(async () => {
    try {
      if (period === 'all') {
        const res = await fetch('/api/marketing/roi?month=all')
        if (!res.ok) throw new Error('Failed to load ROI')
        const data = await res.json()
        setRoiItems(data.items || [])
        return
      }
      if (period === 'quarter') {
        const [y, m] = selectedMonth.split('-').map(Number)
        const startMonth = Math.floor((m - 1) / 3) * 3 + 1
        const months = [
          `${y}-${String(startMonth).padStart(2, '0')}`,
          `${y}-${String(startMonth + 1).padStart(2, '0')}`,
          `${y}-${String(startMonth + 2).padStart(2, '0')}`,
        ]
        const results = await Promise.all(months.map(month => fetch(`/api/marketing/roi?month=${month}`).then(r => r.json())))
        const merged: Record<string, SourceROI> = {}
        for (const { items } of results) {
          for (const row of items || []) {
            if (!merged[row.source]) merged[row.source] = { source: row.source, spend: 0, revenue: 0, jobs: 0, roi: 0, costPerJob: 0 }
            merged[row.source].spend += row.spend
            merged[row.source].revenue += row.revenue
            merged[row.source].jobs += row.jobs
          }
        }
        const arr = Object.values(merged).map(row => ({
          ...row,
          roi: row.spend > 0 ? ((row.revenue - row.spend) / row.spend) * 100 : (row.revenue > 0 ? 100 : 0),
          costPerJob: row.jobs > 0 ? row.spend / row.jobs : 0,
        }))
        setRoiItems(arr)
        return
      }
      const res = await fetch(`/api/marketing/roi?month=${selectedMonth}`)
      if (!res.ok) throw new Error('Failed to load ROI')
      const data = await res.json()
      setRoiItems(data.items || [])
    } catch { setRoiItems([]) }
  }, [period, selectedMonth])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([loadSpend(), loadRoi()]).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [loadSpend, loadRoi])

  const totalSpend = roiItems.reduce((s, i) => s + i.spend, 0)
  const totalRevenue = roiItems.reduce((s, i) => s + i.revenue, 0)
  const totalJobs = roiItems.reduce((s, i) => s + i.jobs, 0)
  const overallRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : null

  const bestChannel = useMemo(() => {
    const withRoi = roiItems.filter(r => r.revenue > 0)
    if (withRoi.length === 0) return null
    return withRoi.reduce((best, r) => r.roi > best.roi ? r : best, withRoi[0])
  }, [roiItems])

  const sortedSources = useMemo(() => {
    const arr = [...roiItems]
    if (sortBy === 'roi') arr.sort((a, b) => b.roi - a.roi)
    else if (sortBy === 'spend') arr.sort((a, b) => b.spend - a.spend)
    else arr.sort((a, b) => b.revenue - a.revenue)
    return arr
  }, [roiItems, sortBy])

  const maxRevenue = Math.max(...roiItems.map(r => r.revenue), 1)
  const maxSpend = Math.max(...roiItems.map(r => r.spend), 1)
  const barMax = Math.max(maxRevenue, maxSpend)

  // Actionable insights
  const insights = useMemo(() => {
    const tips: string[] = []
    if (roiItems.length < 2) return tips

    const best = roiItems.filter(r => r.jobs > 0).sort((a, b) => {
      const aCost = a.spend > 0 ? a.spend / a.jobs : 0
      const bCost = b.spend > 0 ? b.spend / b.jobs : 0
      return aCost - bCost
    })[0]
    if (best && best.spend > 0) {
      tips.push(`${best.source} is your most efficient channel at ${formatCurrency(best.spend / best.jobs)}/job with ${best.jobs} job${best.jobs !== 1 ? 's' : ''}.`)
    }

    const zeroReturn = roiItems.filter(r => r.spend > 0 && r.jobs === 0)
    for (const z of zeroReturn.slice(0, 2)) {
      tips.push(`${z.source} spent ${formatCurrency(z.spend)} with 0 jobs. Consider pausing or adjusting.`)
    }

    const freeRevenue = roiItems.filter(r => r.spend === 0 && r.revenue > 0)
    for (const f of freeRevenue.slice(0, 1)) {
      tips.push(`${f.source} brought ${formatCurrency(f.revenue)} at zero cost. Double down on this channel.`)
    }

    return tips
  }, [roiItems])

  const handleQuickAdd = async () => {
    if (!addSource.trim()) return
    const amount = parseFloat(addAmount)
    if (Number.isNaN(amount) || amount < 0) {
      await alert({ title: 'Invalid amount', message: 'Enter a valid amount.', variant: 'warning' })
      return
    }
    setAddSaving(true)
    try {
      const body: Record<string, unknown> = { source: addSource.trim(), month: selectedMonth + '-01', amount }
      if (addNotes.trim()) body.notes = addNotes.trim()
      const res = await fetch('/api/marketing/spend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error('Save failed')
      showSuccess('Spend added')
      setAddSource(''); setAddAmount(''); setAddNotes('')
      loadSpend(); loadRoi()
    } catch (e) {
      await alert({ title: 'Error', message: e instanceof Error ? e.message : 'Could not save', variant: 'error' })
    } finally { setAddSaving(false) }
  }

  const openEdit = (item: MarketingSpendItem) => {
    setEditItem(item)
    setEditSource(item.source)
    setEditMonth(item.month.slice(0, 7))
    setEditAmount(String(item.amount))
    setEditNotes(item.notes || '')
  }

  const handleEditSave = async () => {
    if (!editItem) return
    const amount = parseFloat(editAmount)
    if (Number.isNaN(amount) || amount < 0) return
    setEditSaving(true)
    try {
      await fetch(`/api/marketing/spend?id=${editItem.id}`, { method: 'DELETE' })
      const body: Record<string, unknown> = { source: editSource.trim(), month: editMonth + '-01', amount }
      if (editNotes.trim()) body.notes = editNotes.trim()
      await fetch('/api/marketing/spend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      showSuccess('Updated')
      setEditItem(null)
      loadSpend(); loadRoi()
    } catch { /* ignore */ } finally { setEditSaving(false) }
  }

  const deleteSpend = async (id: string) => {
    if (!await confirm({ title: 'Delete?', message: 'This cannot be undone.', variant: 'danger', confirmLabel: 'Delete' })) return
    try {
      await fetch(`/api/marketing/spend?id=${id}`, { method: 'DELETE' })
      showSuccess('Removed')
      setSpendItems(prev => prev.filter(i => i.id !== id))
      loadRoi()
    } catch { /* ignore */ }
  }

  const monthOptions = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 24; i++) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1)
      out.push(`${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}`)
    }
    return out
  }, [])

  if (!isPro) {
    return (
      <div className="page-content">
        <div>
          <h1 className="page-title">Marketing</h1>
          <p className="page-subtitle">Track spend and ROI by channel</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Pro Feature</h2>
          <p className="text-[var(--color-text-muted)] mb-4">Upgrade to Pro to track marketing spend and see ROI by channel.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page-content">
        <h1 className="page-title">Marketing</h1>
        <div className="flex items-center gap-3 mt-4"><div className="loading-spinner" /><span className="text-[var(--color-text-muted)]">Loading...</span></div>
      </div>
    )
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Marketing</h1>
          <p className="page-subtitle">Track spend and measure ROI by channel</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'all')} className="app-input text-sm py-2">
            <option value="month">Monthly</option>
            <option value="quarter">Quarterly</option>
            <option value="all">All time</option>
          </select>
          {period !== 'all' && (
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="app-input text-sm py-2">
              {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="app-card p-4">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Total Spend</p>
          <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mt-1">{formatCurrency(totalSpend)}</p>
        </div>
        <div className="app-card p-4">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="app-card p-4">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Overall ROI</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 ${overallRoi !== null && overallRoi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
            {overallRoi !== null ? `${overallRoi.toFixed(0)}%` : '--'}
          </p>
        </div>
        <div className="app-card p-4">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Best Channel</p>
          <p className="text-sm sm:text-base font-bold text-orange-600 dark:text-orange-400 mt-1 truncate">{bestChannel?.source || '--'}</p>
          {bestChannel && <p className="text-[10px] text-[var(--color-text-muted)]">{bestChannel.jobs} job{bestChannel.jobs !== 1 ? 's' : ''} · {bestChannel.roi.toFixed(0)}% ROI</p>}
        </div>
      </div>

      {/* Spend vs Revenue Bar Chart */}
      {roiItems.length > 0 && (
        <div className="app-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Spend vs Revenue by Channel</h3>
          <div className="space-y-3">
            {sortedSources.filter(r => r.spend > 0 || r.revenue > 0).map(row => (
              <div key={row.source}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate max-w-[120px]">{row.source}</span>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                    <span>Spend: {formatCurrency(row.spend)}</span>
                    <span>Rev: {formatCurrency(row.revenue)}</span>
                    <span className={row.roi >= 0 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-500 font-semibold'}>{row.roi.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="flex gap-1 h-4">
                  <div
                    className="bg-red-400/70 dark:bg-red-500/50 rounded-sm transition-all"
                    style={{ width: `${Math.max(2, (row.spend / barMax) * 100)}%` }}
                    title={`Spend: ${formatCurrency(row.spend)}`}
                  />
                  <div
                    className="bg-green-400/70 dark:bg-green-500/50 rounded-sm transition-all"
                    style={{ width: `${Math.max(2, (row.revenue / barMax) * 100)}%` }}
                    title={`Revenue: ${formatCurrency(row.revenue)}`}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 text-[10px] text-[var(--color-text-faint)] pt-2 border-t border-[var(--color-border)]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400/70" /> Spend</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-400/70" /> Revenue</span>
            </div>
          </div>
        </div>
      )}

      {/* Actionable Insights */}
      {insights.length > 0 && (
        <div className="app-card p-4 sm:p-5 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10 border-amber-200/30 dark:border-amber-800/20">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Insights
          </h3>
          <ul className="space-y-2">
            {insights.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <span className="text-amber-500 mt-0.5 shrink-0">&#8227;</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Source Performance Cards */}
      {roiItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Channel Performance</h3>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'revenue' | 'roi' | 'spend')} className="app-input text-xs py-1 w-auto">
              <option value="revenue">Sort: Revenue</option>
              <option value="roi">Sort: ROI</option>
              <option value="spend">Sort: Spend</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedSources.map(row => {
              const borderColor = row.roi > 100 ? 'border-l-green-500' : row.roi > 0 ? 'border-l-amber-500' : row.roi < 0 ? 'border-l-red-500' : 'border-l-slate-300 dark:border-l-slate-700'
              return (
                <div key={row.source} className={`app-card p-4 border-l-4 ${borderColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{row.source}</span>
                    <span className={`text-sm font-bold ${row.roi >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{row.roi.toFixed(0)}% ROI</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">Spend</p>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(row.spend)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">Revenue</p>
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(row.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">Jobs</p>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{row.jobs}</p>
                    </div>
                  </div>
                  {row.spend > 0 && row.jobs > 0 && (
                    <p className="text-[10px] text-[var(--color-text-faint)] mt-2 text-center">{formatCurrency(row.costPerJob)}/job</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Spend Entries */}
      {spendItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Spend Log</h3>
          <div className="space-y-1.5">
            {spendItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{item.source}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">{item.month.slice(0, 7)}</span>
                  {item.notes && <p className="text-[10px] text-[var(--color-text-faint)] truncate">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(item.amount)}</span>
                  <button onClick={() => openEdit(item)} className="text-[10px] text-orange-500 hover:underline">Edit</button>
                  <button onClick={() => deleteSpend(item.id)} className="text-[10px] text-red-500 hover:underline">Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inline Quick Add */}
      <div className="app-card p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Log Marketing Spend</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <input
              list="add-channels"
              value={addSource}
              onChange={(e) => setAddSource(e.target.value)}
              placeholder="Channel (e.g. Google Ads)"
              className="app-input text-sm w-full"
            />
            <datalist id="add-channels">
              {CHANNEL_PRESETS.map(ch => <option key={ch} value={ch} />)}
            </datalist>
          </div>
          <div className="relative w-full sm:w-32">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
            <input type="number" min="0" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} className="app-input pl-7 text-sm w-full" placeholder="Amount" />
          </div>
          <input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Notes (optional)" className="app-input text-sm w-full sm:w-40 hidden sm:block" />
          <button onClick={handleQuickAdd} disabled={addSaving || !addSource.trim()} className="app-btn-primary text-sm py-2 px-4 shrink-0 disabled:opacity-40">
            {addSaving ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Empty state */}
      {roiItems.length === 0 && spendItems.length === 0 && (
        <div className="app-card p-8 text-center">
          <svg className="w-12 h-12 text-[var(--color-text-faint)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          </svg>
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-1">No marketing data yet</h3>
          <p className="text-sm text-[var(--color-text-muted)]">Log your first marketing spend above, and tag lead sources when creating jobs and quotes.</p>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditItem(null)} />
          <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Edit Spend</h3>
            <div className="space-y-3">
              <div>
                <label className="app-label">Channel</label>
                <input list="edit-channels" value={editSource} onChange={(e) => setEditSource(e.target.value)} className="app-input" />
                <datalist id="edit-channels">{CHANNEL_PRESETS.map(ch => <option key={ch} value={ch} />)}</datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="app-label">Month</label>
                  <input type="month" value={editMonth} onChange={(e) => setEditMonth(e.target.value)} className="app-input" />
                </div>
                <div>
                  <label className="app-label">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                    <input type="number" min="0" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="app-input pl-7" />
                  </div>
                </div>
              </div>
              <div>
                <label className="app-label">Notes</label>
                <input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className="app-input" placeholder="Optional" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleEditSave} disabled={editSaving} className="app-btn-primary flex-1">{editSaving ? 'Saving...' : 'Save'}</button>
              <button onClick={() => setEditItem(null)} className="app-btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
