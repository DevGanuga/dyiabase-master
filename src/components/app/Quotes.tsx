'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppQuote, AppSettings, AppJob, QuoteStatus } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { jsPDF } from 'jspdf'
import { useConfirm } from '@/components/providers/ConfirmProvider'

interface QuotesProps {
  quotes: AppQuote[]
  setQuotes: (quotes: AppQuote[]) => void
  jobs: AppJob[]
  userId: string
  settings: AppSettings
  onCreateQuote: (job?: AppJob) => void
  showSuccess: (message: string) => void
}

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' },
  sent: { label: 'Sent', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  accepted: { label: 'Accepted', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  declined: { label: 'Declined', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  expired: { label: 'Expired', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
}

export function Quotes({ quotes, setQuotes, jobs, userId, settings, onCreateQuote, showSuccess }: QuotesProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all')
  const [linkingQuoteId, setLinkingQuoteId] = useState<string | null>(null)

  const supabase = createClient()
  const { confirm, alert } = useConfirm()

  // Build a job lookup map
  const jobMap = useMemo(() => {
    const map = new Map<string, AppJob>()
    jobs.forEach(j => map.set(j.id, j))
    return map
  }, [jobs])

  // Filter and sort quotes
  const filteredQuotes = useMemo(() => {
    let list = [...quotes]

    if (statusFilter !== 'all') {
      list = list.filter(q => q.status === statusFilter)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      list = list.filter(q =>
        q.customer.name.toLowerCase().includes(query) ||
        q.customer.email?.toLowerCase().includes(query) ||
        q.customer.phone?.toLowerCase().includes(query) ||
        q.customer.address?.toLowerCase().includes(query)
      )
    }

    return list.sort((a, b) => b.createdAt - a.createdAt)
  }, [quotes, statusFilter, searchQuery])

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: quotes.length }
    quotes.forEach(q => {
      counts[q.status] = (counts[q.status] || 0) + 1
    })
    return counts
  }, [quotes])

  const updateQuoteStatus = async (quoteId: string, newStatus: QuoteStatus) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'sent') {
        updateData.sent_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('dyia_quotes')
        .update(updateData)
        .eq('id', quoteId)
        .eq('user_id', userId)

      if (error) throw error

      setQuotes(quotes.map(q => q.id === quoteId ? {
        ...q,
        status: newStatus,
        sentAt: newStatus === 'sent' ? Date.now() : q.sentAt
      } : q))
      showSuccess(`Quote marked as ${newStatus}`)
    } catch (error) {
      console.error('Error updating quote status:', error)
      await alert({ title: 'Error', message: 'Failed to update quote status.', variant: 'error' })
    }
  }

  const linkQuoteToJob = async (quoteId: string, jobId: string) => {
    try {
      const { error } = await supabase
        .from('dyia_quotes')
        .update({ job_id: jobId })
        .eq('id', quoteId)
        .eq('user_id', userId)

      if (error) throw error

      setQuotes(quotes.map(q => q.id === quoteId ? { ...q, jobId } : q))
      setLinkingQuoteId(null)
      showSuccess('Quote linked to job')
    } catch (error) {
      console.error('Error linking quote to job:', error)
      await alert({ title: 'Error', message: 'Failed to link quote to job.', variant: 'error' })
    }
  }

  const unlinkQuoteFromJob = async (quoteId: string) => {
    try {
      const { error } = await supabase
        .from('dyia_quotes')
        .update({ job_id: null })
        .eq('id', quoteId)
        .eq('user_id', userId)

      if (error) throw error

      setQuotes(quotes.map(q => q.id === quoteId ? { ...q, jobId: undefined } : q))
      showSuccess('Quote unlinked from job')
    } catch (error) {
      console.error('Error unlinking quote:', error)
      await alert({ title: 'Error', message: 'Failed to unlink quote.', variant: 'error' })
    }
  }

  const deleteQuote = async (id: string) => {
    const ok = await confirm({ title: 'Delete Quote', message: 'Are you sure you want to delete this quote? Its follow-up will also be removed.', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('dyia_quotes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      setQuotes(quotes.filter(q => q.id !== id))
      showSuccess('Quote deleted')
    } catch (error) {
      console.error('Error deleting quote:', error)
      await alert({ title: 'Error', message: 'Error deleting quote.', variant: 'error' })
    }
  }

  const downloadQuotePDF = async (quote: AppQuote) => {
    try {
      const doc = new jsPDF()
      let y = 20

      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      doc.text('ESTIMATE', 105, y, { align: 'center' })
      y += 15

      const businessInfo = settings.businessInfo

      if (businessInfo?.logo) {
        try {
          doc.addImage(businessInfo.logo, 'PNG', 80, y, 50, 50)
          y += 55
        } catch (logoError) {
          console.error('Error adding logo to PDF:', logoError)
        }
      }

      if (businessInfo?.name?.trim()) {
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(businessInfo.name, 105, y, { align: 'center' })
        y += 7
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        if (businessInfo.phone?.trim()) {
          doc.text(businessInfo.phone, 105, y, { align: 'center' })
          y += 6
        }
        if (businessInfo.email?.trim()) {
          doc.text(businessInfo.email, 105, y, { align: 'center' })
          y += 6
        }
        y += 5
      }
      y += 10

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('PREPARED FOR:', 20, y)
      y += 7
      doc.setFont('helvetica', 'normal')
      doc.text(quote.customer.name, 20, y)
      y += 6

      if (quote.customer.phone) {
        doc.text(quote.customer.phone, 20, y)
        y += 6
      }
      if (quote.customer.address) {
        doc.text(quote.customer.address, 20, y)
        y += 6
      }
      y += 10

      doc.setFillColor(249, 115, 22)
      doc.rect(20, y, 170, 30, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('ESTIMATED COST', 105, y + 12, { align: 'center' })
      doc.setFontSize(22)
      doc.text(
        `${formatCurrency(quote.estimateRange.low)} - ${formatCurrency(quote.estimateRange.high)}`,
        105, y + 24, { align: 'center' }
      )
      doc.setTextColor(0, 0, 0)
      y += 40

      doc.setFontSize(10)
      doc.setFont('helvetica', 'italic')
      doc.text('Labor and disposal fees are all included', 105, y, { align: 'center' })
      y += 8

      doc.setFont('helvetica', 'normal')
      doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, 20, y)
      y += 10

      if (quote.customer.jobDescription) {
        doc.setFont('helvetica', 'bold')
        if (y > 250) { doc.addPage(); y = 20 }
        doc.text('Job Description:', 20, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        const splitDesc = doc.splitTextToSize(quote.customer.jobDescription, 170)
        for (let i = 0; i < splitDesc.length; i++) {
          if (y > 270) { doc.addPage(); y = 20 }
          doc.text(splitDesc[i], 20, y)
          y += 5
        }
        y += 5
      }

      if (quote.photos && quote.photos.length > 0) {
        if (y > 200) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('Job Photos:', 20, y)
        y += 10

        const photoWidth = 55
        const photoHeight = 45
        let x = 20

        for (let i = 0; i < quote.photos.length && i < 3; i++) {
          try {
            if (y + photoHeight > 280) { doc.addPage(); y = 20; x = 20 }
            doc.addImage(quote.photos[i], 'JPEG', x, y, photoWidth, photoHeight)
            x += photoWidth + 5
            if (x > 160) { x = 20; y += photoHeight + 5 }
          } catch (photoError) {
            console.error('Error adding photo to PDF:', photoError)
          }
        }
      }

      doc.save(`quote-${quote.customer.name.replace(/\s/g, '-')}-${Date.now()}.pdf`)
      showSuccess('PDF downloaded!')
    } catch (error) {
      console.error('PDF generation error:', error)
      await alert({ title: 'Error', message: 'Error generating PDF.', variant: 'error' })
    }
  }

  // Empty state
  if (quotes.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Quotes</h1>
            <p className="page-subtitle">Create professional estimates for your customers</p>
          </div>
        </div>

        <div className="app-card">
          <div className="text-center py-12 px-6">
            <div className="w-20 h-20 bg-orange-50 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">
              Create Your First Quote
            </h3>
            <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
              Build a professional estimate for a potential customer. You can optionally link it to an existing job later.
            </p>
            <button
              onClick={() => onCreateQuote()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-all duration-200 group"
            >
              <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Quote
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">{quotes.length} estimate{quotes.length !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={() => onCreateQuote()} className="app-btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Quote
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'sent', 'accepted', 'declined', 'expired'] as const).map(s => {
            const count = statusCounts[s] || 0
            if (s !== 'all' && count === 0) return null
            const isActive = statusFilter === s
            const config = s === 'all' ? null : STATUS_CONFIG[s]
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)]'
                }`}
              >
                {s === 'all' ? 'All' : config!.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Quotes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredQuotes.map((quote, index) => {
          const linkedJob = quote.jobId ? jobMap.get(quote.jobId) : undefined
          const statusConf = STATUS_CONFIG[quote.status]
          const isLinking = linkingQuoteId === quote.id

          return (
            <div
              key={quote.id}
              className="stagger-card bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 hover:border-orange-300 hover:shadow-md transition-all duration-200 group"
              style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
            >
              {/* Header: customer + status */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[var(--color-text-primary)] truncate">
                    {quote.customer.name}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConf.color} ${statusConf.bg}`}>
                  {statusConf.label}
                </span>
              </div>

              {/* Estimate range */}
              <div className="mb-3">
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(quote.estimateRange.low)} - {formatCurrency(quote.estimateRange.high)}
                </span>
              </div>

              {/* Customer details */}
              {(quote.customer.phone || quote.customer.address) && (
                <div className="text-xs text-[var(--color-text-muted)] mb-3 space-y-0.5">
                  {quote.customer.phone && <p>{quote.customer.phone}</p>}
                  {quote.customer.address && <p className="truncate">{quote.customer.address}</p>}
                </div>
              )}

              {/* Linked job badge */}
              {linkedJob && !isLinking && (
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                    </svg>
                    {linkedJob.customerName}
                  </span>
                  <button
                    onClick={() => unlinkQuoteFromJob(quote.id)}
                    className="text-xs text-[var(--color-text-faint)] hover:text-red-500 transition-colors"
                    title="Unlink from job"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Link-to-job dropdown */}
              {isLinking && (
                <div className="mb-3 p-2 bg-[var(--color-bg-subtle)] rounded-lg">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Link to job:</p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {jobs.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)] py-1">No jobs yet</p>
                    ) : (
                      jobs.slice(0, 10).map(job => (
                        <button
                          key={job.id}
                          onClick={() => linkQuoteToJob(quote.id, job.id)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-[var(--color-bg-card)] transition-colors"
                        >
                          <span className="font-medium">{job.customerName}</span>
                          <span className="text-[var(--color-text-faint)] ml-1">
                            {new Date(job.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    onClick={() => setLinkingQuoteId(null)}
                    className="mt-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                <div className="flex gap-1">
                  {/* Status quick-actions */}
                  {quote.status === 'draft' && (
                    <button
                      onClick={() => updateQuoteStatus(quote.id, 'sent')}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                      title="Mark as sent"
                    >
                      Mark Sent
                    </button>
                  )}
                  {(quote.status === 'sent' || quote.status === 'draft') && (
                    <button
                      onClick={() => updateQuoteStatus(quote.id, 'accepted')}
                      className="text-xs px-2 py-1 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition"
                      title="Mark as accepted"
                    >
                      Accepted
                    </button>
                  )}
                  {quote.status === 'sent' && (
                    <button
                      onClick={() => updateQuoteStatus(quote.id, 'declined')}
                      className="text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition"
                      title="Mark as declined"
                    >
                      Declined
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {/* Link to job */}
                  {!quote.jobId && !isLinking && (
                    <button
                      onClick={() => setLinkingQuoteId(quote.id)}
                      className="p-1.5 text-[var(--color-text-faint)] hover:text-blue-500 rounded-lg transition"
                      title="Link to job"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                      </svg>
                    </button>
                  )}
                  {/* Download PDF */}
                  <button
                    onClick={() => downloadQuotePDF(quote)}
                    className="p-1.5 text-[var(--color-text-faint)] hover:text-orange-500 rounded-lg transition"
                    title="Download PDF"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => deleteQuote(quote.id)}
                    className="p-1.5 text-[var(--color-text-faint)] hover:text-red-500 rounded-lg transition"
                    title="Delete"
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

      {filteredQuotes.length === 0 && (searchQuery || statusFilter !== 'all') && (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)]">
            No quotes match your filters.
          </p>
        </div>
      )}
    </div>
  )
}
