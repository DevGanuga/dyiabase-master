'use client'

import { useState, useEffect, useCallback } from 'react'

export interface LaunchpadItem {
  id: string
  label: string
  description?: string
  completed: boolean
  action?: () => void
}

interface LaunchpadProps {
  items: LaunchpadItem[]
  onDismiss?: () => void
}

export function Launchpad({ items, onDismiss }: LaunchpadProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  
  const completedCount = items.filter(i => i.completed).length
  const totalCount = items.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const allComplete = completedCount === totalCount

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dyia_launchpad_collapsed')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage on mount
    if (saved) setIsCollapsed(JSON.parse(saved))

    const dismissedSaved = localStorage.getItem('dyia_launchpad_dismissed')
    if (dismissedSaved) setDismissed(JSON.parse(dismissedSaved))
  }, [])

  // Save collapsed state
  const toggleCollapse = useCallback(() => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('dyia_launchpad_collapsed', JSON.stringify(newState))
  }, [isCollapsed])

  // Celebrate completion
  useEffect(() => {
    if (allComplete && !showCelebration) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time celebration trigger
      setShowCelebration(true)
      const timer = setTimeout(() => {
        setDismissed(true)
        localStorage.setItem('dyia_launchpad_dismissed', 'true')
        onDismiss?.()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [allComplete, showCelebration, onDismiss])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('dyia_launchpad_dismissed', 'true')
    onDismiss?.()
  }

  if (dismissed) return null

  return (
    <div className="mx-3 mb-3">
      <div className={`rounded-lg border overflow-hidden transition-all duration-300 ${
        allComplete 
          ? 'bg-green-900/20 border-green-700/50' 
          : 'bg-slate-800/50 border-slate-700/50'
      }`}>
        {/* Header */}
        <button
          onClick={toggleCollapse}
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/30 transition-colors group"
        >
          <div className="flex items-center gap-2">
            {allComplete ? (
              <span className="text-green-400 animate-bounce">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            ) : (
              <span className="text-orange-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
            )}
            <span className={`text-sm font-medium ${allComplete ? 'text-green-300' : 'text-slate-200'}`}>
              {allComplete ? 'All set!' : 'Getting Started'}
            </span>
            {!allComplete && (
              <span className="text-xs text-slate-500 tabular-nums">
                {completedCount}/{totalCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {allComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDismiss() }}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Dismiss"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <svg 
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </div>
        </button>

        {/* Content */}
        <div className={`transition-all duration-200 ease-out ${
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
        }`}>
          <div className="px-3 pb-3">
            {/* Progress bar */}
            <div className="relative h-1 bg-slate-700 rounded-full overflow-hidden mb-3">
              <div 
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
                  allComplete ? 'bg-green-500' : 'bg-gradient-to-r from-orange-500 to-amber-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Items */}
            <div className="space-y-0.5">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  disabled={item.completed || !item.action}
                  className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-md text-left transition-all group ${
                    item.completed 
                      ? 'text-slate-500 cursor-default' 
                      : item.action
                        ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white cursor-pointer'
                        : 'text-slate-400 cursor-default'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  title={item.completed ? undefined : item.action ? `Open: ${item.label}` : undefined}
                >
                  <span className="flex-shrink-0">
                    {item.completed ? (
                      <span className="text-green-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className={`block w-4 h-4 rounded-full border-2 transition-colors ${
                        item.action ? 'border-slate-500 group-hover:border-orange-400' : 'border-slate-600'
                      }`} />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm truncate ${item.completed ? 'line-through decoration-slate-600' : ''}`}>
                      {item.label}
                    </span>
                    {item.description && (
                      <span className={`block text-xs mt-0.5 truncate ${item.completed ? 'text-slate-600' : 'text-slate-500'}`}>
                        {item.description}
                      </span>
                    )}
                  </span>
                  {!item.completed && item.action && (
                    <span className="flex-shrink-0 text-xs font-medium text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Go →
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Celebration message */}
            {allComplete && showCelebration && (
              <div className="mt-3 p-2 bg-green-900/30 border border-green-700/30 rounded-md text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <p className="text-xs text-green-300">
                  You&apos;re all set to grow your business!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
