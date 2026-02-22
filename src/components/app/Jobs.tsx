'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppJob, AppSettings } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { getReviewRequestMessage } from '@/lib/reviews'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useCustomerAutocomplete } from '@/hooks/useCustomerAutocomplete'
import { DyiaInsight } from './DyiaInsight'
import { ensureCustomer } from '@/lib/customers'
import { DyiaActionButton, DYIA_PROMPTS } from './DyiaActionButton'

const REVIEW_PLATFORMS = ['Google', 'Yelp', 'Facebook'] as const

interface JobsProps {
  jobs: AppJob[]
  setJobs: (jobs: AppJob[]) => void
  userId: string
  selectedMonth: Date
  setSelectedMonth: (date: Date) => void
  settings?: AppSettings
  showSuccess: (message: string) => void
  onOpenDyiaWithPrompt?: (prompt: string) => void
  isPro?: boolean
}

interface TempCustomer {
  id: number
  name: string
  source: string
  revenue: number
}

interface TempExpenses {
  labor: number
  gas: number
  dumpFee: number
  dumpsterRental: number
  additional: number
}

const MARKETING_SOURCES = ['Google', 'Facebook', 'Referral', 'Repeat Customer', 'Yelp', 'Craigslist', 'Instagram', 'Nextdoor', 'Thumbtack', 'HomeAdvisor', 'Website', 'Other']

export function Jobs({ jobs, setJobs, userId, selectedMonth, setSelectedMonth, settings, showSuccess, onOpenDyiaWithPrompt, isPro = true }: JobsProps) {
  const [editingJob, setEditingJob] = useState<AppJob | 'new' | null>(null)
  const [tempCustomers, setTempCustomers] = useState<TempCustomer[]>([])
  const [tempExpenses, setTempExpenses] = useState<TempExpenses>({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
  const [tempDate, setTempDate] = useState(new Date().toISOString().split('T')[0])
  const [tempNotes, setTempNotes] = useState('')
  const [tempAddress, setTempAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<string>('newest')
  const [hasCheckedMonth, setHasCheckedMonth] = useState(false)
  const [reviewModalJob, setReviewModalJob] = useState<AppJob | null>(null)
  const [reviewPlatform, setReviewPlatform] = useState<string>(REVIEW_PLATFORMS[0])
  const [reviewCopied, setReviewCopied] = useState(false)
  const [showExpenseDetails, setShowExpenseDetails] = useState(false)

  const supabase = createClient()
  const { confirm, alert } = useConfirm()
  
  // Auto-navigate to most recent job's month if current month has no jobs (on initial load)
  useEffect(() => {
    if (hasCheckedMonth || jobs.length === 0) return
    
    const currentMonthJobs = jobs.filter(job => {
      const jobDate = new Date(job.date)
      return jobDate.getMonth() === selectedMonth.getMonth() &&
             jobDate.getFullYear() === selectedMonth.getFullYear()
    })
    
    if (currentMonthJobs.length === 0) {
      const sortedJobs = [...jobs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      if (sortedJobs.length > 0) {
        const mostRecentDate = new Date(sortedJobs[0].date)
        setSelectedMonth(new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1))
      }
    }
    setHasCheckedMonth(true)
  }, [jobs, selectedMonth, hasCheckedMonth, setSelectedMonth])

  // Filter jobs by month
  const monthJobs = useMemo(() => {
    return jobs.filter(job => {
      const jobDate = new Date(job.date)
      return jobDate.getMonth() === selectedMonth.getMonth() &&
             jobDate.getFullYear() === selectedMonth.getFullYear()
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [jobs, selectedMonth])

  // Customer autocomplete from DB + job names fallback
  const jobNamesFallback = useMemo(() => {
    const names = new Set<string>()
    jobs.forEach(j => {
      const n = (j.customerName || '').trim()
      if (n) names.add(n)
    })
    return [...names].sort()
  }, [jobs])
  const { nameList: customerNameSuggestions, findByName } = useCustomerAutocomplete(jobNamesFallback)

  const filteredJobs = useMemo(() => {
    const filtered = monthJobs.filter(job => {
      const matchesSearch = searchQuery === '' || 
        job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.source && job.source.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesSource = sourceFilter === 'all' || job.source === sourceFilter
      return matchesSearch && matchesSource
    })

    switch (sortOrder) {
      case 'oldest':
        return [...filtered].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      case 'rev-desc':
        return [...filtered].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
      case 'rev-asc':
        return [...filtered].sort((a, b) => (a.revenue || 0) - (b.revenue || 0))
      default:
        return filtered
    }
  }, [monthJobs, searchQuery, sourceFilter, sortOrder])

  // Calculate stats
  const stats = useMemo(() => {
    const totalRevenue = monthJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)
    const totalExpenses = monthJobs.reduce((sum, j) => 
      sum + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + 
      (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)
    const profit = totalRevenue - totalExpenses
    const avgRevenue = monthJobs.length > 0 ? totalRevenue / monthJobs.length : 0
    const sources = [...new Set(monthJobs.map(j => j.source).filter(Boolean))]
    
    return { totalRevenue, totalExpenses, profit, avgRevenue, sources }
  }, [monthJobs])

  const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthValue = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`

  const navigateMonth = (dir: number) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + dir)
    setSelectedMonth(newDate)
  }

  const startAddJob = () => {
    setEditingJob('new')
    setTempCustomers([{ id: Date.now(), name: '', source: '', revenue: 0 }])
    setTempExpenses({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
    setTempDate(new Date().toISOString().split('T')[0])
    setTempNotes('')
    setTempAddress('')
    setShowExpenseDetails(false)
  }

  const startEditJob = (job: AppJob) => {
    setEditingJob(job)
    setTempCustomers([{ id: Date.now(), name: job.customerName, source: job.source || '', revenue: job.revenue }])
    setTempExpenses({
      labor: job.labor,
      gas: job.gas,
      dumpFee: job.dumpFee,
      dumpsterRental: job.dumpsterRental,
      additional: job.additionalExpense
    })
    setTempDate(job.date)
    setTempNotes(job.notes || '')
    setTempAddress(job.address || '')
    const hasExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + (job.dumpsterRental || 0) + (job.additionalExpense || 0) > 0
    setShowExpenseDetails(hasExpenses)
  }

  const cancelForm = () => {
    setEditingJob(null)
    setTempCustomers([])
  }

  const addCustomerRow = () => {
    setTempCustomers([...tempCustomers, { id: Date.now(), name: '', source: '', revenue: 0 }])
  }

  const removeCustomerRow = (index: number) => {
    if (tempCustomers.length > 1) {
      setTempCustomers(tempCustomers.filter((_, i) => i !== index))
    }
  }

  const updateCustomer = (index: number, field: keyof TempCustomer, value: string | number) => {
    const updated = [...tempCustomers]
    updated[index] = { ...updated[index], [field]: value }
    setTempCustomers(updated)
  }

  const saveJobs = async () => {
    const validCustomers = tempCustomers.filter(c => c.name.trim() && c.revenue > 0)
    if (validCustomers.length === 0) {
      await alert({ title: 'Missing Info', message: 'Please add at least one customer with a name and revenue greater than 0.', variant: 'warning' })
      return
    }

    setSaving(true)

    try {
      const isEditing = editingJob && editingJob !== 'new'

      if (isEditing) {
        const customer = validCustomers[0]
        const customerId = await ensureCustomer(supabase, userId, customer.name.trim())
        const dbJob = {
          date: tempDate,
          customer_name: customer.name.trim(),
          customer_id: customerId,
          source: customer.source || null,
          revenue: Math.max(0, customer.revenue),
          labor: Math.max(0, tempExpenses.labor),
          gas: Math.max(0, tempExpenses.gas),
          dump_fee: Math.max(0, tempExpenses.dumpFee),
          dumpster_rental: Math.max(0, tempExpenses.dumpsterRental),
          additional_expense: Math.max(0, tempExpenses.additional),
          notes: tempNotes.trim() || null,
          address: tempAddress.trim() || null,
        }

        const { error } = await supabase
          .from('dyia_jobs')
          .update(dbJob)
          .eq('id', (editingJob as AppJob).id)
          .eq('user_id', userId)

        if (error) throw error

        const jobProfit = customer.revenue - totalExpenses
        setJobs(jobs.map(j => j.id === (editingJob as AppJob).id ? {
          ...j,
          date: tempDate,
          customerId,
          customerName: customer.name.trim(),
          source: customer.source,
          revenue: customer.revenue,
          labor: tempExpenses.labor,
          gas: tempExpenses.gas,
          dumpFee: tempExpenses.dumpFee,
          dumpsterRental: tempExpenses.dumpsterRental,
          additionalExpense: tempExpenses.additional,
          notes: tempNotes.trim(),
        } : j))
        showSuccess(`Job updated — ${formatCurrency(jobProfit)} profit`)
      } else {
        const newJobs: AppJob[] = []
        for (const customer of validCustomers) {
          const expPerCustomer = validCustomers.length
          const customerId = await ensureCustomer(supabase, userId, customer.name.trim())
          const dbJob = {
            user_id: userId,
            date: tempDate,
            customer_name: customer.name.trim(),
            customer_id: customerId,
            source: customer.source || null,
            revenue: Math.max(0, customer.revenue),
            labor: Math.max(0, tempExpenses.labor / expPerCustomer),
            gas: Math.max(0, tempExpenses.gas / expPerCustomer),
            dump_fee: Math.max(0, tempExpenses.dumpFee / expPerCustomer),
            dumpster_rental: Math.max(0, tempExpenses.dumpsterRental / expPerCustomer),
            additional_expense: Math.max(0, tempExpenses.additional / expPerCustomer),
            notes: tempNotes.trim() || null,
            address: tempAddress.trim() || null,
            status: 'completed',
          }

          const { data, error } = await supabase
            .from('dyia_jobs')
            .insert(dbJob)
            .select()
            .single()

          if (error) throw error

          newJobs.push({
            id: data.id,
            date: tempDate,
            customerId,
            customerName: customer.name.trim(),
            source: customer.source,
            revenue: customer.revenue,
            labor: tempExpenses.labor / expPerCustomer,
            gas: tempExpenses.gas / expPerCustomer,
            dumpFee: tempExpenses.dumpFee / expPerCustomer,
            dumpsterRental: tempExpenses.dumpsterRental / expPerCustomer,
            additionalExpense: tempExpenses.additional / expPerCustomer,
            numWorkers: 1,
            costPerWorker: 0,
            notes: tempNotes.trim(),
          })
        }

        setJobs([...newJobs, ...jobs])
        const totalRev = validCustomers.reduce((s, c) => s + c.revenue, 0)
        const totalProf = totalRev - totalExpenses
        showSuccess(`${validCustomers.length === 1 ? 'Job' : `${validCustomers.length} jobs`} saved — ${formatCurrency(totalProf)} profit`)
      }

      cancelForm()
    } catch (error) {
      console.error('Error saving jobs:', error)
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Unknown error'
      await alert({ title: 'Error Saving Job', message: `Something went wrong: ${msg}. Please try again.`, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteJob = async (id: string) => {
    const ok = await confirm({ title: 'Delete Job', message: 'Are you sure you want to delete this job?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('dyia_jobs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      setJobs(jobs.filter(j => j.id !== id))
      showSuccess('Job deleted')
    } catch (error) {
      console.error('Error deleting job:', error)
      await alert({ title: 'Error', message: 'Error deleting job.', variant: 'error' })
    }
  }

  // === LIVE PROFIT CALCULATIONS ===
  const totalExpenses = Object.values(tempExpenses).reduce((sum, e) => sum + (e || 0), 0)
  const totalRevenue = tempCustomers.reduce((sum, c) => sum + (c.revenue || 0), 0)
  const liveProfit = totalRevenue - totalExpenses
  const liveProfitMargin = totalRevenue > 0 ? Math.round((liveProfit / totalRevenue) * 100) : 0
  const taxRate = settings?.taxPercentage || 30
  const liveTaxSetAside = Math.max(0, liveProfit * (taxRate / 100))
  const liveTakeHome = liveProfit - liveTaxSetAside
  const expensePerCustomer = tempCustomers.length > 0 ? totalExpenses / tempCustomers.length : 0

  // ===================== FORM VIEW =====================
  if (editingJob) {
    const isEditing = editingJob !== 'new'

    return (
      <div className="space-y-4 sm:space-y-5 pb-24">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={cancelForm} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition-colors shrink-0">
              <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{isEditing ? 'Edit Job' : 'Log Job'}</h1>
                {isEditing && (
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase">Editing</span>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">{isEditing ? 'Update job details' : 'Log one or multiple customers from the same trip'}</p>
            </div>
          </div>
        </div>

        {/* === LIVE PROFIT PREVIEW === */}
        <div className={`rounded-xl p-4 border-2 transition-colors ${totalRevenue > 0 ? (liveProfit >= 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50') : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)]'}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Revenue</p>
              <p className={`text-lg font-bold ${totalRevenue > 0 ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text-faint)]'}`}>{formatCurrency(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Expenses</p>
              <p className={`text-lg font-bold ${totalExpenses > 0 ? 'text-red-500 dark:text-red-400' : 'text-[var(--color-text-faint)]'}`}>{totalExpenses > 0 ? `-${formatCurrency(totalExpenses)}` : '$0'}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Profit</p>
              <p className={`text-lg font-bold ${totalRevenue > 0 ? (liveProfit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400') : 'text-[var(--color-text-faint)]'}`}>
                {formatCurrency(liveProfit)}
                {liveProfitMargin > 0 && <span className="text-xs font-normal ml-1 opacity-70">{liveProfitMargin}%</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Take Home</p>
              <p className={`text-lg font-bold ${totalRevenue > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-[var(--color-text-faint)]'}`}>
                {formatCurrency(liveTakeHome)}
                {totalRevenue > 0 && <span className="text-xs font-normal ml-1 opacity-70">-{taxRate}% tax</span>}
              </p>
            </div>
          </div>
        </div>

        {/* === CUSTOMER + DATE === */}
        <div className="app-card p-4 sm:p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isEditing ? 'Job Details' : `Customer${tempCustomers.length > 1 ? 's' : ''}`}
              {!isEditing && tempCustomers.length > 1 && <span className="text-[var(--color-text-faint)] font-normal ml-1">({tempCustomers.length})</span>}
            </h3>
            {!isEditing && (
              <button 
                onClick={addCustomerRow} 
                className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium whitespace-nowrap flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Customer
              </button>
            )}
          </div>

          {/* Date field */}
          <div className="mb-4">
            <label className="app-label">Date</label>
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              className="app-input max-w-xs"
            />
          </div>

          <div className="space-y-3">
            {tempCustomers.map((customer, index) => (
              <div 
                key={customer.id} 
                className={`relative ${tempCustomers.length > 1 ? 'bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl p-4' : ''}`}
              >
                {!isEditing && tempCustomers.length > 1 && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">Customer {index + 1} of {tempCustomers.length}</span>
                    <button
                      onClick={() => removeCustomerRow(index)}
                      className="w-6 h-6 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="app-label">Customer Name *</label>
                    <input
                      list={`customer-names-${index}`}
                      type="text"
                      value={customer.name}
                      onChange={(e) => {
                        const name = e.target.value
                        updateCustomer(index, 'name', name)
                        const match = findByName(name)
                        if (match) {
                          if (match.address) setTempAddress(match.address)
                          const lastJob = [...jobs]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .find(j => j.customerName.toLowerCase() === name.trim().toLowerCase())
                          if (lastJob?.source) updateCustomer(index, 'source', lastJob.source)
                        }
                      }}
                      className="app-input"
                      placeholder="John Smith"
                      autoFocus={index === 0}
                    />
                    <datalist id={`customer-names-${index}`}>
                      {customerNameSuggestions.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="app-label">Revenue *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                      <input
                        type="number"
                        value={customer.revenue || ''}
                        onChange={(e) => updateCustomer(index, 'revenue', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="app-input pl-7"
                        placeholder="500"
                        min="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="app-label">Lead Source</label>
                    <select
                      value={customer.source}
                      onChange={(e) => updateCustomer(index, 'source', e.target.value)}
                      className="app-select"
                    >
                      <option value="">Select source</option>
                      {MARKETING_SOURCES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === EXPENSES === */}
        <div className="app-card p-4 sm:p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Expenses
              {totalExpenses > 0 && <span className="text-red-500 font-normal ml-2 text-xs">{formatCurrency(totalExpenses)}</span>}
            </h3>
            {/* Tab-style toggle */}
            <div className="bg-[var(--color-bg-subtle)] rounded-lg p-0.5 inline-flex text-xs">
              <button
                type="button"
                onClick={() => setShowExpenseDetails(false)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${!showExpenseDetails ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
              >
                Quick
              </button>
              <button
                type="button"
                onClick={() => setShowExpenseDetails(true)}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${showExpenseDetails ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
              >
                Itemize
              </button>
            </div>
          </div>

          {!showExpenseDetails ? (
            <div>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                <input
                  type="number"
                  value={totalExpenses || ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0)
                    setTempExpenses({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: val })
                  }}
                  className="app-input pl-7"
                  placeholder="Total expenses for this job"
                  min="0"
                />
              </div>
              <p className="text-xs text-[var(--color-text-faint)] mt-1.5">Enter a lump sum, or switch to &quot;Itemize&quot; for a breakdown</p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { key: 'labor', label: 'Labor' },
                  { key: 'gas', label: 'Gas' },
                  { key: 'dumpFee', label: 'Dump Fee' },
                  { key: 'dumpsterRental', label: 'Dumpster' },
                  { key: 'additional', label: 'Other' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="app-label">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                      <input
                        type="number"
                        value={tempExpenses[key as keyof TempExpenses] || ''}
                        onChange={(e) => setTempExpenses({ ...tempExpenses, [key]: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="app-input pl-7"
                        min="0"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {!isEditing && tempCustomers.length > 1 && totalExpenses > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 rounded-lg p-3 mt-3">
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    <strong>Expense Split:</strong> {formatCurrency(totalExpenses)} ÷ {tempCustomers.length} = <strong>{formatCurrency(expensePerCustomer)}</strong> per customer
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* === ADDRESS & NOTES === */}
        <div className="app-card p-4 sm:p-5 space-y-3">
          <div>
            <label className="app-label">Job Address <span className="text-[var(--color-text-faint)] font-normal text-xs">(optional)</span></label>
            <input
              type="text"
              value={tempAddress}
              onChange={(e) => setTempAddress(e.target.value)}
              className="app-input"
              placeholder="123 Main St, Anytown, ST 12345"
            />
          </div>
          <div>
            <label className="app-label">Notes <span className="text-[var(--color-text-faint)] font-normal text-xs">(optional)</span></label>
            <textarea
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              className="app-input resize-none"
              rows={2}
              placeholder="Basement cleanout, 2nd floor, had to disconnect appliances..."
            />
          </div>
        </div>

        {/* === STICKY SAVE BAR === */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-page)]/95 backdrop-blur-lg border-t border-[var(--color-border)] px-4 py-3 sm:px-6">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            {/* Profit preview in sticky bar */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              {totalRevenue > 0 ? (
                <>
                  <span className="text-[var(--color-text-muted)]">Profit:</span>
                  <span className={`font-bold ${liveProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{formatCurrency(liveProfit)}</span>
                  <span className="text-[var(--color-text-faint)]">|</span>
                  <span className="text-[var(--color-text-muted)]">Take Home:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(liveTakeHome)}</span>
                </>
              ) : (
                <span className="text-[var(--color-text-faint)]">Enter revenue to see profit</span>
              )}
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <button onClick={cancelForm} className="app-btn-secondary flex-1 sm:flex-none text-sm py-2.5 px-4">
                Cancel
              </button>
              <button 
                onClick={saveJobs} 
                disabled={saving} 
                className="app-btn-primary flex-1 sm:flex-none text-sm py-2.5 px-5"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>Save {tempCustomers.length > 1 ? `${tempCustomers.length} Jobs` : 'Job'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ===================== LIST VIEW =====================
  return (
    <div className="page-content">
      {/* AI Insight Strip */}
      {jobs.length > 2 && <DyiaInsight context="jobs" isPro={isPro} />}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">{monthName}</p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenDyiaWithPrompt && (
            <DyiaActionButton
              variant="compact"
              label="Log with Dyia"
              prompt={DYIA_PROMPTS.logJob}
              onClick={onOpenDyiaWithPrompt}
              isPro={isPro}
            />
          )}
          <button onClick={startAddJob} className="app-btn-primary text-sm py-2.5 px-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Job
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-card-label">Jobs</p>
          <p className="stat-card-value">{monthJobs.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Revenue</p>
          <p className="stat-card-value text-green-600 dark:text-green-400">{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Expenses</p>
          <p className="stat-card-value text-red-500 dark:text-red-400">{formatCurrency(stats.totalExpenses)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Profit</p>
          <p className={`stat-card-value ${stats.profit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(stats.profit)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Month Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button 
            onClick={() => navigateMonth(-1)} 
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] shrink-0 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-')
              setSelectedMonth(new Date(parseInt(year), parseInt(month) -1, 1))
            }}
            className="filter-search-input !w-auto !pl-3"
          />
          <button 
            onClick={() => navigateMonth(1)} 
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] shrink-0 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button 
            onClick={() => setSelectedMonth(new Date())} 
            className="px-3 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] font-medium text-xs shrink-0 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Search & Filter */}
        <div className="filter-toolbar">
          <div className="filter-search">
            <svg className="filter-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="filter-search-input"
            />
          </div>
          {stats.sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="app-select !py-2.5 max-w-[150px]"
            >
              <option value="all">All sources</option>
              {stats.sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="app-select !py-2.5 max-w-[170px]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="rev-desc">Revenue: High→Low</option>
            <option value="rev-asc">Revenue: Low→High</option>
          </select>
        </div>
      </div>

      {/* Jobs List */}
      <div className="content-list">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-10 px-6">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
              {searchQuery || sourceFilter !== 'all' ? 'No matching jobs' : 'No jobs this month'}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {searchQuery || sourceFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : `Start by logging your first job for ${monthName}`}
            </p>
            {!searchQuery && sourceFilter === 'all' && (
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={startAddJob} className="app-btn-primary text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Log Job Manually
                </button>
                {onOpenDyiaWithPrompt && (
                  <DyiaActionButton
                    label="Log with Dyia"
                    prompt={DYIA_PROMPTS.logJob}
                    onClick={onOpenDyiaWithPrompt}
                    isPro={isPro}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            {filteredJobs.map((job) => {
              const jobExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) +
                                   (job.dumpsterRental || 0) + (job.additionalExpense || 0)
              const profit = (job.revenue || 0) - jobExpenses
              const margin = job.revenue > 0 ? Math.round((profit / job.revenue) * 100) : 0

              return (
                <div 
                  key={job.id} 
                  className="content-list-item"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                      <span className="text-xs font-bold">{margin}%</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{job.customerName}</p>
                        {job.source && (
                          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full shrink-0">{job.source}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <span>{new Date(job.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {job.notes && <span className="truncate max-w-[150px] hidden sm:inline">· {job.notes}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(job.revenue)}</p>
                      <p className="text-[10px] text-[var(--color-text-faint)] hidden sm:block">{formatCurrency(profit)} profit</p>
                    </div>
                    <div className="flex gap-0.5">
                      {settings && (
                        <button
                          onClick={() => { setReviewModalJob(job); setReviewPlatform(REVIEW_PLATFORMS[0]); setReviewCopied(false) }}
                          className="p-1.5 text-[var(--color-text-faint)] hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                          title="Request review"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      )}
                      <button 
                        onClick={() => startEditJob(job)} 
                        className="p-1.5 text-[var(--color-text-faint)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => deleteJob(job.id)} 
                        className="p-1.5 text-[var(--color-text-faint)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Request Review modal */}
      {reviewModalJob && settings && (
        <div className="modal-overlay" onClick={() => setReviewModalJob(null)}>
          <div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title">Request review</h3>
            <p className="modal-description">Copy the message and send it to {reviewModalJob.customerName} (e.g. by text or email).</p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Platform</label>
              <select
                value={reviewPlatform}
                onChange={(e) => setReviewPlatform(e.target.value)}
                className="app-input w-full"
              >
                {REVIEW_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Message</label>
              <textarea
                readOnly
                rows={4}
                value={getReviewRequestMessage(reviewModalJob.customerName, settings.businessInfo, reviewPlatform)}
                className="app-input w-full resize-none text-sm"
              />
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={async () => {
                  const msg = getReviewRequestMessage(reviewModalJob.customerName, settings.businessInfo, reviewPlatform)
                  await navigator.clipboard.writeText(msg)
                  setReviewCopied(true)
                  showSuccess('Copied to clipboard')
                  try {
                    await fetch('/api/review-requests', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        quoteId: null,
                        customerName: reviewModalJob.customerName,
                        platform: reviewPlatform,
                      }),
                    })
                  } catch { /* ignore */ }
                }}
                className="app-btn-primary flex-1"
              >
                {reviewCopied ? 'Copied!' : 'Copy & record'}
              </button>
              <button type="button" onClick={() => setReviewModalJob(null)} className="app-btn-secondary">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
