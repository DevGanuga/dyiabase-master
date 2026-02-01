'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppQuote, AppSettings, AppJob } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { jsPDF } from 'jspdf'
import { useConfirm } from '@/components/providers/ConfirmProvider'

interface QuotesProps {
  quotes: AppQuote[]
  setQuotes: (quotes: AppQuote[]) => void
  jobs: AppJob[]
  userId: string
  settings: AppSettings
  onCreateQuote: (job: AppJob) => void
  onNavigateToJobs: () => void
  showSuccess: (message: string) => void
}

export function Quotes({ quotes, setQuotes, jobs, userId, settings, onCreateQuote, onNavigateToJobs, showSuccess }: QuotesProps) {
  const [selectedJob, setSelectedJob] = useState<AppJob | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  const supabase = createClient()
  const { confirm, alert } = useConfirm()

  // Filter jobs based on search
  const filteredJobs = useMemo(() => {
    const sorted = [...jobs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (!searchQuery) return sorted
    return sorted.filter(job => 
      job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.source && job.source.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [jobs, searchQuery])

  // Get quotes for the selected job
  const jobQuotes = useMemo(() => {
    if (!selectedJob) return []
    return quotes
      .filter(q => q.jobId === selectedJob.id)
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [quotes, selectedJob])

  // Get quote count for each job
  const getQuoteCountForJob = (jobId: string) => {
    return quotes.filter(q => q.jobId === jobId).length
  }

  const deleteQuote = async (id: string) => {
    const ok = await confirm({ title: 'Delete Quote', message: 'Are you sure you want to delete this quote?', confirmLabel: 'Delete', variant: 'danger' })
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

      // Add logo if exists
      if (businessInfo?.logo) {
        try {
          doc.addImage(businessInfo.logo, 'PNG', 80, y, 50, 50)
          y += 55
        } catch (logoError) {
          console.error('Error adding logo to PDF:', logoError)
        }
      }

      // Business info
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

      // Customer info
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

      // Estimate box - using brand orange color
      doc.setFillColor(249, 115, 22) // orange-500
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

      // Job description
      if (quote.customer.jobDescription) {
        doc.setFont('helvetica', 'bold')

        if (y > 250) {
          doc.addPage()
          y = 20
        }

        doc.text('Job Description:', 20, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        const splitDesc = doc.splitTextToSize(quote.customer.jobDescription, 170)

        for (let i = 0; i < splitDesc.length; i++) {
          if (y > 270) {
            doc.addPage()
            y = 20
          }
          doc.text(splitDesc[i], 20, y)
          y += 5
        }
        y += 5
      }

      // Add photos if exist
      if (quote.photos && quote.photos.length > 0) {
        if (y > 200) {
          doc.addPage()
          y = 20
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.text('Job Photos:', 20, y)
        y += 10

        const photoWidth = 55
        const photoHeight = 45
        let x = 20

        for (let i = 0; i < quote.photos.length && i < 3; i++) {
          try {
            if (y + photoHeight > 280) {
              doc.addPage()
              y = 20
              x = 20
            }

            doc.addImage(quote.photos[i], 'JPEG', x, y, photoWidth, photoHeight)
            x += photoWidth + 5

            if (x > 160) {
              x = 20
              y += photoHeight + 5
            }
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

  // No jobs state - guide user to create a job first
  if (jobs.length === 0) {
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
            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">
              Create a Job First
            </h3>
            <p className="text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
              Quotes are linked to jobs. Log a job with your customer&apos;s information first, then you can create quotes for them.
            </p>
            <button 
              onClick={onNavigateToJobs}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-all duration-200 group"
            >
              <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Your First Job
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Selected job view - show quotes for that job
  if (selectedJob) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedJob(null)}
              className="p-2 hover:bg-[var(--color-bg-subtle)] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="page-title">{selectedJob.customerName}</h1>
              <p className="page-subtitle">
                {new Date(selectedJob.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {selectedJob.source && <span className="text-orange-600 dark:text-orange-400"> · {selectedJob.source}</span>}
              </p>
            </div>
          </div>
          <button 
            onClick={() => onCreateQuote(selectedJob)} 
            className="app-btn-primary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Quote
          </button>
        </div>

        {/* Job Details Card */}
        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Job Details</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Revenue: {formatCurrency(selectedJob.revenue)}</p>
            </div>
          </div>
          {selectedJob.notes && (
            <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-subtle)] rounded-lg p-3">
              {selectedJob.notes}
            </p>
          )}
        </div>

        {/* Quotes List */}
        <div className="app-card p-0 overflow-hidden">
          {jobQuotes.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                No quotes yet
              </h3>
              <p className="text-[var(--color-text-muted)] mb-4">
                Create a professional estimate for {selectedJob.customerName}
              </p>
              <button 
                onClick={() => onCreateQuote(selectedJob)} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-all duration-200 group"
              >
                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Quote
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="app-table">
                <thead>
                  <tr>
                    <th className="text-left">Date</th>
                    <th className="text-right">Estimate</th>
                    <th className="text-center">Photos</th>
                    <th className="text-right w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobQuotes.map(quote => (
                    <tr key={quote.id}>
                      <td className="font-medium text-[var(--color-text-primary)]">
                        {new Date(quote.createdAt).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {formatCurrency(quote.estimateRange.low)} - {formatCurrency(quote.estimateRange.high)}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className="badge badge-info">
                          {quote.photos?.length || 0} photo{(quote.photos?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => downloadQuotePDF(quote)}
                            className="p-2 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/30 dark:hover:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-lg transition"
                            title="Download PDF"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteQuote(quote.id)}
                            className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Default view - job selector
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">Select a job to view or create quotes</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredJobs.map((job, index) => {
          const quoteCount = getQuoteCountForJob(job.id)
          
          return (
            <button
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className="stagger-card text-left bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 hover:border-orange-300 hover:shadow-md transition-all duration-200 group"
              style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center group-hover:bg-orange-50 dark:group-hover:bg-orange-900/30 transition-colors">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-orange-600 transition-colors">
                      {job.customerName}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {new Date(job.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-[var(--color-text-faint)] group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {job.source && (
                    <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">
                      {job.source}
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatCurrency(job.revenue)}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  quoteCount > 0 
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' 
                    : 'bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)]'
                }`}>
                  {quoteCount} quote{quoteCount !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {filteredJobs.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)]">No jobs found matching &quot;{searchQuery}&quot;</p>
        </div>
      )}
    </div>
  )
}
