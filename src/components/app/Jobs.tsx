'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppJob, AppSettings } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { getReviewRequestMessage } from '@/lib/reviews'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useCustomerAutocomplete } from '@/hooks/useCustomerAutocomplete'
import { DyiaInsight } from './DyiaInsight'
import { upsertCustomer } from '@/lib/customers'
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
  const [hasCheckedMonth, setHasCheckedMonth] = useState(false)
  const [reviewModalJob, setReviewModalJob] = useState<AppJob | null>(null)
  const [reviewPlatform, setReviewPlatform] = useState<string>(REVIEW_PLATFORMS[0])
  const [reviewCopied, setReviewCopied] = useState(false)
  const [showExpenseDetails, setShowExpenseDetails] = useState(false)
  const [closeDayDate, setCloseDayDate] = useState<string | null>(null)
  const [closeDayExpenses, setCloseDayExpenses] = useState({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
  const [closeDaySaving, setCloseDaySaving] = useState(false)
  const [closeDayResult, setCloseDayResult] = useState<{ revenue: number; expenses: number; profit: number; jobCount: number; avgRevenue: number; avgProfit: number } | null>(null)
  const [tempReceiptUrl, setTempReceiptUrl] = useState<string | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [nudgeDismissedDays, setNudgeDismissedDays] = useState<Record<string, boolean>>({})
  const [nudgeDismissedReceipts, setNudgeDismissedReceipts] = useState(false)

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
  const { nameList: customerNameSuggestions } = useCustomerAutocomplete(jobNamesFallback)

  const filteredJobs = useMemo(() => {
    return monthJobs.filter(job => {
      const matchesSearch = searchQuery === '' || 
        job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.source && job.source.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesSource = sourceFilter === 'all' || job.source === sourceFilter
      return matchesSearch && matchesSource
    })
  }, [monthJobs, searchQuery, sourceFilter])

  // Days in current month that have jobs but no expenses logged (for nudge)
  const daysWithoutExpenses = useMemo(() => {
    const byDate = new Map<string, { revenue: number; expenses: number }>()
    monthJobs.forEach(j => {
      const rev = (j.revenue || 0)
      const exp = (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + (j.dumpsterRental || 0) + (j.additionalExpense || 0)
      const cur = byDate.get(j.date) || { revenue: 0, expenses: 0 }
      byDate.set(j.date, { revenue: cur.revenue + rev, expenses: cur.expenses + exp })
    })
    return Array.from(byDate.entries())
      .filter(([, v]) => v.revenue > 0 && v.expenses === 0)
      .map(([date]) => date)
  }, [monthJobs])

  const jobsWithoutReceiptCount = useMemo(() => monthJobs.filter(j => !j.receiptUrl?.trim()).length, [monthJobs])

  // Group filtered jobs by date for day-based workflow (newest first)
  const jobsByDay = useMemo(() => {
    const map = new Map<string, AppJob[]>()
    filteredJobs.forEach(job => {
      const list = map.get(job.date) || []
      list.push(job)
      map.set(job.date, list)
    })
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredJobs])

  const openCloseDayModal = (date: string) => {
    setCloseDayDate(date)
    setCloseDayResult(null)
    const dayJobs = filteredJobs.filter(j => j.date === date)
    const existingLabor = dayJobs.reduce((s, j) => s + (j.labor || 0), 0)
    const existingGas = dayJobs.reduce((s, j) => s + (j.gas || 0), 0)
    const existingDump = dayJobs.reduce((s, j) => s + (j.dumpFee || 0), 0)
    const existingDumpster = dayJobs.reduce((s, j) => s + (j.dumpsterRental || 0), 0)
    const existingOther = dayJobs.reduce((s, j) => s + (j.additionalExpense || 0), 0)
    setCloseDayExpenses({
      labor: existingLabor,
      gas: existingGas,
      dumpFee: existingDump,
      dumpsterRental: existingDumpster,
      additional: existingOther,
    })
  }

  const applyDailyExpenses = async () => {
    if (!closeDayDate) return
    const dayJobs = jobs.filter(j => j.date === closeDayDate)
    if (dayJobs.length === 0) return

    const totalLabor = Math.max(0, closeDayExpenses.labor)
    const totalGas = Math.max(0, closeDayExpenses.gas)
    const totalDumpFee = Math.max(0, closeDayExpenses.dumpFee)
    const totalDumpster = Math.max(0, closeDayExpenses.dumpsterRental)
    const totalAdditional = Math.max(0, closeDayExpenses.additional)
    const totalExpenses = totalLabor + totalGas + totalDumpFee + totalDumpster + totalAdditional
    const dayRevenue = dayJobs.reduce((s, j) => s + (j.revenue || 0), 0)

    setCloseDaySaving(true)
    try {
      if (dayRevenue <= 0) {
        await alert({ title: 'No revenue', message: 'Allocate expenses proportionally by revenue. Add revenue to jobs first or split evenly.', variant: 'warning' })
        setCloseDaySaving(false)
        return
      }

      const updates = dayJobs.map(job => {
        const share = (job.revenue || 0) / dayRevenue
        return {
          id: job.id,
          labor: Math.round(totalLabor * share * 100) / 100,
          gas: Math.round(totalGas * share * 100) / 100,
          dump_fee: Math.round(totalDumpFee * share * 100) / 100,
          dumpster_rental: Math.round(totalDumpster * share * 100) / 100,
          additional_expense: Math.round(totalAdditional * share * 100) / 100,
        }
      })

      for (const u of updates) {
        const { error } = await supabase
          .from('dyia_jobs')
          .update({
            labor: u.labor,
            gas: u.gas,
            dump_fee: u.dump_fee,
            dumpster_rental: u.dumpster_rental,
            additional_expense: u.additional_expense,
          })
          .eq('id', u.id)
          .eq('user_id', userId)
        if (error) throw error
      }

      setJobs(jobs.map(j => {
        const u = updates.find(x => x.id === j.id)
        if (!u) return j
        return {
          ...j,
          labor: u.labor,
          gas: u.gas,
          dumpFee: u.dump_fee,
          dumpsterRental: u.dumpster_rental,
          additionalExpense: u.additional_expense,
        }
      }))

      const profit = dayRevenue - totalExpenses
      const avgRevenue = dayJobs.length > 0 ? dayRevenue / dayJobs.length : 0
      const avgProfit = dayJobs.length > 0 ? profit / dayJobs.length : 0
      setCloseDayResult({
        revenue: dayRevenue,
        expenses: totalExpenses,
        profit,
        jobCount: dayJobs.length,
        avgRevenue,
        avgProfit,
      })
      showSuccess(`Daily expenses applied — ${formatCurrency(profit)} profit (${dayJobs.length} jobs)`)
    } catch (err) {
      console.error('Apply daily expenses error:', err)
      await alert({ title: 'Error', message: 'Failed to apply daily expenses.', variant: 'error' })
    } finally {
      setCloseDaySaving(false)
    }
  }

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
    setTempReceiptUrl(null)
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
    setTempReceiptUrl(job.receiptUrl ?? null)
    const hasExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + (job.dumpsterRental || 0) + (job.additionalExpense || 0) > 0
    setShowExpenseDetails(hasExpenses)
  }

  const cancelForm = () => {
    setEditingJob(null)
    setTempCustomers([])
  }

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      await alert({ title: 'File too large', message: 'Receipt must be under 10MB.', variant: 'warning' })
      return
    }
    setUploadingReceipt(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setTempReceiptUrl(data.url)
      showSuccess('Receipt uploaded')
    } catch (err) {
      await alert({ title: 'Upload failed', message: err instanceof Error ? err.message : 'Could not upload receipt.', variant: 'error' })
    } finally {
      setUploadingReceipt(false)
      e.target.value = ''
    }
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
        const dbJob = {
          date: tempDate,
          customer_name: customer.name.trim(),
          source: customer.source || null,
          revenue: Math.max(0, customer.revenue),
          labor: Math.max(0, tempExpenses.labor),
          gas: Math.max(0, tempExpenses.gas),
          dump_fee: Math.max(0, tempExpenses.dumpFee),
          dumpster_rental: Math.max(0, tempExpenses.dumpsterRental),
          additional_expense: Math.max(0, tempExpenses.additional),
          notes: tempNotes.trim() || null,
          address: tempAddress.trim() || null,
          receipt_url: tempReceiptUrl?.trim() || null,
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
          customerName: customer.name.trim(),
          source: customer.source,
          revenue: customer.revenue,
          labor: tempExpenses.labor,
          gas: tempExpenses.gas,
          dumpFee: tempExpenses.dumpFee,
          dumpsterRental: tempExpenses.dumpsterRental,
          additionalExpense: tempExpenses.additional,
          notes: tempNotes.trim(),
          address: tempAddress.trim() || undefined,
          receiptUrl: tempReceiptUrl?.trim() || undefined,
        } : j))
        showSuccess(`Job updated — ${formatCurrency(jobProfit)} profit`)
      } else {
        const newJobs: AppJob[] = []
        for (const customer of validCustomers) {
          const expPerCustomer = validCustomers.length
          const dbJob = {
            user_id: userId,
            date: tempDate,
            customer_name: customer.name.trim(),
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
            address: tempAddress.trim() || undefined,
            receiptUrl: undefined,
          })
        }

        setJobs([...newJobs, ...jobs])
        const totalRev = validCustomers.reduce((s, c) => s + c.revenue, 0)
        const totalProf = totalRev - totalExpenses
        showSuccess(`${validCustomers.length === 1 ? 'Job' : `${validCustomers.length} jobs`} saved — ${formatCurrency(totalProf)} profit`)

        // Auto-sync customers (fire and forget)
        for (const customer of validCustomers) {
          upsertCustomer(supabase, userId, customer.name.trim()).catch(() => {})
        }
      }

      cancelForm()
    } catch (error) {
      console.error('Error saving jobs:', error)
      await alert({ title: 'Error', message: 'Error saving jobs.', variant: 'error' })
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
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{isEditing ? 'Edit Job' : 'Log Job'}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">{isEditing ? 'Update job details' : 'Log one or multiple customers from the same trip'}</p>
          </div>
          <button onClick={cancelForm} className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-[var(--color-text-primary)] shrink-0">
            Cancel
          </button>
        </div>

        {/* === LIVE PROFIT PREVIEW === */}
        {totalRevenue > 0 && (
          <div className={`rounded-xl p-4 border-2 transition-colors ${liveProfit >= 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50'}`}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Revenue</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(totalRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Expenses</p>
                <p className="text-lg font-bold text-red-500 dark:text-red-400">{totalExpenses > 0 ? `-${formatCurrency(totalExpenses)}` : '$0'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Profit</p>
                <p className={`text-lg font-bold ${liveProfit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(liveProfit)}
                  {liveProfitMargin > 0 && <span className="text-xs font-normal ml-1 opacity-70">{liveProfitMargin}%</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Take Home</p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(liveTakeHome)}
                  <span className="text-xs font-normal ml-1 opacity-70">-{taxRate}% tax</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* === CUSTOMER + DATE === */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isEditing ? 'Job Details' : `Customer${tempCustomers.length > 1 ? 's' : ''}`}
              {!isEditing && tempCustomers.length > 1 && <span className="text-[var(--color-text-faint)] font-normal ml-1">({tempCustomers.length})</span>}
            </h3>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={tempDate}
                onChange={(e) => setTempDate(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
              />
              {!isEditing && (
                <button 
                  onClick={addCustomerRow} 
                  className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium whitespace-nowrap"
                >
                  + Add Another
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {tempCustomers.map((customer, index) => (
              <div 
                key={customer.id} 
                className={`relative ${tempCustomers.length > 1 ? 'bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl p-4' : ''}`}
              >
                {!isEditing && tempCustomers.length > 1 && (
                  <button
                    onClick={() => removeCustomerRow(index)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Customer Name *</label>
                    <input
                      list={`customer-names-${index}`}
                      type="text"
                      value={customer.name}
                      onChange={(e) => updateCustomer(index, 'name', e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                      placeholder="John Smith"
                      autoFocus={index === 0}
                    />
                    <datalist id={`customer-names-${index}`}>
                      {customerNameSuggestions.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Revenue *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                      <input
                        type="number"
                        value={customer.revenue || ''}
                        onChange={(e) => updateCustomer(index, 'revenue', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-3 py-2.5 pl-7 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                        placeholder="500"
                        min="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Lead Source</label>
                    <select
                      value={customer.source}
                      onChange={(e) => updateCustomer(index, 'source', e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
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

        {/* === EXPENSES (collapsible quick-entry) === */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isEditing ? 'Expenses' : 'Expenses'}
              {totalExpenses > 0 && <span className="text-red-500 font-normal ml-2 text-xs">{formatCurrency(totalExpenses)}</span>}
            </h3>
            <button 
              type="button"
              onClick={() => setShowExpenseDetails(!showExpenseDetails)}
              className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 font-medium flex items-center gap-1"
            >
              {showExpenseDetails ? 'Collapse' : 'Itemize'}
              <svg className={`w-3.5 h-3.5 transition-transform ${showExpenseDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {!showExpenseDetails ? (
            /* Quick total entry */
            <div className="mt-3">
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                <input
                  type="number"
                  value={totalExpenses || ''}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0)
                    setTempExpenses({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: val })
                  }}
                  className="w-full px-3 py-2.5 pl-7 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                  placeholder="Total expenses for this job"
                  min="0"
                />
              </div>
              <p className="text-xs text-[var(--color-text-faint)] mt-1.5">Quick entry — or click &quot;Itemize&quot; to break down by category</p>
            </div>
          ) : (
            /* Detailed breakdown */
            <div className="mt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  { key: 'labor', label: 'Labor' },
                  { key: 'gas', label: 'Gas' },
                  { key: 'dumpFee', label: 'Dump Fee' },
                  { key: 'dumpsterRental', label: 'Dumpster' },
                  { key: 'additional', label: 'Other' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                      <input
                        type="number"
                        value={tempExpenses[key as keyof TempExpenses] || ''}
                        onChange={(e) => setTempExpenses({ ...tempExpenses, [key]: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full px-3 py-2.5 pl-7 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
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
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 space-y-3">
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Job Address <span className="text-[var(--color-text-faint)] font-normal">(optional)</span></label>
            <input
              type="text"
              value={tempAddress}
              onChange={(e) => setTempAddress(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
              placeholder="123 Main St, Anytown, ST 12345"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">Notes <span className="text-[var(--color-text-faint)] font-normal">(optional)</span></label>
            <textarea
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              className="w-full px-3 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm resize-none"
              rows={2}
              placeholder="Basement cleanout, 2nd floor, had to disconnect appliances..."
            />
          </div>
        </div>

        {/* === RECEIPT === */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5 space-y-2">
          <label className="block text-sm font-semibold text-[var(--color-text-primary)]">Receipt <span className="text-[var(--color-text-faint)] font-normal">(optional)</span></label>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Upload a photo or PDF of the receipt for this job to keep records in one place.</p>
          {tempReceiptUrl ? (
            <div className="flex items-center gap-3 flex-wrap">
              <a href={tempReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-600 dark:text-orange-400 hover:underline truncate max-w-[200px]">
                View receipt
              </a>
              <button type="button" onClick={() => setTempReceiptUrl(null)} className="text-xs text-[var(--color-text-muted)] hover:text-red-500">Remove</button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] cursor-pointer text-sm">
              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={handleReceiptUpload} disabled={uploadingReceipt} />
              {uploadingReceipt ? (
                <>
                  <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload receipt (image or PDF, max 10MB)
                </>
              )}
            </label>
          )}
        </div>

        {/* === ACTIONS === */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button onClick={cancelForm} className="w-full sm:w-auto px-5 py-2.5 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] font-medium text-sm">
            Cancel
          </button>
          <button 
            onClick={saveJobs} 
            disabled={saving} 
            className="w-full sm:w-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2"
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
    )
  }

  // ===================== LIST VIEW =====================
  return (
    <div className="space-y-4 sm:space-y-6 animate-view-enter">
      {/* AI Insight Strip */}
      {jobs.length > 2 && <DyiaInsight context="jobs" isPro={isPro} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">Jobs</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{monthName}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {onOpenDyiaWithPrompt && (
            <DyiaActionButton
              variant="compact"
              label="Log with Dyia"
              prompt={DYIA_PROMPTS.logJob}
              onClick={onOpenDyiaWithPrompt}
              isPro={isPro}
            />
          )}
          <button 
            onClick={startAddJob} 
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-all flex-1 sm:flex-initial"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Job
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3 sm:p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Jobs</p>
          <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{monthJobs.length}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3 sm:p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Revenue</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3 sm:p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Expenses</p>
          <p className="text-xl sm:text-2xl font-bold text-red-500 dark:text-red-400">{formatCurrency(stats.totalExpenses)}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-3 sm:p-4">
          <p className="text-xs text-[var(--color-text-muted)]">Profit</p>
          <p className={`text-xl sm:text-2xl font-bold ${stats.profit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(stats.profit)}
          </p>
        </div>
      </div>

      {/* Daily expense confirmation nudge */}
      {daysWithoutExpenses.length > 0 && !nudgeDismissedDays[monthValue] && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-900/20">
          <span className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              {daysWithoutExpenses.length} {daysWithoutExpenses.length === 1 ? 'day has' : 'days have'} jobs without expenses logged
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
              Log daily expenses to see accurate profit and keep records tidy.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  openCloseDayModal(daysWithoutExpenses[0])
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium"
              >
                Log daily expenses
              </button>
              <button
                type="button"
                onClick={() => setNudgeDismissedDays(prev => ({ ...prev, [monthValue]: true }))}
                className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt upload nudge */}
      {jobsWithoutReceiptCount > 0 && !nudgeDismissedReceipts && monthJobs.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/40">
          <span className="text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" aria-hidden>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {jobsWithoutReceiptCount} {jobsWithoutReceiptCount === 1 ? 'job has' : 'jobs have'} no receipt
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Add receipts when editing a job to keep everything in one place for taxes and records.
            </p>
            <button
              type="button"
              onClick={() => setNudgeDismissedReceipts(true)}
              className="text-xs text-slate-600 dark:text-slate-400 hover:underline mt-2"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        {/* Month Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button 
            onClick={() => navigateMonth(-1)} 
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] shrink-0"
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
            className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg font-medium text-sm min-w-0"
          />
          <button 
            onClick={() => navigateMonth(1)} 
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button 
            onClick={() => setSelectedMonth(new Date())} 
            className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] font-medium text-xs shrink-0"
          >
            Today
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
            />
          </div>
          {stats.sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm min-w-0 max-w-[130px]"
            >
              <option value="all">All sources</option>
              {stats.sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Jobs List — grouped by day with "Log daily expenses" per day */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
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
                <button onClick={startAddJob} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-all">
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
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {jobsByDay.map(([date, dayJobs]) => {
              const dayRevenue = dayJobs.reduce((s, j) => s + (j.revenue || 0), 0)
              const dayExpenses = dayJobs.reduce((s, j) => s + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)
              const dayProfit = dayRevenue - dayExpenses
              const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

              return (
                <div key={date}>
                  {/* Day header with "Log daily expenses" */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{dayLabel}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}</span>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">{formatCurrency(dayRevenue)} rev</span>
                      {dayExpenses > 0 && (
                        <span className="text-xs text-[var(--color-text-muted)]">{formatCurrency(dayProfit)} profit</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openCloseDayModal(date)}
                      className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline"
                    >
                      {dayExpenses > 0 ? 'Edit daily expenses' : 'Log daily expenses'}
                    </button>
                  </div>
                  {dayJobs.map((job) => {
                    const jobExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) +
                                         (job.dumpsterRental || 0) + (job.additionalExpense || 0)
                    const profit = (job.revenue || 0) - jobExpenses
                    const margin = job.revenue > 0 ? Math.round((profit / job.revenue) * 100) : 0

                    return (
                      <div 
                        key={job.id} 
                        className="flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--color-bg-subtle)] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                            <span className="text-xs font-bold">{margin}%</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{job.customerName}</p>
                              {job.source && (
                                <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full shrink-0">{job.source}</span>
                              )}
                              {job.receiptUrl ? (
                                <a href={job.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400" title="View receipt">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  Receipt
                                </a>
                              ) : (
                                <button type="button" onClick={() => startEditJob(job)} className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400" title="Add receipt">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                  </svg>
                                  Add receipt
                                </button>
                              )}
                            </div>
                            {job.notes && (
                              <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[200px]">{job.notes}</div>
                            )}
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
              )
            })}
          </div>
        )}
      </div>

      {/* Close day / Log daily expenses modal */}
      {closeDayDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !closeDaySaving && setCloseDayDate(null)}>
          <div
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {closeDayResult ? 'Day summary' : 'Log daily expenses'}
              </h3>
              {!closeDaySaving && (
                <button type="button" onClick={() => setCloseDayDate(null)} className="p-1.5 text-[var(--color-text-faint)] hover:bg-[var(--color-bg-subtle)] rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              {new Date(closeDayDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>

            {closeDayResult ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--color-bg-subtle)] rounded-xl p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">Total revenue</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(closeDayResult.revenue)}</p>
                  </div>
                  <div className="bg-[var(--color-bg-subtle)] rounded-xl p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">Total expenses</p>
                    <p className="text-lg font-bold text-red-500 dark:text-red-400">{formatCurrency(closeDayResult.expenses)}</p>
                  </div>
                  <div className="bg-[var(--color-bg-subtle)] rounded-xl p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">Daily profit</p>
                    <p className={`text-lg font-bold ${closeDayResult.profit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(closeDayResult.profit)}
                    </p>
                  </div>
                  <div className="bg-[var(--color-bg-subtle)] rounded-xl p-3">
                    <p className="text-xs text-[var(--color-text-muted)]">Per-job average</p>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(closeDayResult.avgRevenue)} rev</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(closeDayResult.avgProfit)} profit</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Expenses were allocated across {closeDayResult.jobCount} job{closeDayResult.jobCount !== 1 ? 's' : ''} proportionally by revenue.
                </p>
                <button type="button" onClick={() => setCloseDayDate(null)} className="w-full app-btn-primary py-2.5">Done</button>
              </div>
            ) : (
              <>
                {(() => {
                  const dayJobsList = jobs.filter(j => j.date === closeDayDate)
                  return (
                    <>
                      <div className="mb-4">
                        <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Jobs this day ({dayJobsList.length})</p>
                        <ul className="space-y-1 max-h-24 overflow-y-auto">
                          {dayJobsList.map(j => (
                            <li key={j.id} className="flex justify-between text-sm">
                              <span className="truncate">{j.customerName}</span>
                              <span className="text-green-600 dark:text-green-400 shrink-0 ml-2">{formatCurrency(j.revenue)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mb-3">Enter total expenses for the day. They will be split across jobs by revenue share.</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                        {[
                          { key: 'labor' as const, label: 'Labor' },
                          { key: 'gas' as const, label: 'Gas' },
                          { key: 'dumpFee' as const, label: 'Dump fee' },
                          { key: 'dumpsterRental' as const, label: 'Dumpster' },
                          { key: 'additional' as const, label: 'Other' },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">{label}</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                              <input
                                type="number"
                                min={0}
                                value={closeDayExpenses[key] || ''}
                                onChange={(e) => setCloseDayExpenses(prev => ({ ...prev, [key]: Math.max(0, parseFloat(e.target.value) || 0) }))}
                                className="w-full pl-7 pr-2 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCloseDayDate(null)} disabled={closeDaySaving} className="app-btn-secondary flex-1 py-2.5">Cancel</button>
                        <button type="button" onClick={applyDailyExpenses} disabled={closeDaySaving} className="app-btn-primary flex-1 py-2.5 disabled:opacity-50 flex items-center justify-center gap-2">
                          {closeDaySaving ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Applying…
                            </>
                          ) : (
                            'Apply & calculate'
                          )}
                        </button>
                      </div>
                    </>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Request Review modal */}
      {reviewModalJob && settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setReviewModalJob(null)}>
          <div
            className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Request review</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">Copy the message and send it to {reviewModalJob.customerName} (e.g. by text or email).</p>
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
            <div className="flex gap-2">
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
