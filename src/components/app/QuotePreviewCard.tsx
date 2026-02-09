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

  const handleConfirm = (downloadPdf: boolean = false) => {
    onConfirm(editedData, downloadPdf)
  }

  // Generate PDF preview (for immediate download after confirm)
  const generatePdfPreview = () => {
    const doc = new jsPDF()
    let y = 20

    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('ESTIMATE', 105, y, { align: 'center' })
    y += 15

    const businessInfo = settings?.businessInfo

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
    doc.text(editedData.customerName, 20, y)
    y += 6

    if (editedData.customerPhone) {
      doc.text(editedData.customerPhone, 20, y)
      y += 6
    }
    if (editedData.customerAddress) {
      doc.text(editedData.customerAddress, 20, y)
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
      `${formatCurrency(editedData.estimateLow)} - ${formatCurrency(editedData.estimateHigh)}`,
      105, y + 24, { align: 'center' }
    )
    doc.setTextColor(0, 0, 0)
    y += 40

    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    doc.text('Labor and disposal fees are all included', 105, y, { align: 'center' })
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y)
    y += 10

    if (editedData.jobDescription) {
      doc.setFont('helvetica', 'bold')
      doc.text('Job Description:', 20, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      const splitDesc = doc.splitTextToSize(editedData.jobDescription, 170)
      for (let i = 0; i < splitDesc.length; i++) {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(splitDesc[i], 20, y)
        y += 5
      }
    }

    doc.save(`quote-${editedData.customerName.replace(/\s/g, '-')}-${Date.now()}.pdf`)
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
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
              generatePdfPreview()  // Download PDF immediately
              handleConfirm(true)   // Then save the quote
            }}
            disabled={isSubmitting}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
