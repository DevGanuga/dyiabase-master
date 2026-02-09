'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Assistant } from './Assistant'
import type { AssistantHandle } from './Assistant'

interface DyiaPanelProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  showSuccess: (message: string) => void
  currentView?: string
  initialPrompt?: string | null
  onPromptConsumed?: () => void
  isPro?: boolean
}

export function DyiaPanel({ isOpen, onClose, userId, showSuccess, currentView, initialPrompt, onPromptConsumed, isPro = true }: DyiaPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const assistantRef = useRef<AssistantHandle | null>(null)
  const pendingPromptRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen && initialPrompt && isPro) {
      pendingPromptRef.current = initialPrompt
      onPromptConsumed?.()
      if (assistantRef.current) {
        const prompt = pendingPromptRef.current
        pendingPromptRef.current = null
        setTimeout(() => assistantRef.current?.sendMessage(prompt!), 350)
      }
    }
  }, [isOpen, initialPrompt, onPromptConsumed, isPro])

  const handleAssistantRef = useCallback((handle: AssistantHandle | null) => {
    assistantRef.current = handle
    if (handle && pendingPromptRef.current) {
      const prompt = pendingPromptRef.current
      pendingPromptRef.current = null
      setTimeout(() => handle.sendMessage(prompt), 350)
    }
  }, [])

  const contextHints: Record<string, string> = {
    jobs: 'Jobs',
    quotes: 'Quotes',
    quoteBuilder: 'Quote Builder',
    followUps: 'Follow-ups',
    reports: 'Reports',
    customers: 'Customers',
    marketing: 'Marketing',
    settings: 'Settings',
    dashboard: 'Dashboard',
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[65] bg-black/30 sm:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <div
        ref={panelRef}
        className={`
          fixed z-[70] top-0 right-0
          w-[calc(100%-3rem)] max-w-[420px]
          h-full
          bg-[var(--color-bg-page)]
          border-l border-[var(--color-border)]
          shadow-2xl shadow-black/15
          flex flex-col overflow-hidden
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'}
        `}
        role="dialog"
        aria-label="Dyia Assistant"
        aria-hidden={!isOpen}
      >
        {/* ── Rich header ── */}
        <div className="relative shrink-0 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          {/* Accent glow */}
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-orange-500/15 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl" />

          <div className="relative z-10 px-4 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <img src="/dyia-agent.png" alt="Dyia" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white tracking-tight">Dyia</span>
                  <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white uppercase tracking-wider shadow-sm">Pro</span>
                  {isPro && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-sm shadow-green-400/50" />}
                </div>
                {currentView && contextHints[currentView] && (
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{contextHints[currentView]}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {isPro ? (
          <div className="flex-1 min-h-0">
            <Assistant userId={userId} showSuccess={showSuccess} embedded ref={handleAssistantRef} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-orange-500/20">
              <img src="/dyia-agent.png" alt="Dyia" className="w-10 h-10 object-contain" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Meet Dyia Pro</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-5 leading-relaxed max-w-xs">
              Your AI business assistant that logs jobs, creates quotes, tracks expenses, and gives you real-time insights — all through chat.
            </p>
            <div className="space-y-2 text-left w-full max-w-xs mb-6">
              {[
                'Log jobs by just telling Dyia',
                'Create & send professional quotes',
                'AI-powered pricing suggestions',
                'Business performance insights',
                'Follow-up recommendations',
                'Expense tracking via chat',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                  <svg className="w-4 h-4 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            <Link
              href="/app?view=settings"
              onClick={onClose}
              className="w-full max-w-xs inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:shadow-xl active:scale-[0.98]"
            >
              Start 14-Day Free Trial
            </Link>
            <p className="text-xs text-[var(--color-text-faint)] mt-3">No credit card required to start</p>
          </div>
        )}
      </div>
    </>
  )
}
