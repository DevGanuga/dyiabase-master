'use client'

import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

interface PendingAction {
  id: string
  action_type: 'create_job' | 'generate_quote' | 'log_expense'
  proposal_data: {
    customerName?: string
    customer_name?: string
    revenue?: number
    estimateLow?: number
    estimate_low?: number
    estimateHigh?: number
    estimate_high?: number
    jobDescription?: string
    job_description?: string
  }
  original_message?: string
  created_at: string
}

interface PendingActionsCardProps {
  onResume: (action: PendingAction) => void
  onDismiss: (actionId: string) => void
}

export function PendingActionsCard({ onResume, onDismiss }: PendingActionsCardProps) {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPendingActions = async () => {
      try {
        const response = await fetch('/api/pending-actions')
        if (response.ok) {
          const data = await response.json()
          setActions(data.pendingActions || [])
        }
      } catch (error) {
        console.error('Error fetching pending actions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPendingActions()
  }, [])

  const handleDismiss = async (actionId: string) => {
    try {
      await fetch('/api/pending-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, status: 'cancelled' })
      })
      setActions(prev => prev.filter(a => a.id !== actionId))
      onDismiss(actionId)
    } catch (error) {
      console.error('Error dismissing action:', error)
    }
  }

  if (loading) {
    return null // Don't show while loading
  }

  if (actions.length === 0) {
    return null // Don't render if no pending actions
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'create_job': return '📋'
      case 'generate_quote': return '📝'
      case 'log_expense': return '💸'
      default: return '📌'
    }
  }

  const getActionTitle = (action: PendingAction) => {
    const data = action.proposal_data
    const name = data.customerName || data.customer_name || 'Unknown'
    
    switch (action.action_type) {
      case 'create_job':
        return `Job for ${name}`
      case 'generate_quote':
        return `Quote for ${name}`
      case 'log_expense':
        return 'New expense'
      default:
        return 'Pending action'
    }
  }

  const getActionSubtitle = (action: PendingAction) => {
    const data = action.proposal_data
    
    switch (action.action_type) {
      case 'create_job':
        return data.revenue ? formatCurrency(data.revenue) : ''
      case 'generate_quote': {
        const low = data.estimateLow || data.estimate_low
        const high = data.estimateHigh || data.estimate_high
        if (low && high) {
          return `${formatCurrency(low)} - ${formatCurrency(high)}`
        }
        return data.jobDescription || data.job_description || ''
      }
      default:
        return ''
    }
  }

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200/50 dark:border-orange-800/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-[var(--color-text-primary)] text-sm">
            Continue with Dyia
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {actions.length} action{actions.length !== 1 ? 's' : ''} waiting for you
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {actions.slice(0, 3).map(action => (
          <div 
            key={action.id}
            className="flex items-center gap-3 p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors group"
          >
            <span className="text-lg">{getActionIcon(action.action_type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {getActionTitle(action)}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                {getActionSubtitle(action)} · {getTimeAgo(action.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onResume(action)}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Resume
              </button>
              <button
                onClick={() => handleDismiss(action.id)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                title="Dismiss"
                aria-label={`Dismiss ${getActionTitle(action)}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {actions.length > 3 && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2 text-center">
          +{actions.length - 3} more pending
        </p>
      )}
    </div>
  )
}
