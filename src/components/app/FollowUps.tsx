'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import KanbanBoard, { type KanbanColumn, type KanbanFollowUp, type RiskLevel } from '@/components/ui/kanban-board'
import { ensureCustomer } from '@/lib/customers'

type FollowUpView = 'kanban' | 'calendar'
type FollowUpStatus = 'pending' | 'contacted' | 'converted' | 'lost' | 'snoozed'
type FollowUpPriority = 'hot' | 'warm' | 'cold'

interface FollowUpRecord {
  id: string
  quote_id: string
  status: FollowUpStatus
  last_contacted_at?: string | null
  next_follow_up_at?: string | null
  notes?: string | null
  contact_count?: number | null
}

interface QuoteSummary {
  id: string
  createdAt: number
  customerId?: string
  customerName: string
  phone?: string
  email?: string
  jobDescription?: string
  estimateLow: number
  estimateHigh: number
  customerJobCount?: number
  customerLifetimeValue?: number
}

interface FollowUpRow {
  quote: QuoteSummary
  followUp?: FollowUpRecord
  priority: FollowUpPriority
  daysSinceQuote: number
}

interface FollowUpsProps {
  userId: string
  businessName?: string
  showSuccess?: (message: string) => void
  onDataChanged?: () => void
}

const PRIORITY_OPTIONS: { value: FollowUpPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'hot', label: 'Hot 🔥' },
  { value: 'warm', label: 'Warm 🌡️' },
  { value: 'cold', label: 'Cold ❄️' },
]

function getPriority(daysSinceQuote: number): FollowUpPriority {
  if (daysSinceQuote <= 3) return 'hot'
  if (daysSinceQuote <= 7) return 'warm'
  return 'cold'
}

function getRiskLevel(daysSinceQuote: number, contactCount: number, status: FollowUpStatus): RiskLevel {
  if (status === 'converted' || status === 'lost') return 'low'
  if (daysSinceQuote > 14 && contactCount === 0) return 'critical'
  if (daysSinceQuote > 10 || (daysSinceQuote > 7 && contactCount === 0)) return 'high'
  if (daysSinceQuote > 5 && contactCount <= 1) return 'medium'
  return 'low'
}

function generateFollowUpMessage(quote: QuoteSummary, businessName: string) {
  const job = quote.jobDescription?.trim() || 'job'
  return `Hi ${quote.customerName}! This is ${businessName} following up on the estimate we provided for your ${job}. The estimate was $${quote.estimateLow}-$${quote.estimateHigh}. Would you like to schedule this job? Let me know if you have any questions!`
}

const FOLLOWUP_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const KANBAN_COLUMN_CONFIG: { id: FollowUpStatus; title: string; color: string }[] = [
  { id: 'pending', title: 'Pending', color: '#f97316' },
  { id: 'contacted', title: 'Contacted', color: '#3b82f6' },
  { id: 'snoozed', title: 'Snoozed', color: '#eab308' },
  { id: 'converted', title: 'Converted', color: '#22c55e' },
  { id: 'lost', title: 'Lost', color: '#ef4444' },
]

export function FollowUps({ userId, businessName = 'dyia', showSuccess, onDataChanged }: FollowUpsProps) {
  const supabase = useMemo(() => createClient(), [])
  const { alert } = useConfirm()
  const [rows, setRows] = useState<FollowUpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [priorityFilter, setPriorityFilter] = useState<FollowUpPriority | 'all'>('all')
  const [viewMode, setViewMode] = useState<FollowUpView>('kanban')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null)

  useEffect(() => {
    const loadFollowUps = async () => {
      if (!userId) return
      setLoading(true)

      try {
        const { data: quotesData, error: quotesError } = await supabase
          .from('dyia_quotes')
          .select('id, created_at, customer_id, customer_name, customer_phone, customer_email, job_description, estimate_low, estimate_high')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (quotesError) throw quotesError

        const { data: followUpsData, error: followUpsError } = await supabase
          .from('dyia_follow_ups')
          .select('*')
          .eq('user_id', userId)

        if (followUpsError) throw followUpsError

        // Load customer stats for pipeline context
        const { data: jobsData } = await supabase
          .from('dyia_jobs')
          .select('customer_id, revenue')
          .eq('user_id', userId)

        const customerStats = new Map<string, { jobCount: number; totalRevenue: number }>()
        for (const j of (jobsData || [])) {
          if (!j.customer_id) continue
          const existing = customerStats.get(j.customer_id) || { jobCount: 0, totalRevenue: 0 }
          existing.jobCount++
          existing.totalRevenue += parseFloat(j.revenue) || 0
          customerStats.set(j.customer_id, existing)
        }

        const followUpMap = new Map<string, FollowUpRecord>()
        ;(followUpsData || []).forEach((followUp: FollowUpRecord) => {
          followUpMap.set(followUp.quote_id, followUp)
        })

        const nextRows: FollowUpRow[] = (quotesData || []).map((q: { id: string; created_at: string; customer_id?: string; customer_name: string; customer_phone?: string; customer_email?: string; job_description?: string; estimate_low: string; estimate_high: string }) => {
          const createdAt = new Date(q.created_at).getTime()
          const daysSinceQuote = Math.max(0, Math.floor((Date.now() - createdAt) / 86400000))
          const priority = getPriority(daysSinceQuote)
          const stats = q.customer_id ? customerStats.get(q.customer_id) : undefined

          const quote: QuoteSummary = {
            id: q.id,
            createdAt,
            customerId: q.customer_id || undefined,
            customerName: q.customer_name,
            phone: q.customer_phone || undefined,
            email: q.customer_email || undefined,
            jobDescription: q.job_description || undefined,
            estimateLow: parseFloat(q.estimate_low) || 0,
            estimateHigh: parseFloat(q.estimate_high) || 0,
            customerJobCount: stats?.jobCount,
            customerLifetimeValue: stats?.totalRevenue,
          }

          return {
            quote,
            followUp: followUpMap.get(q.id),
            priority,
            daysSinceQuote,
          }
        })

        setRows(nextRows)
      } catch (error) {
        console.error('Error loading follow-ups:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFollowUps()
  }, [supabase, userId])

  const persistFollowUp = async (
    row: FollowUpRow,
    updates: Partial<FollowUpRecord> & { status?: FollowUpStatus }
  ) => {
    if (!userId) return

    const current = row.followUp
    if (current?.id) {
      const { data, error } = await supabase
        .from('dyia_follow_ups')
        .update(updates)
        .eq('id', current.id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data as FollowUpRecord
    }

    const insertPayload = {
      user_id: userId,
      quote_id: row.quote.id,
      status: updates.status || 'pending',
      last_contacted_at: updates.last_contacted_at ?? null,
      next_follow_up_at: updates.next_follow_up_at ?? null,
      notes: updates.notes ?? null,
      contact_count: updates.contact_count ?? 0,
    }

    const { data, error } = await supabase
      .from('dyia_follow_ups')
      .insert(insertPayload)
      .select()
      .single()

    if (error) throw error
    return data as FollowUpRecord
  }

  const updateRow = async (
    row: FollowUpRow,
    updates: Partial<FollowUpRecord> & { status?: FollowUpStatus }
  ) => {
    try {
      const updated = await persistFollowUp(row, updates)
      setRows((prev) =>
        prev.map((r) => (r.quote.id === row.quote.id ? { ...r, followUp: updated } : r))
      )
      onDataChanged?.()
    } catch (error) {
      console.error('Error updating follow-up:', error)
      await alert({ title: 'Error', message: 'Error updating follow-up.', variant: 'error' })
    }
  }

  const handleStatusChange = async (row: FollowUpRow, status: FollowUpStatus) => {
    const updates: Partial<FollowUpRecord> & { status: FollowUpStatus } = { status }
    if (status === 'contacted') {
      updates.last_contacted_at = new Date().toISOString()
      const currentCount = row.followUp?.contact_count || 0
      updates.contact_count = currentCount + 1
      updates.next_follow_up_at = null
    } else if (status === 'snoozed') {
      // Set follow-up reminder 3 days from now
      const snoozeUntil = new Date()
      snoozeUntil.setDate(snoozeUntil.getDate() + 3)
      updates.next_follow_up_at = snoozeUntil.toISOString()
    } else {
      updates.next_follow_up_at = null
    }
    await updateRow(row, updates)

    // When converted, create a job from the quote and mark the quote as accepted
    if (status === 'converted') {
      await convertQuoteToJob(row)
    }
  }

  const convertQuoteToJob = async (row: FollowUpRow) => {
    try {
      const q = row.quote
      const avgEstimate = Math.round((q.estimateLow + q.estimateHigh) / 2)

      const customerId = q.customerId || await ensureCustomer(supabase, userId, q.customerName)

      const { data: job, error: jobError } = await supabase
        .from('dyia_jobs')
        .insert({
          user_id: userId,
          customer_id: customerId,
          date: new Date().toISOString().split('T')[0],
          customer_name: q.customerName,
          source: 'Quote',
          revenue: avgEstimate,
          labor: 0,
          gas: 0,
          dump_fee: 0,
          dumpster_rental: 0,
          additional_expense: 0,
          num_workers: 1,
          cost_per_worker: 0,
          notes: q.jobDescription || null,
        })
        .select()
        .single()

      if (jobError) throw jobError

      // Link the quote to the new job and mark it accepted
      await supabase
        .from('dyia_quotes')
        .update({ job_id: job.id, status: 'accepted' })
        .eq('id', q.id)
        .eq('user_id', userId)

      showSuccess?.('Quote converted to job!')
    } catch (error) {
      console.error('Error converting quote to job:', error)
      await alert({ title: 'Error', message: 'Follow-up marked as converted, but failed to create the job. You can create it manually from the Jobs tab.', variant: 'error' })
    }
  }

  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    const kanbanRows = priorityFilter === 'all'
      ? rows
      : rows.filter((r) => r.priority === priorityFilter)

    return KANBAN_COLUMN_CONFIG.map((col) => ({
      ...col,
      items: kanbanRows
        .filter((r) => (r.followUp?.status || 'pending') === col.id)
        .map((r): KanbanFollowUp => {
          const status = (r.followUp?.status || 'pending') as FollowUpStatus
          const contactCount = r.followUp?.contact_count || 0
          return {
            id: r.followUp?.id || r.quote.id,
            quoteId: r.quote.id,
            customerId: r.quote.customerId,
            customerName: r.quote.customerName,
            phone: r.quote.phone,
            email: r.quote.email,
            jobDescription: r.quote.jobDescription,
            estimateLow: r.quote.estimateLow,
            estimateHigh: r.quote.estimateHigh,
            status,
            priority: r.priority,
            daysSinceQuote: r.daysSinceQuote,
            contactCount,
            notes: r.followUp?.notes,
            nextFollowUpAt: r.followUp?.next_follow_up_at,
            riskLevel: getRiskLevel(r.daysSinceQuote, contactCount, status),
            customerJobCount: r.quote.customerJobCount,
            customerLifetimeValue: r.quote.customerLifetimeValue,
          }
        }),
    }))
  }, [rows, priorityFilter])

  const handleKanbanStatusChange = async (item: KanbanFollowUp, newStatus: FollowUpStatus) => {
    const row = rows.find((r) => r.quote.id === item.quoteId)
    if (!row) return
    await handleStatusChange(row, newStatus)
  }

  const handleKanbanCopyMessage = (item: KanbanFollowUp) => {
    const row = rows.find((r) => r.quote.id === item.quoteId)
    if (row) copyMessage(row)
  }

  const copyMessage = async (row: FollowUpRow) => {
    const message = generateFollowUpMessage(row.quote, businessName || 'dyia')
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = message
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      showSuccess?.('📋 Follow-up message copied')
    } catch (error) {
      console.error('Copy failed:', error)
      await alert({ title: 'Error', message: 'Failed to copy message.', variant: 'error' })
    }
  }

  const pipelineMetrics = useMemo(() => {
    const activeRows = rows.filter(r => {
      const status = r.followUp?.status || 'pending'
      return status === 'pending' || status === 'contacted' || status === 'snoozed'
    })
    const pipelineValue = activeRows.reduce((sum, r) =>
      sum + Math.round((r.quote.estimateLow + r.quote.estimateHigh) / 2), 0)
    const converted = rows.filter(r => r.followUp?.status === 'converted').length
    const lost = rows.filter(r => r.followUp?.status === 'lost').length
    const closedTotal = converted + lost
    const conversionRate = closedTotal > 0 ? Math.round((converted / closedTotal) * 100) : 0
    const hotCount = activeRows.filter(r => r.priority === 'hot').length
    return { pipelineValue, conversionRate, hotCount, activeCount: activeRows.length }
  }, [rows])

  const calDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const startPad = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()

    const filteredRows = priorityFilter === 'all' ? rows : rows.filter(r => r.priority === priorityFilter)

    const dateMap = new Map<string, FollowUpRow[]>()
    for (const row of filteredRows) {
      const status = row.followUp?.status || 'pending'
      if (status === 'converted' || status === 'lost') continue

      const dateKey = row.followUp?.next_follow_up_at
        ? new Date(row.followUp.next_follow_up_at).toISOString().split('T')[0]
        : new Date(row.quote.createdAt).toISOString().split('T')[0]

      const existing = dateMap.get(dateKey) || []
      existing.push(row)
      dateMap.set(dateKey, existing)
    }

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean; isToday: boolean; followUps: FollowUpRow[] }> = []
    const todayStr = new Date().toISOString().split('T')[0]

    const prevMonthLast = new Date(year, month, 0).getDate()
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevMonthLast - i
      const prevDate = new Date(year, month - 1, d)
      const fullDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: fullDateStr, day: d, isCurrentMonth: false, isToday: false, followUps: dateMap.get(fullDateStr) || [] })
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: dateStr, day: d, isCurrentMonth: true, isToday: dateStr === todayStr, followUps: dateMap.get(dateStr) || [] })
    }

    const rowsNeeded = Math.ceil(days.length / 7)
    const totalCells = rowsNeeded * 7
    const remaining = totalCells - days.length
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d)
      const fullDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: fullDateStr, day: d, isCurrentMonth: false, isToday: false, followUps: dateMap.get(fullDateStr) || [] })
    }

    return days
  }, [calendarMonth, rows, priorityFilter])

  const selectedCalFollowUps = useMemo(() => {
    if (!selectedCalDate) return []
    const day = calDays.find(d => d.date === selectedCalDate)
    return day?.followUps || []
  }, [selectedCalDate, calDays])

  const priorityColor = (p: FollowUpPriority) => {
    if (p === 'hot') return 'bg-red-500'
    if (p === 'warm') return 'bg-amber-500'
    return 'bg-blue-500'
  }

  const priorityBg = (p: FollowUpPriority) => {
    if (p === 'hot') return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    if (p === 'warm') return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
    return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
  }

  const statusLabel = (s: FollowUpStatus) => {
    const labels: Record<FollowUpStatus, string> = { pending: 'Pending', contacted: 'Contacted', snoozed: 'Snoozed', converted: 'Converted', lost: 'Lost' }
    return labels[s] || s
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between w-full flex-wrap gap-3">
          <div>
            <h1 className="page-title text-xl sm:text-3xl">Pipeline</h1>
            <p className="page-subtitle text-sm sm:text-base">
              {`${rows.length} total · ${pipelineMetrics.activeCount} active`}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Toggle */}
            <div className="flex bg-[var(--color-bg-subtle)] rounded-lg p-0.5 border border-[var(--color-border)]">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'kanban'
                    ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                  Board
                </span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Calendar
                </span>
              </button>
            </div>

            <div className="w-full sm:w-48">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as FollowUpPriority | 'all')}
                className="app-select"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="app-card p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-orange-500">${pipelineMetrics.pipelineValue.toLocaleString()}</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Pipeline Value</p>
          </div>
          <div className="app-card p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-[var(--color-text-primary)]">{pipelineMetrics.conversionRate}%</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Close Rate</p>
          </div>
          <div className="app-card p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-red-500">{pipelineMetrics.hotCount}</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Hot Leads</p>
          </div>
          <div className="app-card p-3 sm:p-4 text-center">
            <p className="text-lg sm:text-2xl font-bold text-[var(--color-text-primary)]">{pipelineMetrics.activeCount}</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Active Leads</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="app-card">
          <div className="flex items-center gap-3">
            <div className="loading-spinner" />
            <span className="text-[var(--color-text-muted)]">Loading follow-ups...</span>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="app-card">
          <div className="text-center py-12 px-6">
            <div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">
              No Follow-Ups Yet
            </h3>
            <p className="text-[var(--color-text-muted)] mb-2 max-w-md mx-auto">
              Follow-ups are automatically created when you send a quote to a customer. They help you track which leads need attention and when to reach out again.
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
              Create and send a quote to get started with your follow-up pipeline.
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-xs text-[var(--color-text-muted)] mb-6">
              <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-full">Hot = sent recently</span>
              <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-full">Warm = a few days</span>
              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full">Cold = over a week</span>
            </div>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          columns={kanbanColumns}
          onStatusChange={handleKanbanStatusChange}
          onCopyMessage={handleKanbanCopyMessage}
        />
      ) : (
        /* ===== CALENDAR VIEW ===== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {/* Month Navigation */}
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between">
              <button
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)); setSelectedCalDate(null) }}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => { setCalendarMonth(new Date()); setSelectedCalDate(new Date().toISOString().split('T')[0]) }}
                  className="px-2.5 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
                >
                  Today
                </button>
              </div>
              <button
                onClick={() => { setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)); setSelectedCalDate(null) }}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-[var(--color-border-light)]">
              {FOLLOWUP_WEEKDAYS.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-[var(--color-text-muted)] py-2">{day}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calDays.map((day, i) => {
                const hasFU = day.followUps.length > 0
                const isSelected = selectedCalDate === day.date

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedCalDate(prev => prev === day.date ? null : day.date)}
                    className={`
                      relative min-h-[60px] sm:min-h-[72px] p-1 sm:p-1.5 border-b border-r border-[var(--color-border-light)] text-left transition-all
                      ${day.isCurrentMonth ? '' : 'opacity-30'}
                      ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-inset ring-orange-500' : ''}
                      ${!isSelected && day.isToday ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}
                      ${!isSelected && !day.isToday ? 'hover:bg-[var(--color-bg-subtle)]' : ''}
                    `}
                  >
                    <span className={`
                      inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                      ${day.isToday ? 'bg-orange-500 text-white font-bold' : 'text-[var(--color-text-secondary)]'}
                    `}>
                      {day.day}
                    </span>

                    {hasFU && (
                      <div className="mt-0.5 space-y-0.5 hidden sm:block">
                        {day.followUps.slice(0, 2).map((fu, j) => (
                          <div
                            key={j}
                            className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${priorityBg(fu.priority)}`}
                          >
                            {fu.quote.customerName}
                          </div>
                        ))}
                        {day.followUps.length > 2 && (
                          <div className="text-[10px] text-[var(--color-text-faint)] px-1">+{day.followUps.length - 2}</div>
                        )}
                      </div>
                    )}

                    {hasFU && (
                      <div className="mt-1 flex gap-0.5 sm:hidden justify-center">
                        {day.followUps.slice(0, 3).map((fu, j) => (
                          <span key={j} className={`w-1.5 h-1.5 rounded-full ${priorityColor(fu.priority)}`} />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="px-4 py-2 border-t border-[var(--color-border-light)] flex flex-wrap gap-3 text-[10px] text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Hot</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Warm</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Cold</span>
            </div>
          </div>

          {/* Day Detail Panel */}
          <div className="lg:col-span-1">
            {selectedCalDate ? (
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden sticky top-4">
                <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {new Date(selectedCalDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {selectedCalFollowUps.length > 0
                      ? `${selectedCalFollowUps.length} follow-up${selectedCalFollowUps.length !== 1 ? 's' : ''}`
                      : 'No follow-ups'}
                  </p>
                </div>

                {selectedCalFollowUps.length > 0 ? (
                  <div className="divide-y divide-[var(--color-border-light)]">
                    {selectedCalFollowUps.map((row) => {
                      const status = row.followUp?.status || 'pending'
                      return (
                        <div key={row.quote.id} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${priorityColor(row.priority)}`} />
                            <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{row.quote.customerName}</span>
                          </div>
                          {row.quote.jobDescription && (
                            <p className="text-xs text-[var(--color-text-muted)] truncate mb-1.5 ml-4">{row.quote.jobDescription}</p>
                          )}
                          <div className="flex items-center gap-2 ml-4 text-xs flex-wrap">
                            <span className="text-[var(--color-text-faint)]">${row.quote.estimateLow.toLocaleString()}-${row.quote.estimateHigh.toLocaleString()}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${priorityBg(row.priority)}`}>
                              {statusLabel(status)}
                            </span>
                            <span className="text-[var(--color-text-faint)]">{row.daysSinceQuote}d ago</span>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1.5 mt-2 ml-4 flex-wrap">
                            <button
                              onClick={() => copyMessage(row)}
                              className="text-[10px] px-2 py-1 rounded-md bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              Copy Message
                            </button>
                            {(status === 'pending' || status === 'snoozed') && (
                              <button
                                onClick={() => handleStatusChange(row, 'contacted')}
                                className="text-[10px] px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                              >
                                Contacted
                              </button>
                            )}
                            {status !== 'snoozed' && status !== 'converted' && status !== 'lost' && (
                              <button
                                onClick={() => handleStatusChange(row, 'snoozed')}
                                className="text-[10px] px-2 py-1 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                              >
                                Snooze
                              </button>
                            )}
                            {status !== 'converted' && status !== 'lost' && (
                              <button
                                onClick={() => handleStatusChange(row, 'converted')}
                                className="text-[10px] px-2 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                              >
                                Won
                              </button>
                            )}
                          </div>

                          {/* Contact info */}
                          {(row.quote.phone || row.quote.email) && (
                            <div className="ml-4 mt-2 flex items-center gap-3 text-[10px] text-[var(--color-text-faint)]">
                              {row.quote.phone && <span>{row.quote.phone}</span>}
                              {row.quote.email && <span className="truncate">{row.quote.email}</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">No follow-ups on this day</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Select a Day</h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Click on a day to see follow-ups and take action.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
