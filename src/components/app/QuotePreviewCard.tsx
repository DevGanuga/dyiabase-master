'use client'

import { useState, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import type { QuoteProposal, ConfidenceLevel, AppSettings } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

interface QuotePreviewCardProps {
  proposal: QuoteProposal
  onConfirm: (data: QuoteProposal, downloadPdf?: boolean) => void
  onCancel: () => void
  isSubmitting?: boolean
  settings?: AppSettings  // For business info in PDF
}

// Confidence indicator component
function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  const config = {
    high: { color: 'bg-green-500', label: 'Explicit' },
    medium: { color: 'bg-yellow-500', label: 'Likely' },
    inferred: { color: 'bg-slate-400', label: 'Default' }
  }
  const { color, label } = config[level]
  
  return (
    <span className="inline-flex items-center gap-1 ml-1" title={label}>
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
    </span>
  )
}

export function QuotePreviewCard({ proposal, onConfirm, onCancel, isSubmitting, settings }: QuotePreviewCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [editedData, setEditedData] = useState<QuoteProposal>(proposal)

  const handleFieldChange = (field: keyof QuoteProposal, value: string | number) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value,
      confidence: {
        ...prev.confidence,
        [field]: 'high' as ConfidenceLevel
      }
    }))
  }

  // Validation — block submission if critical fields are missing
  const validationErrors = useMemo(() => {
    const errors: string[] = []
    if (!editedData.customerName?.trim()) errors.push('Customer name is required')
    if (!editedData.estimateLow || editedData.estimateLow <= 0) errors.push('Low estimate must be greater than $0')
    if (!editedData.estimateHigh || editedData.estimateHigh <= 0) errors.push('High estimate must be greater than $0')
    if (editedData.estimateLow > 0 && editedData.estimateHigh > 0 && editedData.estimateLow > editedData.estimateHigh) {
      errors.push('Low estimate cannot be higher than high estimate')
    }
    return errors
  }, [editedData.customerName, editedData.estimateLow, editedData.estimateHigh])

  const handleConfirm = (downloadPdf: boolean = false) => {
    if (validationErrors.length > 0) return
    onConfirm(editedData, downloadPdf)
  }

  // Generate professional PDF quote
  const generatePdfPreview = () => {
    const doc = new jsPDF()
    const businessInfo = settings?.businessInfo
    const pageWidth = 210
    const margin = 20
    const contentWidth = pageWidth - margin * 2
    let y = 20

    // ── Header: Business info + Quote title ──
    if (businessInfo?.logo) {
      try { doc.addImage(businessInfo.logo, 'PNG', margin, y, 35, 35); } catch { /* skip */ }
    }

    const headerX = businessInfo?.logo ? margin + 42 : margin
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(businessInfo?.name || 'Estimate', headerX, y + 8)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    let subY = y + 15
    if (businessInfo?.phone) { doc.text(businessInfo.phone, headerX, subY); subY += 5 }
    if (businessInfo?.email) { doc.text(businessInfo.email, headerX, subY); subY += 5 }
    if (businessInfo?.address) { doc.text(businessInfo.address, headerX, subY); subY += 5 }

    // Quote badge (right side)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(249, 115, 22)
    doc.text('ESTIMATE', pageWidth - margin, y + 8, { align: 'right' })
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    const quoteRef = `#Q-${Date.now().toString(36).toUpperCase().slice(-6)}`
    doc.text(quoteRef, pageWidth - margin, y + 16, { align: 'right' })
    doc.text(`Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, pageWidth - margin, y + 22, { align: 'right' })
    doc.text('Valid for 30 days', pageWidth - margin, y + 28, { align: 'right' })

    y = Math.max(subY, y + 32) + 8

    // ── Divider ──
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    // ── Customer info ──
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('PREPARED FOR', margin, y)
    y += 6
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(editedData.customerName, margin, y)
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    if (editedData.customerPhone) { doc.text(editedData.customerPhone, margin, y); y += 5 }
    if (editedData.customerEmail) { doc.text(editedData.customerEmail, margin, y); y += 5 }
    if (editedData.customerAddress) { doc.text(editedData.customerAddress, margin, y); y += 5 }
    y += 10

    // ── Job description ──
    if (editedData.jobDescription) {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('SCOPE OF WORK', margin, y)
      y += 6
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(editedData.jobDescription, contentWidth)
      for (const line of lines) {
        if (y > 260) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += 5
      }
      y += 8
    }

    // ── Price box ──
    const boxH = 35
    // Orange gradient effect (solid orange)
    doc.setFillColor(249, 115, 22)
    doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('ESTIMATED COST', margin + contentWidth / 2, y + 12, { align: 'center' })
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `${formatCurrency(editedData.estimateLow)} – ${formatCurrency(editedData.estimateHigh)}`,
      margin + contentWidth / 2, y + 27, { align: 'center' }
    )
    y += boxH + 6

    doc.setTextColor(120, 120, 120)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('All labor, materials, and disposal fees are included in this estimate.', margin + contentWidth / 2, y, { align: 'center' })
    y += 15

    // ── Terms & conditions ──
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, y, pageWidth - margin, y)
    y += 8
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('TERMS & CONDITIONS', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    const terms = [
      '1. This estimate is valid for 30 days from the date shown above.',
      '2. Final price may vary based on actual conditions found on site.',
      '3. Payment is due upon completion of work unless otherwise agreed.',
      '4. Additional items or scope changes may result in price adjustments.',
    ]
    for (const term of terms) {
      doc.text(term, margin, y)
      y += 4.5
    }

    // ── Footer ──
    y = 280
    doc.setDrawColor(230, 230, 230)
    doc.line(margin, y, pageWidth - margin, y)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`${businessInfo?.name || 'Dyia'} — Thank you for your business!`, margin + contentWidth / 2, y + 5, { align: 'center' })

    doc.save(`estimate-${editedData.customerName.replace(/\s+/g, '-').toLowerCase()}-${quoteRef.slice(1)}.pdf`)
  }

  // Check if we have missing customer contact info
  const missingInfo = useMemo(() => {
    const missing: string[] = []
    if (!editedData.customerPhone) missing.push('phone')
    if (!editedData.customerEmail) missing.push('email')
    if (!editedData.customerAddress) missing.push('address')
    return missing
  }, [editedData])

  return (
    <div className="quote-preview-card bg-white dark:bg-slate-800 rounded-xl border-2 border-blue-200 dark:border-blue-800 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <h3 className="font-semibold text-white">Quote Preview</h3>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className="text-white/90 hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Customer Name */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
            Customer Name
            <ConfidenceIndicator level={editedData.confidence?.customerName || 'high'} />
          </label>
          {editMode ? (
            <input
              type="text"
              value={editedData.customerName}
              onChange={(e) => handleFieldChange('customerName', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          ) : (
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">{editedData.customerName}</p>
          )}
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
              Phone
              <ConfidenceIndicator level={editedData.confidence?.customerPhone || 'inferred'} />
            </label>
            {editMode ? (
              <input
                type="tel"
                value={editedData.customerPhone || ''}
                onChange={(e) => handleFieldChange('customerPhone', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(555) 123-4567"
              />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                {editedData.customerPhone || <span className="text-slate-400 italic">Not provided</span>}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
              Email
              <ConfidenceIndicator level={editedData.confidence?.customerEmail || 'inferred'} />
            </label>
            {editMode ? (
              <input
                type="email"
                value={editedData.customerEmail || ''}
                onChange={(e) => handleFieldChange('customerEmail', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="customer@example.com"
              />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                {editedData.customerEmail || <span className="text-slate-400 italic">Not provided</span>}
              </p>
            )}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
            Job Address
            <ConfidenceIndicator level={editedData.confidence?.customerAddress || 'inferred'} />
          </label>
          {editMode ? (
            <input
              type="text"
              value={editedData.customerAddress || ''}
              onChange={(e) => handleFieldChange('customerAddress', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="123 Main St, City, State"
            />
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
              {editedData.customerAddress || <span className="text-slate-400 italic">Not provided</span>}
            </p>
          )}
        </div>

        {/* Job Description */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
            Job Description
            <ConfidenceIndicator level={editedData.confidence?.jobDescription || 'high'} />
          </label>
          {editMode ? (
            <textarea
              value={editedData.jobDescription || ''}
              onChange={(e) => handleFieldChange('jobDescription', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              placeholder="Describe the work..."
            />
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
              {editedData.jobDescription || <span className="text-slate-400 italic">No description</span>}
            </p>
          )}
        </div>

        {/* Estimate Range - Highlighted */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <label className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2 block">Estimate Range</label>
          {editMode ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-blue-600 dark:text-blue-500">Low</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600">$</span>
                  <input
                    type="number"
                    value={editedData.estimateLow || ''}
                    onChange={(e) => handleFieldChange('estimateLow', parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-2 py-1.5 text-lg font-bold rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-blue-700 dark:text-blue-300"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-blue-600 dark:text-blue-500">High</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-600">$</span>
                  <input
                    type="number"
                    value={editedData.estimateHigh || ''}
                    onChange={(e) => handleFieldChange('estimateHigh', parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-2 py-1.5 text-lg font-bold rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-blue-700 dark:text-blue-300"
                    min="0"
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 text-center">
              {formatCurrency(editedData.estimateLow)} - {formatCurrency(editedData.estimateHigh)}
            </p>
          )}
        </div>

        {/* Missing Info Warning */}
        {missingInfo.length > 0 && !editMode && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <span className="font-medium">Tip:</span> Add {missingInfo.join(', ')} for better follow-up tracking.
              <button 
                onClick={() => setEditMode(true)} 
                className="ml-1 underline hover:no-underline"
              >
                Edit
              </button>
            </p>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && !editMode && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-xs text-red-700 dark:text-red-400 font-medium mb-1">Missing required info:</p>
            {validationErrors.map((err, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400">• {err}</p>
            ))}
            <button onClick={() => setEditMode(true)} className="mt-1.5 text-xs text-red-700 dark:text-red-400 underline hover:no-underline font-medium">
              Edit to fix
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => handleConfirm(false)}
              disabled={isSubmitting || validationErrors.length > 0}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Quote
                </>
              )}
            </button>
          </div>
          <button
            onClick={() => {
              if (validationErrors.length > 0) return
              generatePdfPreview()
              handleConfirm(true)
            }}
            disabled={isSubmitting || validationErrors.length > 0}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Save Quote & Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
