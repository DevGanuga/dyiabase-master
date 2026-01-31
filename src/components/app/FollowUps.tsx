'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'

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

const STATUS_OPTIONS: { value: FollowUpStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'snoozed', label: 'Snoozed' },
]

const PRIORITY_OPTIONS: { value: FollowUpPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All priorities' },
  { value: 'hot', label: 'Hot 🔥' },
  { value: 'warm', label: 'Warm 🌡️' },
  { value: 'cold', label: 'Cold ❄️' },
]

const STATUS_FILTERS: { value: FollowUpStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'snoozed', label: 'Snoozed' },
]

function getPriority(daysSinceQuote: number): FollowUpPriority {
  if (daysSinceQuote <= 3) return 'hot'
  if (daysSinceQuote <= 7) return 'warm'
  return 'cold'
}

function formatDateInput(iso?: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
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
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | 'all'>('all')
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

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const status = row.followUp?.status || 'pending'
      if (statusFilter === 'all') {
        if (status === 'converted' || status === 'lost') return false
      } else if (status !== statusFilter) {
        return false
      }
      if (priorityFilter !== 'all' && row.priority !== priorityFilter) return false
      return true
    })
  }, [rows, statusFilter, priorityFilter])

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

  const handleSnoozeChange = async (row: FollowUpRow, dateValue: string) => {
    const isoDate = dateValue ? new Date(`${dateValue}T00:00:00`).toISOString() : null
    await updateRow(row, { status: 'snoozed', next_follow_up_at: isoDate })
  }

  const handleNotesChange = (row: FollowUpRow, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.quote.id === row.quote.id
          ? { ...r, followUp: { ...(r.followUp || { quote_id: r.quote.id, id: '' } as FollowUpRecord), notes: value } }
          : r
      )
    )
  }

  const handleNotesBlur = async (row: FollowUpRow) => {
    const notes = row.followUp?.notes || ''
    await updateRow(row, { notes })
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
        <div>
          <h1 className="page-title">Follow-Ups</h1>
          <p className="page-subtitle">{filteredRows.length} quote{filteredRows.length !== 1 ? 's' : ''} to follow up</p>
        </div>
      </div>

      <div className="app-card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="app-label">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FollowUpStatus | 'all')}
              className="app-select"
            >
              {STATUS_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="app-label">Priority</label>
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
      ) : filteredRows.length === 0 ? (
        <div className="app-card">
          <div className="empty-state py-10">
            <div className="empty-state-icon">📬</div>
            <h3 className="empty-state-title">No follow-ups found</h3>
            <p className="empty-state-desc">Create quotes to start tracking follow-ups.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRows.map((row) => {
            const status = row.followUp?.status || 'pending'
            const priorityBadge =
              row.priority === 'hot' ? 'badge-error' :
              row.priority === 'warm' ? 'badge-warning' : 'badge-info'

            const statusBadge =
              status === 'converted' ? 'badge-success' :
              status === 'lost' ? 'badge-error' :
              status === 'contacted' ? 'badge-info' :
              status === 'snoozed' ? 'badge-warning' : 'badge-success'

            return (
              <div key={row.quote.id} className="app-card">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{row.quote.customerName}</h3>
                      <span className={`badge ${priorityBadge}`}>
                        {row.priority === 'hot' ? 'Hot 🔥' : row.priority === 'warm' ? 'Warm 🌡️' : 'Cold ❄️'}
                      </span>
                      <span className={`badge ${statusBadge}`}>
                        {STATUS_OPTIONS.find((opt) => opt.value === status)?.label || 'Pending'}
                      </span>
                      <span className="text-xs text-[var(--color-text-faint)]">
                        {row.daysSinceQuote} day{row.daysSinceQuote !== 1 ? 's' : ''} ago
                      </span>
                    </div>

                    <div className="text-sm text-[var(--color-text-muted)] mb-3">
                      Estimate: <span className="font-semibold text-emerald-600">
                        {formatCurrency(row.quote.estimateLow)} - {formatCurrency(row.quote.estimateHigh)}
                      </span>
                    </div>

                    {row.quote.phone && (
                      <div className="text-sm text-[var(--color-text-muted)] mb-3">
                        Phone:{' '}
                        <a href={`tel:${row.quote.phone}`} className="text-orange-600 hover:text-orange-700 font-medium">
                          {row.quote.phone}
                        </a>
                      </div>
                    )}

                    <div className="text-sm text-[var(--color-text-muted)] mb-4">
                      {row.quote.jobDescription || 'No job description provided.'}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => copyMessage(row)} className="app-btn-ghost text-sm">
                        📋 Copy follow-up message
                      </button>
                    </div>
                  </div>

                  <div className="w-full lg:w-72 space-y-4">
                    <div>
                      <label className="app-label">Status</label>
                      <select
                        value={status}
                        onChange={(e) => handleStatusChange(row, e.target.value as FollowUpStatus)}
                        className="app-select"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {(status === 'snoozed' || row.followUp?.next_follow_up_at) && (
                      <div>
                        <label className="app-label">Snooze until</label>
                        <input
                          type="date"
                          value={formatDateInput(row.followUp?.next_follow_up_at)}
                          onChange={(e) => handleSnoozeChange(row, e.target.value)}
                          className="app-input"
                        />
                      </div>
                    )}

                    <div>
                      <label className="app-label">Notes</label>
                      <textarea
                        rows={3}
                        value={row.followUp?.notes || ''}
                        onChange={(e) => handleNotesChange(row, e.target.value)}
                        onBlur={() => handleNotesBlur(row)}
                        className="app-input resize-none"
                        placeholder="Add follow-up notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
