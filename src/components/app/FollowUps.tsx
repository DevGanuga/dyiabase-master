'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import KanbanBoard, { type KanbanColumn, type KanbanFollowUp } from '@/components/ui/kanban-board'

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
  customerName: string
  phone?: string
  jobDescription?: string
  estimateLow: number
  estimateHigh: number
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

function generateFollowUpMessage(quote: QuoteSummary, businessName: string) {
  const job = quote.jobDescription?.trim() || 'job'
  return `Hi ${quote.customerName}! This is ${businessName} following up on the estimate we provided for your ${job}. The estimate was $${quote.estimateLow}-$${quote.estimateHigh}. Would you like to schedule this job? Let me know if you have any questions!`
}

const KANBAN_COLUMN_CONFIG: { id: FollowUpStatus; title: string; color: string }[] = [
  { id: 'pending', title: 'Pending', color: '#f97316' },
  { id: 'contacted', title: 'Contacted', color: '#3b82f6' },
  { id: 'snoozed', title: 'Snoozed', color: '#eab308' },
  { id: 'converted', title: 'Converted', color: '#22c55e' },
  { id: 'lost', title: 'Lost', color: '#ef4444' },
]

export function FollowUps({ userId, businessName = 'dyia', showSuccess }: FollowUpsProps) {
  const supabase = useMemo(() => createClient(), [])
  const { alert } = useConfirm()
  const [rows, setRows] = useState<FollowUpRow[]>([])
  const [loading, setLoading] = useState(true)
  const [priorityFilter, setPriorityFilter] = useState<FollowUpPriority | 'all'>('all')

  useEffect(() => {
    const loadFollowUps = async () => {
      if (!userId) return
      setLoading(true)

      try {
        const { data: quotesData, error: quotesError } = await supabase
          .from('dyia_quotes')
          .select('id, created_at, customer_name, customer_phone, job_description, estimate_low, estimate_high')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (quotesError) throw quotesError

        const { data: followUpsData, error: followUpsError } = await supabase
          .from('dyia_follow_ups')
          .select('*')
          .eq('user_id', userId)

        if (followUpsError) throw followUpsError

        const followUpMap = new Map<string, FollowUpRecord>()
        ;(followUpsData || []).forEach((followUp: FollowUpRecord) => {
          followUpMap.set(followUp.quote_id, followUp)
        })

        const nextRows: FollowUpRow[] = (quotesData || []).map((q) => {
          const createdAt = new Date(q.created_at).getTime()
          const daysSinceQuote = Math.max(0, Math.floor((Date.now() - createdAt) / 86400000))
          const priority = getPriority(daysSinceQuote)

          const quote: QuoteSummary = {
            id: q.id,
            createdAt,
            customerName: q.customer_name,
            phone: q.customer_phone || undefined,
            jobDescription: q.job_description || undefined,
            estimateLow: parseFloat(q.estimate_low) || 0,
            estimateHigh: parseFloat(q.estimate_high) || 0,
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

      // Create a new job pre-filled from the quote
      const { data: job, error: jobError } = await supabase
        .from('dyia_jobs')
        .insert({
          user_id: userId,
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
        .map((r): KanbanFollowUp => ({
          id: r.followUp?.id || r.quote.id,
          quoteId: r.quote.id,
          customerName: r.quote.customerName,
          phone: r.quote.phone,
          jobDescription: r.quote.jobDescription,
          estimateLow: r.quote.estimateLow,
          estimateHigh: r.quote.estimateHigh,
          status: (r.followUp?.status || 'pending') as FollowUpStatus,
          priority: r.priority,
          daysSinceQuote: r.daysSinceQuote,
          contactCount: r.followUp?.contact_count || 0,
          notes: r.followUp?.notes,
          nextFollowUpAt: r.followUp?.next_follow_up_at,
        })),
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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="page-title text-xl sm:text-3xl">Follow-Ups</h1>
            <p className="page-subtitle text-sm sm:text-base">
              {`${rows.length} total follow-up${rows.length !== 1 ? 's' : ''}`}
            </p>
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
      ) : (
        <KanbanBoard
          columns={kanbanColumns}
          onStatusChange={handleKanbanStatusChange}
          onCopyMessage={handleKanbanCopyMessage}
        />
      )}
    </div>
  )
}
