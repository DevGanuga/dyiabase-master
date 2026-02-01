'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
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
    }
    if (status !== 'snoozed') {
      updates.next_follow_up_at = null
    }
    await updateRow(row, updates)
  }

  const KANBAN_COLUMN_CONFIG: { id: FollowUpStatus; title: string; color: string }[] = [
    { id: 'pending', title: 'Pending', color: '#f97316' },
    { id: 'contacted', title: 'Contacted', color: '#3b82f6' },
    { id: 'snoozed', title: 'Snoozed', color: '#eab308' },
    { id: 'converted', title: 'Converted', color: '#22c55e' },
    { id: 'lost', title: 'Lost', color: '#ef4444' },
  ]

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
