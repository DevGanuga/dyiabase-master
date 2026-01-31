'use client'

import { createClient } from '@/lib/supabase/client'
import type { AppQuote, AppSettings } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { jsPDF } from 'jspdf'
import { useConfirm } from '@/components/providers/ConfirmProvider'

interface QuotesProps {
  quotes: AppQuote[]
  setQuotes: (quotes: AppQuote[]) => void
  userId: string
  settings: AppSettings
  onCreateQuote: () => void
  showSuccess: (message: string) => void
}

export function Quotes({ quotes, setQuotes, userId, settings, onCreateQuote, showSuccess }: QuotesProps) {
  const supabase = createClient()
  const { confirm, alert } = useConfirm()

  const sortedQuotes = [...quotes].sort((a, b) => b.createdAt - a.createdAt)

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
      showSuccess('🗑️ Quote deleted')
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

      // Estimate box - using emerald/teal colors
      doc.setFillColor(16, 185, 129) // emerald-500
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
      showSuccess('📄 PDF downloaded!')
    } catch (error) {
      console.error('PDF generation error:', error)
      await alert({ title: 'Error', message: 'Error generating PDF.', variant: 'error' })
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">{quotes.length} quote{quotes.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button onClick={onCreateQuote} className="app-btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Quote
        </button>
      </div>

      <div className="app-card p-0 overflow-hidden">
        {sortedQuotes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 className="empty-state-title">No quotes yet</h3>
            <p className="empty-state-desc">Create professional PDF quotes for your customers.</p>
            <button onClick={onCreateQuote} className="app-btn-primary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Quote
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th className="text-left">Date</th>
                  <th className="text-left">Customer</th>
                  <th className="text-right">Estimate</th>
                  <th className="text-center">Photos</th>
                  <th className="text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedQuotes.map(quote => (
                  <tr key={quote.id}>
                    <td className="font-medium text-[var(--color-text-primary)]">
                      {new Date(quote.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="font-medium text-[var(--color-text-primary)]">{quote.customer.name}</div>
                      {quote.customer.phone && (
                        <div className="text-sm text-[var(--color-text-muted)]">{quote.customer.phone}</div>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="font-semibold text-emerald-600">
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
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition"
                          title="Download PDF"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteQuote(quote.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
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
