'use client'

import { useState, useMemo } from 'react'
import type { JobProposal, ConfidenceLevel } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

interface JobPreviewCardProps {
  proposal: JobProposal
  onConfirm: (data: JobProposal) => void
  onCancel: () => void
  isSubmitting?: boolean
}

const MARKETING_SOURCES = ['Google', 'Facebook', 'Referral', 'Repeat Customer', 'Yelp', 'Craigslist', 'Instagram', 'Nextdoor', 'Thumbtack', 'HomeAdvisor', 'Website', 'Other', 'Unknown']

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

export function JobPreviewCard({ proposal, onConfirm, onCancel, isSubmitting }: JobPreviewCardProps) {
  const [editMode, setEditMode] = useState(false)
  const [editedData, setEditedData] = useState<JobProposal>(proposal)

  // Calculate profit and margin
  const calculations = useMemo(() => {
    const totalExpenses = editedData.labor + editedData.gas + editedData.dumpFee + 
                          editedData.dumpsterRental + editedData.additionalExpense +
                          (editedData.numWorkers * editedData.costPerWorker)
    const profit = editedData.revenue - totalExpenses
    const margin = editedData.revenue > 0 ? Math.round((profit / editedData.revenue) * 100) : 0
    
    return { totalExpenses, profit, margin }
  }, [editedData])

  const handleFieldChange = (field: keyof JobProposal, value: string | number) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value,
      confidence: {
        ...prev.confidence,
        [field]: 'high' as ConfidenceLevel // Mark edited fields as high confidence
      }
    }))
  }

  const handleConfirm = () => {
    onConfirm(editedData)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="job-preview-card bg-white dark:bg-slate-800 rounded-xl border-2 border-orange-200 dark:border-orange-800 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h3 className="font-semibold text-white">Job Preview</h3>
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
        {/* Customer & Date Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
              Customer
              <ConfidenceIndicator level={editedData.confidence?.customerName || 'medium'} />
            </label>
            {editMode ? (
              <input
                type="text"
                value={editedData.customerName}
                onChange={(e) => handleFieldChange('customerName', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">{editedData.customerName}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
              Date
              <ConfidenceIndicator level={editedData.confidence?.date || 'inferred'} />
            </label>
            {editMode ? (
              <input
                type="date"
                value={editedData.date}
                onChange={(e) => handleFieldChange('date', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            ) : (
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1">{formatDate(editedData.date)}</p>
            )}
          </div>
        </div>

        {/* Source */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
            Lead Source
            <ConfidenceIndicator level={editedData.confidence?.source || 'inferred'} />
          </label>
          {editMode ? (
            <select
              value={editedData.source || 'Unknown'}
              onChange={(e) => handleFieldChange('source', e.target.value)}
              className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {MARKETING_SOURCES.map(src => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{editedData.source || 'Unknown'}</p>
          )}
        </div>

        {/* Revenue - Highlighted */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
          <label className="text-xs font-medium text-green-700 dark:text-green-400 flex items-center">
            Revenue
            <ConfidenceIndicator level={editedData.confidence?.revenue || 'high'} />
          </label>
          {editMode ? (
            <div className="relative mt-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-green-600">$</span>
              <input
                type="number"
                value={editedData.revenue || ''}
                onChange={(e) => handleFieldChange('revenue', parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-2 py-1.5 text-lg font-bold rounded-lg border border-green-200 dark:border-green-700 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-green-500 focus:border-transparent text-green-700 dark:text-green-300"
                min="0"
              />
            </div>
          ) : (
            <p className="text-xl font-bold text-green-700 dark:text-green-300 mt-1">{formatCurrency(editedData.revenue)}</p>
          )}
        </div>

        {/* Expenses Grid */}
        <div>
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">Expenses</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { key: 'labor', label: 'Labor', icon: '👷' },
              { key: 'gas', label: 'Gas', icon: '⛽' },
              { key: 'dumpFee', label: 'Dump Fee', icon: '🗑️' },
              { key: 'dumpsterRental', label: 'Dumpster', icon: '📦' },
              { key: 'additionalExpense', label: 'Other', icon: '💸' },
            ].map(({ key, label, icon }) => (
              <div key={key} className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>{icon}</span>
                  {label}
                  <ConfidenceIndicator level={editedData.confidence?.[key as keyof typeof editedData.confidence] as ConfidenceLevel || 'inferred'} />
                </label>
                {editMode ? (
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      value={editedData[key as keyof JobProposal] as number || ''}
                      onChange={(e) => handleFieldChange(key as keyof JobProposal, parseFloat(e.target.value) || 0)}
                      className="w-full pl-6 pr-1 py-1 text-sm rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-1 focus:ring-orange-500"
                      min="0"
                    />
                  </div>
                ) : (
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">
                    {formatCurrency(editedData[key as keyof JobProposal] as number || 0)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Workers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
              Workers
              <ConfidenceIndicator level={editedData.confidence?.numWorkers || 'inferred'} />
            </label>
            {editMode ? (
              <input
                type="number"
                value={editedData.numWorkers || 1}
                onChange={(e) => handleFieldChange('numWorkers', parseInt(e.target.value) || 1)}
                className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                min="1"
                max="10"
              />
            ) : (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">{editedData.numWorkers}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
              Cost/Worker
              <ConfidenceIndicator level={editedData.confidence?.costPerWorker || 'inferred'} />
            </label>
            {editMode ? (
              <div className="relative mt-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  value={editedData.costPerWorker || ''}
                  onChange={(e) => handleFieldChange('costPerWorker', parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="0"
                />
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">{formatCurrency(editedData.costPerWorker)}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        {(editMode || editedData.notes) && (
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center">
              Notes
              <ConfidenceIndicator level={editedData.confidence?.notes || 'inferred'} />
            </label>
            {editMode ? (
              <textarea
                value={editedData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className="w-full mt-1 px-2 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                rows={2}
                placeholder="Add notes about this job..."
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 italic">{editedData.notes}</p>
            )}
          </div>
        )}

        {/* Profit Summary */}
        <div className={`rounded-lg p-3 ${calculations.profit >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Revenue</p>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(editedData.revenue)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Expenses</p>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{formatCurrency(calculations.totalExpenses)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase">Profit</p>
              <p className={`text-sm font-bold ${calculations.profit >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(calculations.profit)} <span className="text-xs font-normal">({calculations.margin}%)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Job
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
