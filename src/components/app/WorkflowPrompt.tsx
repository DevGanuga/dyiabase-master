'use client'

import { useState, useEffect, useCallback } from 'react'

export interface WorkflowAction {
  id: string
  label: string
  description?: string
  action: () => void
  icon?: React.ReactNode
  primary?: boolean
}

interface WorkflowPromptProps {
  /** Title of the prompt */
  title: string
  /** Actions to suggest */
  actions: WorkflowAction[]
  /** Auto-dismiss after ms (0 = never) */
  autoDismissMs?: number
  /** Callback when dismissed */
  onDismiss?: () => void
}

export function WorkflowPrompt({ title, actions, autoDismissMs = 15000, onDismiss }: WorkflowPromptProps) {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  const handleDismiss = useCallback(() => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, 200)
  }, [onDismiss])

  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => handleDismiss(), autoDismissMs)
      return () => clearTimeout(timer)
    }
  }, [autoDismissMs, handleDismiss])

  const handleAction = (action: () => void) => {
    action()
    handleDismiss()
  }

  if (!visible) return null

  return (
    <div
      className={`
        fixed bottom-20 left-1/2 -translate-x-1/2 z-40
        w-[calc(100%-2rem)] max-w-md
        bg-[var(--color-bg-card)] border border-[var(--color-border)]
        rounded-2xl shadow-2xl p-4
        transition-all duration-200
        ${exiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}
      `}
      style={{ animation: exiting ? undefined : 'workflowSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <img src="/dyia-agent.png" alt="" className="w-6 h-6 object-contain" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] rounded-lg transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.action)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
              ${action.primary
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow-md'
                : 'bg-[var(--color-bg-subtle,#f8fafc)] hover:bg-slate-100 dark:hover:bg-slate-700 text-[var(--color-text-secondary)] border border-[var(--color-border)]'
              }
            `}
          >
            {action.icon && <span className="shrink-0">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Auto-dismiss progress bar */}
      {autoDismissMs > 0 && (
        <div className="mt-3 h-0.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500/30 rounded-full"
            style={{
              animation: `shrinkWidth ${autoDismissMs}ms linear forwards`,
            }}
          />
        </div>
      )}

    </div>
  )
}
