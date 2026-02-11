'use client'

import { useState, useEffect, useCallback } from 'react'

interface Nudge {
  id: string
  type: 'followup' | 'insight' | 'setup' | 'celebration'
  message: string
  action?: {
    label: string
    view?: string
    onClick?: () => void
  }
}

interface DyiaNudgeProps {
  /** Current view for context */
  currentView: string
  /** Pending follow-ups count */
  pendingFollowUps: number
  /** Whether user is new */
  isNewUser: boolean
  /** Navigation handler */
  onNavigate: (view: string) => void
  /** Open Dyia panel */
  onOpenDyia: () => void
  /** Jobs count (for triggering celebrations) */
  jobCount: number
  /** Whether user has set up business info */
  hasBusinessInfo: boolean
}

export function DyiaNudge({
  pendingFollowUps,
  isNewUser,
  onNavigate,
  onOpenDyia,
  jobCount,
  hasBusinessInfo,
}: DyiaNudgeProps) {
  const [currentNudge, setCurrentNudge] = useState<Nudge | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [exiting, setExiting] = useState(false)

  // Generate nudges based on context
  const generateNudges = useCallback((): Nudge[] => {
    const nudges: Nudge[] = []
    const dismissedIds = JSON.parse(sessionStorage.getItem('dyia_dismissed_nudges') || '[]') as string[]
    const dismissedSet = new Set(dismissedIds)

    // New user setup nudges
    if (isNewUser && !dismissedSet.has('setup-welcome')) {
      nudges.push({
        id: 'setup-welcome',
        type: 'setup',
        message: 'Tap the orange orb to chat with Dyia. I\'ll help you get everything set up!',
        action: { label: 'Talk to Dyia', onClick: onOpenDyia },
      })
    }

    // Missing business info
    if (!hasBusinessInfo && jobCount > 0 && !dismissedSet.has('setup-business')) {
      nudges.push({
        id: 'setup-business',
        type: 'setup',
        message: 'Add your business info to make your quotes look professional.',
        action: { label: 'Add info', view: 'settings' },
      })
    }

    // Follow-up reminders
    if (pendingFollowUps > 2 && !dismissedSet.has('followup-reminder')) {
      nudges.push({
        id: 'followup-reminder',
        type: 'followup',
        message: `You have ${pendingFollowUps} follow-ups pending. Quick follow-ups convert 3x better!`,
        action: { label: 'View follow-ups', view: 'followUps' },
      })
    }

    // Job milestones
    if (jobCount === 1 && !dismissedSet.has('first-job-congrats')) {
      nudges.push({
        id: 'first-job-congrats',
        type: 'celebration',
        message: 'First job logged! You\'re on your way. Want to create a quote next?',
        action: { label: 'Create quote', view: 'quoteBuilder' },
      })
    }

    if (jobCount === 10 && !dismissedSet.has('ten-jobs')) {
      nudges.push({
        id: 'ten-jobs',
        type: 'celebration',
        message: '10 jobs logged! Your data is getting good. Ask Dyia for insights!',
        action: { label: 'Ask Dyia', onClick: onOpenDyia },
      })
    }

    return nudges.filter(n => !dismissedSet.has(n.id))
  }, [isNewUser, hasBusinessInfo, pendingFollowUps, jobCount, onOpenDyia])

  // Show nudges with a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      const nudges = generateNudges()
      if (nudges.length > 0 && !currentNudge) {
        setCurrentNudge(nudges[0])
      }
    }, 3000) // 3 second delay before showing nudges

    return () => clearTimeout(timer)
  }, [generateNudges, currentNudge])

  const handleDismiss = useCallback(() => {
    if (!currentNudge) return
    setExiting(true)
    
    setTimeout(() => {
      const newDismissed = new Set(dismissed)
      newDismissed.add(currentNudge.id)
      setDismissed(newDismissed)
      
      // Persist to session
      const stored = JSON.parse(sessionStorage.getItem('dyia_dismissed_nudges') || '[]') as string[]
      stored.push(currentNudge.id)
      sessionStorage.setItem('dyia_dismissed_nudges', JSON.stringify(stored))
      
      setCurrentNudge(null)
      setExiting(false)
    }, 200)
  }, [currentNudge, dismissed])

  const handleAction = useCallback(() => {
    if (!currentNudge?.action) return
    if (currentNudge.action.onClick) {
      currentNudge.action.onClick()
    } else if (currentNudge.action.view) {
      onNavigate(currentNudge.action.view)
    }
    handleDismiss()
  }, [currentNudge, onNavigate, handleDismiss])

  if (!currentNudge) return null

  const typeStyles = {
    followup: 'border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/30',
    insight: 'border-blue-200 dark:border-blue-800/50 bg-blue-50/80 dark:bg-blue-950/30',
    setup: 'border-orange-200 dark:border-orange-800/50 bg-orange-50/80 dark:bg-orange-950/30',
    celebration: 'border-green-200 dark:border-green-800/50 bg-green-50/80 dark:bg-green-950/30',
  }

  return (
    <div
      className={`
        fixed bottom-24 right-5 sm:right-6 z-40
        w-[300px] max-w-[calc(100vw-2.5rem)]
        rounded-2xl border shadow-xl p-4
        transition-all duration-200
        ${exiting ? 'opacity-0 translate-y-2 scale-95' : 'opacity-100 translate-y-0 scale-100'}
        ${typeStyles[currentNudge.type]}
      `}
      style={{ animation: exiting ? undefined : 'dyiaOrbBubble 0.3s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div className="flex items-start gap-2.5">
        <img src="/dyia-agent.png" alt="" className="w-5 h-5 object-contain mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{currentNudge.message}</p>
          {currentNudge.action && (
            <button
              onClick={handleAction}
              className="mt-2 text-xs font-medium text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
            >
              {currentNudge.action.label} &rarr;
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="p-0.5 text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] rounded transition-colors shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

    </div>
  )
}
