'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SourceROI } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'

const CHANNEL_PRESETS = [
  'Google Ads',
  'Facebook Ads',
  'Yard Signs',
  'Thumbtack',
  'HomeAdvisor',
  'Yelp',
  'Craigslist',
  'Instagram',
  'Nextdoor',
  'Website',
  'Referral',
  'Word of Mouth',
  'Other',
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
}

export function Marketing({ showSuccess }: MarketingProps) {
  const [spendItems, setSpendItems] = useState<MarketingSpendItem[]>([])
  const [roiItems, setRoiItems] = useState<SourceROI[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'all'>('month')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formSource, setFormSource] = useState('')
  const [formMonth, setFormMonth] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { confirm, alert } = useConfirm()

  const loadSpend = useCallback(async () => {
    try {
      let params = ''
      if (period === 'month') params = `?month=${selectedMonth}`
      if (period === 'quarter') {
        const [y, m] = selectedMonth.split('-').map(Number)
        const startMonth = Math.floor((m - 1) / 3) * 3 + 1
        const start = `${y}-${String(startMonth).padStart(2, '0')}-01`
        const endMonth = startMonth + 2
        const endYear = endMonth > 12 ? y + 1 : y
        const endM = endMonth > 12 ? endMonth - 12 : endMonth
        const end = `${endYear}-${String(endM).padStart(2, '0')}-01`
        const res = await fetch('/api/marketing/spend')
        if (!res.ok) throw new Error('Failed to load spend')
        const data = await res.json()
        const all = (data.items || []) as MarketingSpendItem[]
        const inQuarter = all.filter(i => i.month >= start && i.month <= end)
        setSpendItems(inQuarter)
        return
      }
      const res = await fetch(`/api/marketing/spend${params}`)
      if (!res.ok) throw new Error('Failed to load spend')
      const data = await res.json()
      setSpendItems(data.items || [])
    } catch (e) {
      console.error(e)
      setSpendItems([])
    }
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
            if (!merged[row.source]) {
              merged[row.source] = { source: row.source, spend: 0, revenue: 0, jobs: 0, roi: 0, costPerJob: 0 }
            }
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
        arr.sort((a, b) => b.revenue - a.revenue)
        setRoiItems(arr)
        return
      }
      const res = await fetch(`/api/marketing/roi?month=${selectedMonth}`)
      if (!res.ok) throw new Error('Failed to load ROI')
      const data = await res.json()
      setRoiItems(data.items || [])
    } catch (e) {
      console.error(e)
      setRoiItems([])
    }
  }, [period, selectedMonth])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([loadSpend(), loadRoi()]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [loadSpend, loadRoi])

  const openAdd = () => {
    setEditingId(null)
    setFormSource('')
    setFormMonth(selectedMonth)
    setFormAmount('')
    setFormNotes('')
    setShowForm(true)
  }

  const openEdit = (item: MarketingSpendItem) => {
    setEditingId(item.id)
    setFormSource(item.source)
    setFormMonth(item.month.slice(0, 7))
    setFormAmount(String(item.amount))
    setFormNotes(item.notes || '')
    setShowForm(true)
  }

  const saveSpend = async () => {
    if (!formSource.trim()) {
      await alert({ title: 'Missing channel', message: 'Enter a channel/source.', variant: 'warning' })
      return
    }
    const amount = parseFloat(formAmount)
    if (Number.isNaN(amount) || amount < 0) {
      await alert({ title: 'Invalid amount', message: 'Enter a valid amount.', variant: 'warning' })
      return
    }
    setSaving(true)
    try {
      const body: { source: string; month: string; amount: number; notes?: string } = {
        source: formSource.trim(),
        month: formMonth.slice(0, 7) + '-01',
        amount,
      }
      if (formNotes.trim()) body.notes = formNotes.trim()
      const res = await fetch('/api/marketing/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      showSuccess(editingId ? 'Spend updated' : 'Spend added')
      setShowForm(false)
      loadSpend()
      loadRoi()
    } catch (e) {
      await alert({ title: 'Error', message: e instanceof Error ? e.message : 'Could not save', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteSpend = async (id: string) => {
    const ok = await confirm({
      title: 'Delete spend entry?',
      message: 'This cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/marketing/spend?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      showSuccess('Entry removed')
      setSpendItems(prev => prev.filter(i => i.id !== id))
      loadRoi()
    } catch (e) {
      await alert({ title: 'Error', message: e instanceof Error ? e.message : 'Could not delete', variant: 'error' })
    }
  }

  const totalSpend = roiItems.reduce((s, i) => s + i.spend, 0)
  const totalRevenue = roiItems.reduce((s, i) => s + i.revenue, 0)
  const overallRoi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : (totalRevenue > 0 ? 100 : 0)

  const monthOptions = (() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 24; i++) {
      const past = new Date(d.getFullYear(), d.getMonth() - i, 1)
      const y = past.getFullYear()
      const m = past.getMonth() + 1
      out.push(`${y}-${String(m).padStart(2, '0')}`)
    }
    return out
  })()

  if (loading) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Marketing</h1>
        <p className="text-[var(--color-text-muted)] mt-2">Loading…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Marketing</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Track spend and ROI by channel</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'all')}
            className="app-input text-sm py-2"
          >
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="all">All time</option>
          </select>
          {period !== 'all' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="app-input text-sm py-2"
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <button onClick={openAdd} className="app-btn-primary text-sm py-2 px-4">
            Add spend
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Total spend</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{formatCurrency(totalSpend)}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Revenue (from jobs)</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Overall ROI</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{overallRoi.toFixed(0)}%</p>
        </div>
      </div>

      {/* ROI by source */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">ROI by source</h2>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {roiItems.length === 0 ? (
            <p className="p-6 text-[var(--color-text-muted)] text-sm">No data for this period. Add marketing spend and tag job sources to see ROI.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
                    <th className="text-left p-3 font-medium text-[var(--color-text-secondary)]">Source</th>
                    <th className="text-right p-3 font-medium text-[var(--color-text-secondary)]">Spend</th>
                    <th className="text-right p-3 font-medium text-[var(--color-text-secondary)]">Revenue</th>
                    <th className="text-right p-3 font-medium text-[var(--color-text-secondary)]">Jobs</th>
                    <th className="text-right p-3 font-medium text-[var(--color-text-secondary)]">ROI %</th>
                    <th className="text-right p-3 font-medium text-[var(--color-text-secondary)]">Cost/job</th>
                  </tr>
                </thead>
                <tbody>
                  {roiItems.map((row) => (
                    <tr key={row.source} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="p-3 font-medium text-[var(--color-text-primary)]">{row.source}</td>
                      <td className="p-3 text-right text-[var(--color-text-secondary)]">{formatCurrency(row.spend)}</td>
                      <td className="p-3 text-right text-[var(--color-text-secondary)]">{formatCurrency(row.revenue)}</td>
                      <td className="p-3 text-right text-[var(--color-text-secondary)]">{row.jobs}</td>
                      <td className="p-3 text-right text-[var(--color-text-secondary)]">{row.roi.toFixed(0)}%</td>
                      <td className="p-3 text-right text-[var(--color-text-secondary)]">{formatCurrency(row.costPerJob)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Spend entries */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Spend entries</h2>
        {spendItems.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No spend logged for this period.</p>
        ) : (
          <ul className="space-y-2">
            {spendItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-3"
              >
                <div>
                  <span className="font-medium text-[var(--color-text-primary)]">{item.source}</span>
                  <span className="text-[var(--color-text-muted)] text-sm ml-2">{item.month.slice(0, 7)}</span>
                  {item.notes && <span className="block text-xs text-[var(--color-text-muted)]">{item.notes}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--color-text-primary)]">{formatCurrency(item.amount)}</span>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSpend(item.id)}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowForm(false)}>
          <div
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">{editingId ? 'Edit spend' : 'Add spend'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Channel / source</label>
                <input
                  list="channel-list"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  placeholder="e.g. Google Ads"
                  className="app-input w-full"
                />
                <datalist id="channel-list">
                  {CHANNEL_PRESETS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Month (YYYY-MM)</label>
                <input
                  type="month"
                  value={formMonth}
                  onChange={(e) => setFormMonth(e.target.value || selectedMonth)}
                  className="app-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="app-input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Notes (optional)</label>
                <input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional"
                  className="app-input w-full"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={saveSpend} disabled={saving} className="app-btn-primary flex-1">
                {saving ? 'Saving…' : (editingId ? 'Update' : 'Add')}
              </button>
              <button onClick={() => setShowForm(false)} className="app-btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
