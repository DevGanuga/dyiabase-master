'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppJob, AppSettings, ScheduledJobKind } from '@/types/database'
import { formatCurrency, formatLocalDateInput, mergeAdditionalExpenseLabelIntoNotes, parseLocalDate } from '@/lib/utils'
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
  isDemoMode?: boolean
  selectedMonth: Date
  setSelectedMonth: (date: Date) => void
  settings?: AppSettings
  showSuccess: (message: string) => void
  onOpenDyiaWithPrompt?: (prompt: string) => void
  isPro?: boolean
  initialCloseDayDate?: string | null
  onCloseDayDateConsumed?: () => void
  initialDraftDate?: string | null
  initialDraftStatus?: AppJob['status'] | null
  onDraftConsumed?: () => void
}

interface TempCustomer {
  id: number
  name: string
  source: string
  revenue: number
  phone: string
  email: string
}

interface TempExpenses {
  labor: number
  gas: number
  dumpFee: number
  dumpsterRental: number
  additional: number
}

const MARKETING_SOURCES = ['Google', 'Facebook', 'Referral', 'Repeat Customer', 'Yelp', 'Craigslist', 'Instagram', 'Nextdoor', 'Thumbtack', 'HomeAdvisor', 'Website', 'Other']

export function Jobs({ jobs, setJobs, userId, isDemoMode = false, selectedMonth, setSelectedMonth, settings, showSuccess, onOpenDyiaWithPrompt, isPro = true, initialCloseDayDate, onCloseDayDateConsumed, initialDraftDate, initialDraftStatus, onDraftConsumed }: JobsProps) {
  const [editingJob, setEditingJob] = useState<AppJob | 'new' | null>(null)
  const [tempCustomers, setTempCustomers] = useState<TempCustomer[]>([])
  const [tempExpenses, setTempExpenses] = useState<TempExpenses>({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
  const [tempOtherLabel, setTempOtherLabel] = useState('')
  const [tempStatus, setTempStatus] = useState<AppJob['status']>('completed')
  const [tempScheduledKind, setTempScheduledKind] = useState<'job' | 'estimate' | 'free_estimate'>('job')
  const [tempAppointmentWindow, setTempAppointmentWindow] = useState('')
  const [tempEstimateLow, setTempEstimateLow] = useState(0)
  const [tempEstimateHigh, setTempEstimateHigh] = useState(0)
  const [tempDate, setTempDate] = useState(formatLocalDateInput())
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
  const [reviewSending, setReviewSending] = useState(false)
  const [emailConnection, setEmailConnection] = useState<{ id: string; provider: string; email: string } | null>(null)
  const [showExpenseDetails, setShowExpenseDetails] = useState(false)
  const [closeDayDate, setCloseDayDate] = useState<string | null>(null)
  const [closeDayExpenses, setCloseDayExpenses] = useState({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
  const [closeDayOtherLabel, setCloseDayOtherLabel] = useState('')
  const [closeDaySaving, setCloseDaySaving] = useState(false)
  const [closeDayResult, setCloseDayResult] = useState<{ revenue: number; expenses: number; profit: number; jobCount: number; avgRevenue: number; avgProfit: number } | null>(null)
  const [nudgeDismissedDays, setNudgeDismissedDays] = useState<Record<string, boolean>>({})
  const [closedOutDays, setClosedOutDays] = useState<Record<string, boolean>>({})
  const [activeAutocomplete, setActiveAutocomplete] = useState<number | null>(null)
  const [showContactFields, setShowContactFields] = useState<Record<number, boolean>>({})

  const supabase = createClient()
  const { confirm, alert } = useConfirm()
  
  useEffect(() => {
    if (isDemoMode) return
    fetch('/api/email/connections')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const conn = data?.connections?.[0]
        if (conn) setEmailConnection({ id: conn.id, provider: conn.provider, email: conn.emailAddress })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  }, [])

  // Auto-navigate to most recent job's month if current month has no jobs (on initial load)
  useEffect(() => {
    if (hasCheckedMonth || jobs.length === 0) return
    
    const currentMonthJobs = jobs.filter(job => {
      const jobDate = parseLocalDate(job.date)
      return jobDate.getMonth() === selectedMonth.getMonth() &&
             jobDate.getFullYear() === selectedMonth.getFullYear()
    })
    
    if (currentMonthJobs.length === 0) {
      const sortedJobs = [...jobs].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
      if (sortedJobs.length > 0) {
        const mostRecentDate = parseLocalDate(sortedJobs[0].date)
        setSelectedMonth(new Date(mostRecentDate.getFullYear(), mostRecentDate.getMonth(), 1))
      }
    }
    setHasCheckedMonth(true)
  }, [jobs, selectedMonth, hasCheckedMonth, setSelectedMonth])

  useEffect(() => {
    if (!initialCloseDayDate) return
    const targetDate = parseLocalDate(initialCloseDayDate)
    setSelectedMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1))
    openCloseDayModal(initialCloseDayDate)
    onCloseDayDateConsumed?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when initialCloseDayDate changes
  }, [initialCloseDayDate])

  useEffect(() => {
    if (!initialDraftDate) return
    const targetDate = parseLocalDate(initialDraftDate)
    setSelectedMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1))
    startAddJob(initialDraftDate, initialDraftStatus || 'scheduled')
    onDraftConsumed?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when calendar draft trigger changes
  }, [initialDraftDate, initialDraftStatus])

  // Filter jobs by month
  const monthJobs = useMemo(() => {
    return jobs.filter(job => {
      const jobDate = parseLocalDate(job.date)
      return jobDate.getMonth() === selectedMonth.getMonth() &&
             jobDate.getFullYear() === selectedMonth.getFullYear()
    }).sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
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
  const { suggestions: customerSuggestions, findByName } = useCustomerAutocomplete(jobNamesFallback)

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
        return [...filtered].sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime())
      case 'rev-desc':
        return [...filtered].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
      case 'rev-asc':
        return [...filtered].sort((a, b) => (a.revenue || 0) - (b.revenue || 0))
      default:
        return filtered
    }
  }, [monthJobs, searchQuery, sourceFilter, sortOrder])

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
      .filter(([date, v]) => v.revenue > 0 && v.expenses === 0 && !closedOutDays[date])
      .map(([date]) => date)
  }, [monthJobs, closedOutDays])

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
    const dayJobs = jobs.filter(j => j.date === date)
    const existingLabor = dayJobs.reduce((s, j) => s + (j.labor || 0), 0)
    const existingGas = dayJobs.reduce((s, j) => s + (j.gas || 0), 0)
    const existingDump = dayJobs.reduce((s, j) => s + (j.dumpFee || 0), 0)
    const existingDumpster = dayJobs.reduce((s, j) => s + (j.dumpsterRental || 0), 0)
    const existingOther = dayJobs.reduce((s, j) => s + (j.additionalExpense || 0), 0)
    const additionalExpenseLabels = [...new Set(dayJobs.map(j => j.additionalExpenseLabel?.trim()).filter(Boolean))]
    setCloseDayExpenses({
      labor: existingLabor,
      gas: existingGas,
      dumpFee: existingDump,
      dumpsterRental: existingDumpster,
      additional: existingOther,
    })
    setCloseDayOtherLabel(additionalExpenseLabels.length === 1 ? additionalExpenseLabels[0] || '' : '')
  }

  const applyDailyExpenses = async () => {
    if (!closeDayDate) return
    const dayJobs = jobs.filter(j => j.date === closeDayDate && j.status !== 'scheduled')
    if (dayJobs.length === 0) return

    const totalLabor = Math.max(0, closeDayExpenses.labor)
    const totalGas = Math.max(0, closeDayExpenses.gas)
    const totalDumpFee = Math.max(0, closeDayExpenses.dumpFee)
    const totalDumpster = Math.max(0, closeDayExpenses.dumpsterRental)
    const totalAdditional = Math.max(0, closeDayExpenses.additional)
    const additionalExpenseLabel = totalAdditional > 0 ? closeDayOtherLabel.trim() : ''
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
          notes: mergeAdditionalExpenseLabelIntoNotes(job.notes, additionalExpenseLabel),
        }
      })

      if (isDemoMode) {
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
            additionalExpenseLabel: additionalExpenseLabel || undefined,
            notes: u.notes ?? j.notes,
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
        if (closeDayDate) setClosedOutDays(prev => ({ ...prev, [closeDayDate]: true }))
        return
      }

      for (const u of updates) {
        const { error } = await supabase
          .from('dyia_jobs')
          .update({
            labor: u.labor,
            gas: u.gas,
            dump_fee: u.dump_fee,
            dumpster_rental: u.dumpster_rental,
            additional_expense: u.additional_expense,
            notes: u.notes,
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
          additionalExpenseLabel: additionalExpenseLabel || undefined,
          notes: u.notes ?? j.notes,
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
      if (closeDayDate) setClosedOutDays(prev => ({ ...prev, [closeDayDate]: true }))
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

  const startAddJob = (date = formatLocalDateInput(), status: AppJob['status'] = 'completed') => {
    setEditingJob('new')
    setTempCustomers([{ id: Date.now(), name: '', source: '', revenue: 0, phone: '', email: '' }])
    setTempExpenses({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
    setTempOtherLabel('')
    setTempStatus(status)
    setTempScheduledKind('job')
    setTempAppointmentWindow('')
    setTempEstimateLow(0)
    setTempEstimateHigh(0)
    setTempDate(date)
    setTempNotes('')
    setTempAddress('')
    setShowExpenseDetails(false)
    setShowContactFields({})
  }

  const startEditJob = (job: AppJob) => {
    setEditingJob(job)
    const existingCustomer = findByName(job.customerName)
    setTempCustomers([{
      id: Date.now(),
      name: job.customerName,
      source: job.source || '',
      revenue: job.revenue,
      phone: existingCustomer?.phone || '',
      email: existingCustomer?.email || '',
    }])
    setTempExpenses({
      labor: job.labor,
      gas: job.gas,
      dumpFee: job.dumpFee,
      dumpsterRental: job.dumpsterRental,
      additional: job.additionalExpense
    })
    setTempOtherLabel(job.additionalExpenseLabel || '')
    setTempStatus(job.status || 'completed')
    setTempScheduledKind(job.scheduledKind || 'job')
    setTempAppointmentWindow(job.appointmentWindow || '')
    setTempEstimateLow(job.estimateLow || 0)
    setTempEstimateHigh(job.estimateHigh || 0)
    setTempDate(job.date)
    setTempNotes(job.notes || '')
    setTempAddress(job.address || '')
    const hasExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + (job.dumpsterRental || 0) + (job.additionalExpense || 0) > 0
    setShowExpenseDetails(hasExpenses)
    setShowContactFields({})
  }

  const cancelForm = () => {
    setEditingJob(null)
    setTempCustomers([])
    setTempOtherLabel('')
    setTempStatus('completed')
    setTempScheduledKind('job')
    setTempAppointmentWindow('')
    setTempEstimateLow(0)
    setTempEstimateHigh(0)
  }

  const addCustomerRow = () => {
    if (tempStatus === 'scheduled') return
    setTempCustomers([...tempCustomers, { id: Date.now(), name: '', source: '', revenue: 0, phone: '', email: '' }])
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

  const saveJobs = async (targetStatus: AppJob['status'] = tempStatus) => {
    const validCustomers = tempCustomers.filter(c => c.name.trim() && (targetStatus === 'scheduled' || c.revenue > 0))
    if (validCustomers.length === 0) {
      await alert({
        title: 'Missing Info',
        message: targetStatus === 'scheduled'
          ? 'Please add at least one customer name to schedule the job.'
          : 'Please add at least one customer with a name and revenue greater than 0.',
        variant: 'warning'
      })
      return
    }

    setSaving(true)

    try {
      const isEditing = editingJob && editingJob !== 'new'
      const additionalExpenseLabel = tempExpenses.additional > 0 ? tempOtherLabel.trim() : ''
      const notesWithExpenseLabel = mergeAdditionalExpenseLabelIntoNotes(tempNotes, additionalExpenseLabel)
      const isScheduling = targetStatus === 'scheduled'
      const normalizedAppointmentWindow = tempAppointmentWindow.trim()
      const normalizedScheduledKind = isScheduling ? tempScheduledKind : 'job'
      const normalizedEstimateLow = isScheduling && normalizedScheduledKind === 'estimate' ? Math.max(0, tempEstimateLow || 0) : 0
      const normalizedEstimateHigh = isScheduling && normalizedScheduledKind === 'estimate' ? Math.max(0, tempEstimateHigh || 0) : 0

      if (!isScheduling && validCustomers.some(c => c.revenue <= 0)) {
        await alert({ title: 'Revenue Needed', message: 'Enter actual gross revenue before completing this job.', variant: 'warning' })
        return
      }

      if (isDemoMode) {
        if (isEditing) {
          const customer = validCustomers[0]
          const jobProfit = customer.revenue - totalExpenses
          setJobs(jobs.map(j => j.id === (editingJob as AppJob).id ? {
            ...j,
            date: tempDate,
            customerName: customer.name.trim(),
            source: customer.source,
            revenue: customer.revenue,
            estimateLow: normalizedEstimateLow || undefined,
            estimateHigh: normalizedEstimateHigh || undefined,
            appointmentWindow: normalizedAppointmentWindow || undefined,
            scheduledKind: normalizedScheduledKind,
            labor: tempExpenses.labor,
            gas: tempExpenses.gas,
            dumpFee: tempExpenses.dumpFee,
            dumpsterRental: tempExpenses.dumpsterRental,
            additionalExpense: tempExpenses.additional,
            additionalExpenseLabel: additionalExpenseLabel || undefined,
            notes: tempNotes.trim(),
            address: tempAddress.trim() || undefined,
            status: targetStatus,
          } : j))
          showSuccess(isScheduling
            ? `Scheduled for ${parseLocalDate(tempDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
            : `Job updated — ${formatCurrency(jobProfit)} profit`)
        } else {
          const newJobs: AppJob[] = validCustomers.map((customer, index) => {
            const expPerCustomer = validCustomers.length
            return {
              id: `demo-job-${Date.now()}-${index}`,
              customerId: `demo-customer-${Date.now()}-${index}`,
              date: tempDate,
              customerName: customer.name.trim(),
              source: customer.source,
              revenue: customer.revenue,
              estimateLow: normalizedEstimateLow || undefined,
              estimateHigh: normalizedEstimateHigh || undefined,
              appointmentWindow: normalizedAppointmentWindow || undefined,
              scheduledKind: normalizedScheduledKind,
              labor: tempExpenses.labor / expPerCustomer,
              gas: tempExpenses.gas / expPerCustomer,
              dumpFee: tempExpenses.dumpFee / expPerCustomer,
              dumpsterRental: tempExpenses.dumpsterRental / expPerCustomer,
              additionalExpense: tempExpenses.additional / expPerCustomer,
              additionalExpenseLabel: additionalExpenseLabel || undefined,
              numWorkers: 1,
              costPerWorker: 0,
              notes: tempNotes.trim(),
              address: tempAddress.trim() || undefined,
              status: targetStatus,
            }
          })

          setJobs([...newJobs, ...jobs])
          const totalRev = validCustomers.reduce((s, c) => s + c.revenue, 0)
          const totalProf = totalRev - totalExpenses
          const jobLabel = validCustomers.length === 1 ? 'Job' : `${validCustomers.length} jobs`
          if (isScheduling) {
            showSuccess(`${jobLabel} scheduled for ${parseLocalDate(tempDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`)
          } else if (totalExpenses === 0) {
            showSuccess(`${jobLabel} saved — ${formatCurrency(totalRev)} revenue. Log expenses later to see profit.`)
          } else {
            showSuccess(`${jobLabel} saved — ${formatCurrency(totalProf)} profit`)
          }
        }

        cancelForm()
        return
      }

      if (isEditing) {
        const customer = validCustomers[0]
        const contactInfo = {
          phone: customer.phone?.trim() || null,
          email: customer.email?.trim() || null,
          address: tempAddress.trim() || null,
        }
        const customerId = await ensureCustomer(supabase, userId, customer.name.trim(), contactInfo)
        const dbJob = {
          date: tempDate,
          customer_name: customer.name.trim(),
          customer_id: customerId,
          source: customer.source || null,
          revenue: Math.max(0, customer.revenue),
          estimate_low: normalizedEstimateLow || null,
          estimate_high: normalizedEstimateHigh || null,
          appointment_window_text: normalizedAppointmentWindow || null,
          scheduled_kind: normalizedScheduledKind,
          labor: Math.max(0, tempExpenses.labor),
          gas: Math.max(0, tempExpenses.gas),
          dump_fee: Math.max(0, tempExpenses.dumpFee),
          dumpster_rental: Math.max(0, tempExpenses.dumpsterRental),
          additional_expense: Math.max(0, tempExpenses.additional),
          notes: notesWithExpenseLabel,
          address: tempAddress.trim() || null,
          status: targetStatus,
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
          estimateLow: normalizedEstimateLow || undefined,
          estimateHigh: normalizedEstimateHigh || undefined,
          appointmentWindow: normalizedAppointmentWindow || undefined,
          scheduledKind: normalizedScheduledKind,
          labor: tempExpenses.labor,
          gas: tempExpenses.gas,
          dumpFee: tempExpenses.dumpFee,
          dumpsterRental: tempExpenses.dumpsterRental,
          additionalExpense: tempExpenses.additional,
          additionalExpenseLabel: additionalExpenseLabel || undefined,
          notes: tempNotes.trim(),
          address: tempAddress.trim() || undefined,
          status: targetStatus,
        } : j))
        showSuccess(isScheduling
          ? `Scheduled for ${parseLocalDate(tempDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
          : `Job updated — ${formatCurrency(jobProfit)} profit`)
      } else {
        const newJobs: AppJob[] = []
        for (const customer of validCustomers) {
          const expPerCustomer = validCustomers.length
          const contactInfo = {
            phone: customer.phone?.trim() || null,
            email: customer.email?.trim() || null,
            address: tempAddress.trim() || null,
          }
          const customerId = await ensureCustomer(supabase, userId, customer.name.trim(), contactInfo)
          const dbJob = {
            user_id: userId,
            date: tempDate,
            customer_name: customer.name.trim(),
            customer_id: customerId,
            source: customer.source || null,
            revenue: Math.max(0, customer.revenue),
            estimate_low: normalizedEstimateLow || null,
            estimate_high: normalizedEstimateHigh || null,
            appointment_window_text: normalizedAppointmentWindow || null,
            scheduled_kind: normalizedScheduledKind,
            labor: Math.max(0, tempExpenses.labor / expPerCustomer),
            gas: Math.max(0, tempExpenses.gas / expPerCustomer),
            dump_fee: Math.max(0, tempExpenses.dumpFee / expPerCustomer),
            dumpster_rental: Math.max(0, tempExpenses.dumpsterRental / expPerCustomer),
            additional_expense: Math.max(0, tempExpenses.additional / expPerCustomer),
            notes: notesWithExpenseLabel,
            address: tempAddress.trim() || null,
            status: targetStatus,
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
            estimateLow: normalizedEstimateLow || undefined,
            estimateHigh: normalizedEstimateHigh || undefined,
            appointmentWindow: normalizedAppointmentWindow || undefined,
            scheduledKind: normalizedScheduledKind,
            labor: tempExpenses.labor / expPerCustomer,
            gas: tempExpenses.gas / expPerCustomer,
            dumpFee: tempExpenses.dumpFee / expPerCustomer,
            dumpsterRental: tempExpenses.dumpsterRental / expPerCustomer,
            additionalExpense: tempExpenses.additional / expPerCustomer,
            additionalExpenseLabel: additionalExpenseLabel || undefined,
            numWorkers: 1,
            costPerWorker: 0,
            notes: tempNotes.trim(),
            address: tempAddress.trim() || undefined,
            status: targetStatus,
          })

          if (customerId && !isScheduling) {
            await supabase
              .from('dyia_follow_ups')
              .update({ status: 'converted' })
              .eq('customer_id', customerId)
              .eq('user_id', userId)
              .in('status', ['pending', 'contacted', 'snoozed'])

            const { data: matchingQuotes } = await supabase
              .from('dyia_quotes')
              .select('id')
              .eq('customer_id', customerId)
              .eq('user_id', userId)
              .neq('status', 'accepted')
              .limit(1)
            if (matchingQuotes?.[0]) {
              await supabase
                .from('dyia_quotes')
                .update({ job_id: data.id, status: 'accepted' })
                .eq('id', matchingQuotes[0].id)
            }
          }
        }

        setJobs([...newJobs, ...jobs])
        const totalRev = validCustomers.reduce((s, c) => s + c.revenue, 0)
        const totalProf = totalRev - totalExpenses
        const jobLabel = validCustomers.length === 1 ? 'Job' : `${validCustomers.length} jobs`
        if (isScheduling) {
          showSuccess(`${jobLabel} scheduled for ${parseLocalDate(tempDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`)
        } else if (totalExpenses === 0) {
          showSuccess(`${jobLabel} saved — ${formatCurrency(totalRev)} revenue. Log expenses later to see profit.`)
        } else {
          showSuccess(`${jobLabel} saved — ${formatCurrency(totalProf)} profit`)
        }
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
      if (isDemoMode) {
        setJobs(jobs.filter(j => j.id !== id))
        showSuccess('Job deleted')
        return
      }

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

  const todayStr = formatLocalDateInput()
  const isFutureJob = tempDate > todayStr
  const isTodayJob = tempDate === todayStr
  const isScheduledDraft = tempStatus === 'scheduled' || isFutureJob
  const shouldShowEstimateRange = isScheduledDraft && tempScheduledKind === 'estimate'
  const isCompletingScheduledJob = editingJob !== 'new' && !!editingJob && tempStatus === 'scheduled'

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
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {isScheduledDraft ? (isEditing ? 'Scheduled Job' : 'Schedule Job') : isEditing ? 'Edit Job' : 'Log Job'}
                </h1>
                {isEditing && (
                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-bold uppercase">Editing</span>
                )}
                {isScheduledDraft && (
                  <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-[10px] font-bold uppercase">Scheduled</span>
                )}
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {isScheduledDraft
                  ? 'Add customer details and a rough estimate now, then complete the job later with actual gross'
                  : isEditing ? 'Update job details'
                  : 'Add your jobs, then close out the day to log expenses'}
              </p>
            </div>
          </div>
        </div>

        {/* === LIVE PREVIEW === */}
        {(isEditing || totalRevenue > 0) && (
        <div className={`rounded-xl p-4 border-2 transition-colors ${totalRevenue > 0 ? (liveProfit >= 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50') : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)]'}`}>
          <div className={`grid gap-3 text-center ${isEditing ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Revenue</p>
              <p className={`text-lg font-bold ${totalRevenue > 0 ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text-faint)]'}`}>{formatCurrency(totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{isEditing ? 'Expenses' : 'Jobs'}</p>
              <p className={`text-lg font-bold ${isEditing && totalExpenses > 0 ? 'text-red-500 dark:text-red-400' : 'text-[var(--color-text-primary)]'}`}>
                {isEditing ? (totalExpenses > 0 ? `-${formatCurrency(totalExpenses)}` : '$0') : tempCustomers.filter(c => c.name.trim() && (isScheduledDraft || c.revenue > 0)).length}
              </p>
            </div>
            {isEditing && (
              <>
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
              </>
            )}
          </div>
        </div>
        )}

        {/* === CUSTOMER + DATE === */}
        <div className="app-card p-4 sm:p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {isEditing ? 'Job Details' : `Customer${tempCustomers.length > 1 ? 's' : ''}`}
              {!isEditing && tempCustomers.length > 1 && <span className="text-[var(--color-text-faint)] font-normal ml-1">({tempCustomers.length})</span>}
            </h3>
            {!isEditing && !isScheduledDraft && (
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
                      aria-label={`Remove customer ${index + 1}`}
                      className="w-6 h-6 rounded-lg text-xs flex items-center justify-center transition-colors"
                      style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}
                    >
                      ×
                    </button>
                  </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="relative">
                    <label className="app-label" id={`customer-label-${index}`}>Customer Name *</label>
                    <input
                      type="text"
                      role="combobox"
                      autoComplete="off"
                      aria-labelledby={`customer-label-${index}`}
                      aria-expanded={activeAutocomplete === index}
                      aria-controls={`customer-suggestions-${index}`}
                      aria-autocomplete="list"
                      value={customer.name}
                      onChange={(e) => {
                        updateCustomer(index, 'name', e.target.value)
                        setActiveAutocomplete(e.target.value.length >= 1 ? index : null)
                      }}
                      onFocus={() => { if (customer.name.length >= 1) setActiveAutocomplete(index) }}
                      onBlur={() => setTimeout(() => setActiveAutocomplete(null), 200)}
                      className="app-input"
                      placeholder="John Smith"
                      autoFocus={index === 0}
                    />
                    {activeAutocomplete === index && (() => {
                      const q = customer.name.trim().toLowerCase()
                      const filtered = customerSuggestions.filter(c => c.name.toLowerCase().includes(q))
                      if (filtered.length === 0) return null
                      return (
                        <ul id={`customer-suggestions-${index}`} role="listbox" className="absolute z-20 left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-1">
                          {filtered.slice(0, 8).map(c => (
                            <li key={c.id} role="option" aria-selected={false}>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  const lastJob = [...jobs]
                                    .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
                                    .find(j => j.customerName.toLowerCase() === c.name.trim().toLowerCase())
                                  if (c.address) setTempAddress(c.address)
                                  setTempCustomers(prev => {
                                    const updated = [...prev]
                                    updated[index] = {
                                      ...updated[index],
                                      name: c.name,
                                      ...(c.phone ? { phone: c.phone } : {}),
                                      ...(c.email ? { email: c.email } : {}),
                                      ...(lastJob?.source ? { source: lastJob.source } : {}),
                                    }
                                    return updated
                                  })
                                  setActiveAutocomplete(null)
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--color-bg-subtle)] transition-colors"
                              >
                                <div className="font-medium text-[var(--color-text-primary)]">{c.name}</div>
                                <div className="text-[var(--color-text-faint)] text-xs">
                                  {[c.phone, c.email, c.address].filter(Boolean).join(' · ') || 'No contact info'}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                    })()}
                  </div>
                  <div>
                    <label className="app-label">{isScheduledDraft ? 'Actual Gross' : 'Revenue *'}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                      <input
                        type="number"
                        value={customer.revenue || ''}
                        onChange={(e) => updateCustomer(index, 'revenue', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="app-input pl-7"
                        placeholder={isScheduledDraft ? 'Leave blank until completed' : '500'}
                        min="0"
                      />
                    </div>
                    {isScheduledDraft && (
                      <p className="text-[10px] text-[var(--color-text-faint)] mt-1">Set this when the job is complete.</p>
                    )}
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

                {/* Contact info (optional) */}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowContactFields(prev => ({ ...prev, [index]: !prev[index] }))}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    {showContactFields[index] ? '− Hide' : '+ Add'} contact info
                    {(customer.phone || customer.email) && <span className="text-green-500 ml-1">●</span>}
                  </button>
                  {showContactFields[index] && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="app-label">Phone</label>
                        <input
                          type="tel"
                          value={customer.phone}
                          onChange={(e) => updateCustomer(index, 'phone', e.target.value)}
                          className="app-input"
                          placeholder="(555) 123-4567"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="app-label">Email</label>
                        <input
                          type="email"
                          value={customer.email}
                          onChange={(e) => updateCustomer(index, 'email', e.target.value)}
                          className="app-input"
                          placeholder="customer@email.com"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isScheduledDraft && (
          <div className="app-card p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Appointment Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <div>
                <label className="app-label">Time Window</label>
                <input
                  type="text"
                  value={tempAppointmentWindow}
                  onChange={(e) => setTempAppointmentWindow(e.target.value)}
                  className="app-input"
                  placeholder="2:00-4:00pm"
                  maxLength={60}
                />
              </div>
              <div>
                <label className="app-label">Appointment Type</label>
                <select
                  value={tempScheduledKind}
                  onChange={(e) => {
                    const nextKind = e.target.value as 'job' | 'estimate' | 'free_estimate'
                    setTempScheduledKind(nextKind)
                    if (nextKind !== 'estimate') {
                      setTempEstimateLow(0)
                      setTempEstimateHigh(0)
                    }
                  }}
                  className="app-select"
                >
                  <option value="job">Scheduled Job</option>
                  <option value="estimate">Estimate</option>
                  <option value="free_estimate">Free Estimate</option>
                </select>
              </div>
            </div>

            {shouldShowEstimateRange && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mt-3">
                <div>
                  <label className="app-label">Low End</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                    <input
                      type="number"
                      value={tempEstimateLow || ''}
                      onChange={(e) => setTempEstimateLow(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="app-input pl-7"
                      placeholder="300"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="app-label">High End</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                    <input
                      type="number"
                      value={tempEstimateHigh || ''}
                      onChange={(e) => setTempEstimateHigh(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="app-input pl-7"
                      placeholder="500"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--color-text-faint)] mt-2">
              {tempScheduledKind === 'estimate'
                ? 'Add the expected price range for this estimate appointment.'
                : tempScheduledKind === 'free_estimate'
                  ? 'Mark this as a free estimate visit with no price range.'
                  : 'Use this for normal scheduled jobs before you know the final gross.'}
            </p>
          </div>
        )}

        {/* === EXPENSES (only when editing an existing job) === */}
        {isEditing && !isScheduledDraft && (
        <div className="app-card p-4 sm:p-5">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Expenses
                {totalExpenses > 0 && <span className="text-red-500 font-normal ml-2 text-xs">{formatCurrency(totalExpenses)}</span>}
              </h3>
            </div>
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
              {(totalExpenses > 0 || tempOtherLabel) && (
                <div className="mt-3 max-w-xs">
                  <label className="app-label">What was this expense?</label>
                  <input
                    type="text"
                    value={tempOtherLabel}
                    onChange={(e) => setTempOtherLabel(e.target.value)}
                    className="app-input"
                    placeholder="U-Haul rental"
                    maxLength={80}
                  />
                </div>
              )}
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
              {(tempExpenses.additional > 0 || tempOtherLabel) && (
                <div className="mt-3 max-w-xs">
                  <label className="app-label">What was &quot;Other&quot;?</label>
                  <input
                    type="text"
                    value={tempOtherLabel}
                    onChange={(e) => setTempOtherLabel(e.target.value)}
                    className="app-input"
                    placeholder="U-Haul rental"
                    maxLength={80}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* === NEW JOB: Close out day hint === */}
        {!isEditing && !isScheduledDraft && !isFutureJob && (
          <div className="app-card p-4 sm:p-5 bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/30 dark:border-orange-800/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Log your jobs first, expenses later</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">After saving, use <strong>Close Out Day</strong> to add labor, gas, dump fees, and other expenses for the entire day in one go.</p>
              </div>
            </div>
          </div>
        )}

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
              {isScheduledDraft ? (
                <span className="text-[var(--color-text-faint)]">
                  {tempScheduledKind === 'free_estimate'
                    ? `Free estimate${tempAppointmentWindow ? ` · ${tempAppointmentWindow}` : ''}`
                    : tempEstimateLow || tempEstimateHigh
                      ? `Estimate: ${tempEstimateLow ? formatCurrency(tempEstimateLow) : '$0'}${tempEstimateHigh ? ` - ${formatCurrency(tempEstimateHigh)}` : ''}${tempAppointmentWindow ? ` · ${tempAppointmentWindow}` : ''}`
                      : `Scheduled${tempAppointmentWindow ? ` · ${tempAppointmentWindow}` : ''}`}
                </span>
              ) : totalRevenue > 0 ? (
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
              <button onClick={cancelForm} className="app-btn-secondary shrink-0 text-sm py-2.5 px-4">
                Cancel
              </button>
              {!isEditing && !isScheduledDraft && !isFutureJob ? (
                <>
                  <button
                    onClick={() => saveJobs()}
                    disabled={saving}
                    className="app-btn-secondary flex-1 sm:flex-none text-sm py-2.5 px-4"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={async () => {
                      const dateToClose = tempDate
                      await saveJobs()
                      if (!saving) {
                        setTimeout(() => openCloseDayModal(dateToClose), 300)
                      }
                    }}
                    disabled={saving}
                    className="app-btn-primary flex-1 sm:flex-none text-sm py-2.5 px-4"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Save & Close Out Day
                      </>
                    )}
                  </button>
                </>
              ) : isScheduledDraft ? (
                <>
                  <button
                    onClick={() => saveJobs('scheduled')}
                    disabled={saving}
                    className="app-btn-secondary flex-1 sm:flex-none text-sm py-2.5 px-4"
                  >
                    {saving ? 'Saving...' : isEditing ? 'Update Schedule' : 'Save Schedule'}
                  </button>
                  {isEditing && (
                    <button
                      onClick={() => saveJobs('completed')}
                      disabled={saving}
                      className="app-btn-primary flex-1 sm:flex-none text-sm py-2.5 px-5"
                    >
                      {saving ? 'Completing...' : 'Complete Job'}
                    </button>
                  )}
                </>
              ) : (
                <button 
                  onClick={() => saveJobs(isFutureJob ? 'scheduled' : 'completed')} 
                  disabled={saving} 
                  className="app-btn-primary flex-1 sm:flex-none text-sm py-2.5 px-5"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isFutureJob ? 'Scheduling...' : 'Saving...'}
                    </>
                  ) : isFutureJob ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Schedule {tempCustomers.length > 1 ? `${tempCustomers.length} Jobs` : 'Job'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {isEditing ? 'Update Job' : `Save ${tempCustomers.length > 1 ? `${tempCustomers.length} Jobs` : 'Job'}`}
                    </>
                  )}
                </button>
              )}
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
          <button onClick={() => startAddJob()} className="app-btn-primary text-sm py-2.5 px-4">
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
                <button onClick={() => startAddJob()} className="app-btn-primary text-sm">
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
              const dayLabel = parseLocalDate(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

              return (
                <div key={date}>
                  {/* Day header with "Log daily expenses" */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{dayLabel}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}</span>
                      {dayRevenue > 0 ? (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">{formatCurrency(dayRevenue)} rev</span>
                      ) : (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">scheduled</span>
                      )}
                      {dayExpenses > 0 && (
                        <span className="text-xs text-[var(--color-text-muted)]">{formatCurrency(dayProfit)} profit</span>
                      )}
                    </div>
                    {dayRevenue > 0 && (
                      <button
                        type="button"
                        onClick={() => openCloseDayModal(date)}
                        className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 hover:underline"
                      >
                        {dayExpenses > 0 ? 'Edit daily expenses' : 'Log daily expenses'}
                      </button>
                    )}
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
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            job.status === 'scheduled'
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : profit >= 0 ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          }`}>
                            <span className="text-xs font-bold">{job.status === 'scheduled' ? 'SCH' : `${margin}%`}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{job.customerName}</p>
                              {job.status === 'scheduled' && (
                                <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full shrink-0">Scheduled</span>
                              )}
                              {job.source && (
                                <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full shrink-0">{job.source}</span>
                              )}
                            </div>
                            {job.status === 'scheduled' && (job.estimateLow || job.estimateHigh) && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 truncate max-w-[220px]">
                                Estimate: {job.estimateLow ? formatCurrency(job.estimateLow) : '$0'}{job.estimateHigh ? ` - ${formatCurrency(job.estimateHigh)}` : ''}
                              </div>
                            )}
                            {job.notes && (
                              <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[200px]">{job.notes}</div>
                            )}
                            {job.additionalExpense > 0 && job.additionalExpenseLabel && (
                              <div className="text-xs text-[var(--color-text-faint)] truncate max-w-[200px]">
                                Other: {job.additionalExpenseLabel}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${job.status === 'scheduled' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                              {job.status === 'scheduled'
                                ? (job.estimateLow || job.estimateHigh
                                  ? `${job.estimateLow ? formatCurrency(job.estimateLow) : '$0'}${job.estimateHigh ? `-${formatCurrency(job.estimateHigh)}` : ''}`
                                  : 'Scheduled')
                                : formatCurrency(job.revenue)}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-faint)] hidden sm:block">
                              {job.status === 'scheduled' ? 'Complete later' : `${formatCurrency(profit)} profit`}
                            </p>
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
              {parseLocalDate(closeDayDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
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
                  const dayJobsList = jobs.filter(j => j.date === closeDayDate && j.status !== 'scheduled')
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
                      {(closeDayExpenses.additional > 0 || closeDayOtherLabel) && (
                        <div className="mb-4">
                          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">What was &quot;Other&quot;?</label>
                          <input
                            type="text"
                            value={closeDayOtherLabel}
                            onChange={(e) => setCloseDayOtherLabel(e.target.value)}
                            className="w-full px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm"
                            placeholder="U-Haul rental"
                            maxLength={80}
                          />
                        </div>
                      )}
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
      {reviewModalJob && settings && (() => {
        const customerInfo = findByName(reviewModalJob.customerName)
        const reviewMessage = getReviewRequestMessage(reviewModalJob.customerName, settings.businessInfo, reviewPlatform)
        const customerPhone = customerInfo?.phone?.replace(/[^\d+]/g, '') || ''
        const customerEmail = customerInfo?.email || ''

        const recordRequest = async () => {
          try {
            await fetch('/api/review-requests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quoteId: null, customerName: reviewModalJob.customerName, platform: reviewPlatform }),
            })
          } catch { /* ignore */ }
        }

        const handleSendEmail = async () => {
          if (!emailConnection || !customerEmail) return
          setReviewSending(true)
          try {
            const res = await fetch('/api/email/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                connectionId: emailConnection.id,
                recipients: [{ email: customerEmail, name: reviewModalJob.customerName }],
                subject: `We'd love your feedback${settings.businessInfo.name ? ` — ${settings.businessInfo.name}` : ''}`,
                body: reviewMessage,
              }),
            })
            if (!res.ok) throw new Error('Send failed')
            const data = await res.json()
            if (data.sent > 0) {
              showSuccess(`Review request emailed to ${customerEmail}`)
              await recordRequest()
            } else {
              throw new Error('No emails sent')
            }
          } catch {
            await alert({ title: 'Send Failed', message: 'Could not send email. Check your email connection in Settings.', variant: 'error' })
          } finally {
            setReviewSending(false)
          }
        }

        const handleSendText = () => {
          const encoded = encodeURIComponent(reviewMessage)
          const smsUrl = customerPhone ? `sms:${customerPhone}?body=${encoded}` : `sms:?body=${encoded}`
          window.open(smsUrl, '_self')
          recordRequest()
          showSuccess('Opening messages app...')
        }

        return (
          <div className="modal-overlay" onClick={() => !reviewSending && setReviewModalJob(null)}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">Request review</h3>
              <p className="modal-description">Send a review request to {reviewModalJob.customerName}.</p>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Platform</label>
                <select value={reviewPlatform} onChange={(e) => setReviewPlatform(e.target.value)} className="app-input w-full">
                  {REVIEW_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Message</label>
                <textarea readOnly rows={3} value={reviewMessage} className="app-input w-full resize-none text-sm" />
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={reviewSending}
                    onClick={handleSendText}
                    className="app-btn-primary flex-1 text-sm py-2.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    Send via Text{customerPhone ? '' : ' (enter number)'}
                  </button>
                  {emailConnection && customerEmail && (
                    <button
                      type="button"
                      disabled={reviewSending}
                      onClick={handleSendEmail}
                      className="app-btn-primary flex-1 text-sm py-2.5"
                    >
                      {reviewSending ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      )}
                      {reviewSending ? 'Sending...' : 'Send via Email'}
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(reviewMessage)
                      setReviewCopied(true)
                      showSuccess('Copied to clipboard')
                      await recordRequest()
                    }}
                    className="app-btn-secondary flex-1 text-sm py-2"
                  >
                    {reviewCopied ? 'Copied!' : 'Copy message'}
                  </button>
                  <button type="button" onClick={() => setReviewModalJob(null)} className="app-btn-secondary text-sm py-2">Done</button>
                </div>
                {!emailConnection && customerEmail && (
                  <p className="text-[10px] text-[var(--color-text-faint)] text-center">Connect Gmail or Outlook in Settings to send via email</p>
                )}
                {emailConnection && !customerEmail && (
                  <p className="text-[10px] text-[var(--color-text-faint)] text-center">Add customer email in Customers to send via email</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
