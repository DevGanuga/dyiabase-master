'use client'

import Link from 'next/link'

/**
 * Contextual "Build with Dyia" button.
 * When isPro is false, shows a locked state with upgrade CTA.
 */

interface DyiaActionButtonProps {
  /** The prompt to send to Dyia when clicked */
  prompt: string
  /** Button label */
  label: string
  /** Optional description shown below the label */
  description?: string
  /** Visual variant */
  variant?: 'default' | 'compact' | 'card'
  /** Click handler - should open Dyia with the prompt */
  onClick: (prompt: string) => void
  /** Optional icon override */
  icon?: React.ReactNode
  /** Optional className */
  className?: string
  /** Whether user has pro access (active or trialing) */
  isPro?: boolean
}

const DyiaIcon = () => (
  <img src="/dyia-agent.png" alt="" className="w-4 h-4 object-contain shrink-0" />
)

const LockIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

export function DyiaActionButton({
  prompt,
  label,
  description,
  variant = 'default',
  onClick,
  icon,
  className = '',
  isPro = true,
}: DyiaActionButtonProps) {
  const handleClick = () => {
    if (isPro) {
      onClick(prompt)
    }
  }

  // ─── LOCKED STATE (basic users) ───
  if (!isPro) {
    if (variant === 'compact') {
      return (
        <Link
          href="/app?view=settings"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
            text-slate-400 dark:text-slate-500
            bg-slate-100/80 dark:bg-slate-800/50
            border border-slate-200/50 dark:border-slate-700/30
            rounded-lg transition-all duration-150
            hover:border-orange-300 dark:hover:border-orange-700
            hover:text-orange-600 dark:hover:text-orange-400
            ${className}`}
          title="Upgrade to Dyia Pro"
        >
          <LockIcon className="w-3 h-3" />
          <span>Dyia Pro</span>
        </Link>
      )
    }

    if (variant === 'card') {
      return (
        <Link
          href="/app?view=settings"
          className={`group w-full flex items-center gap-3 p-3.5
            bg-slate-50/50 dark:bg-slate-800/30
            border border-dashed border-slate-200 dark:border-slate-700
            rounded-xl text-left
            hover:border-orange-300 dark:hover:border-orange-700
            hover:bg-orange-50/30 dark:hover:bg-orange-950/10
            transition-all duration-200
            ${className}`}
        >
          <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-gradient-to-br group-hover:from-orange-500 group-hover:to-amber-500 transition-all">
            <LockIcon className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500 group-hover:text-[var(--color-text-primary)] transition-colors">{label}</p>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-500 uppercase tracking-wide">Pro</span>
            </div>
            {description && (
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5 leading-snug">Upgrade to unlock</p>
            )}
          </div>
          <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-orange-500 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )
    }

    // Default locked
    return (
      <Link
        href="/app?view=settings"
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
          text-slate-400 dark:text-slate-500
          bg-slate-100 dark:bg-slate-800/50
          border border-slate-200/60 dark:border-slate-700/40
          rounded-xl transition-all duration-150
          hover:border-orange-300 dark:hover:border-orange-700
          hover:text-orange-600 dark:hover:text-orange-400
          ${className}`}
        title="Upgrade to Dyia Pro"
      >
        <LockIcon className="w-4 h-4" />
        <span>{label}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-500">PRO</span>
      </Link>
    )
  }

  // ─── UNLOCKED STATE (pro / trial users) ───
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
          text-orange-600 dark:text-orange-400 
          bg-orange-50/80 dark:bg-orange-950/30 
          hover:bg-orange-100 dark:hover:bg-orange-950/50
          border border-orange-200/50 dark:border-orange-800/30
          rounded-lg transition-all duration-150
          hover:shadow-sm active:scale-[0.97]
          ${className}`}
        title={`Ask Dyia: ${label}`}
      >
        {icon || <DyiaIcon />}
        <span>{label}</span>
      </button>
    )
  }

  if (variant === 'card') {
    return (
      <button
        onClick={handleClick}
        className={`group w-full flex items-center gap-3 p-3.5
          bg-[var(--color-bg-card)]
          border border-[var(--color-border)]
          rounded-xl text-left
          hover:border-orange-300 dark:hover:border-orange-700
          hover:shadow-md hover:shadow-orange-500/5
          transition-all duration-200 active:scale-[0.99]
          ${className}`}
      >
        <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm">
          {icon || <img src="/dyia-agent.png" alt="" className="w-5 h-5 object-contain" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
          {description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-snug">{description}</p>
          )}
        </div>
        <svg className="w-4 h-4 text-[var(--color-text-faint)] group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    )
  }

  // Default unlocked
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
        text-orange-700 dark:text-orange-300
        bg-orange-50 dark:bg-orange-950/30
        hover:bg-orange-100 dark:hover:bg-orange-950/50
        border border-orange-200/60 dark:border-orange-800/40
        rounded-xl transition-all duration-150
        hover:shadow-md hover:shadow-orange-500/10 active:scale-[0.98]
        ${className}`}
      title={`Ask Dyia: ${label}`}
    >
      {icon || <DyiaIcon />}
      <span>{label}</span>
    </button>
  )
}

/**
 * Pre-configured Dyia prompts for common tasks.
 */
export const DYIA_PROMPTS = {
  logJob: 'I just finished a job and want to log it. Ask me for the customer name, revenue, date, and any expenses.',
  jobStats: 'How did I do this week? Show me my job stats and revenue breakdown.',
  createQuote: 'I need to create a quote for a customer. Walk me through it — ask for customer name, contact info, job description, and price range.',
  suggestPrice: 'I have a job coming up. Based on my history, what should I charge? Help me price it.',
  checkFollowUps: 'Show me my pending follow-ups. Which ones are highest priority and need my attention now?',
  logExpense: 'I need to log a business expense. Ask me what it was for, the amount, and the category.',
  customerInsights: 'Give me insights about my customers — who are my repeat customers, best referral sources, and top revenue generators?',
  businessSummary: 'Give me a full summary of how my business is doing this month — revenue, expenses, profit, and trends.',
  weeklyStats: 'How did I do this week? Compare it to last week.',
} as const
