'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { AppJob, AppQuote, AppSettings } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { PendingActionsCard } from './PendingActionsCard'
import { DyiaActionButton, DYIA_PROMPTS } from './DyiaActionButton'
import type { LaunchpadItem } from './Launchpad'

// AI Briefing card — fetches from /api/ai/briefing once per session
function DyiaBriefingCard() {
  const [briefing, setBriefing] = useState<{ briefing: string; tip: string | null } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    const sessionKey = `dyia_briefing_${new Date().toDateString()}`
    const cached = sessionStorage.getItem(sessionKey)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard: must read sessionStorage after mount
    if (cached) { setBriefing(JSON.parse(cached)); return }

    fetch('/api/ai/briefing')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.briefing) {
          const b = { briefing: data.briefing, tip: data.tip }
          setBriefing(b)
          sessionStorage.setItem(sessionKey, JSON.stringify(b))
        }
      })
      .catch(() => {})
  }, [])

  if (!briefing || dismissed) return null

  return (
    <div className="animate-fade-in bg-[var(--color-bg-card)] border border-orange-200/50 dark:border-orange-800/30 rounded-xl p-4 flex items-start gap-3">
      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
        <img src="/dyia-agent.png" alt="" className="w-5 h-5 object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{briefing.briefing}</p>
        {briefing.tip && (
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1.5 font-medium">{briefing.tip}</p>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="p-0.5 text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)] rounded shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  )
}

interface DashboardProps {
  jobs: AppJob[]
  quotes: AppQuote[]
  settings: AppSettings
  userName?: string
  onNavigate: (view: string) => void
  pendingFollowUps?: number
  fixedMonthlyExpenses?: number
  isPro?: boolean
  taxPercentage?: number
  onResumePendingAction?: (action: unknown) => void
  launchpadItems?: LaunchpadItem[]
  showLaunchpad?: boolean
  onOpenDyia?: () => void
  onOpenDyiaWithPrompt?: (prompt: string) => void
}

export function Dashboard({ 
  jobs, 
  quotes = [],
  settings, 
  userName,
  onNavigate,
  pendingFollowUps = 0,
  fixedMonthlyExpenses = 0,
  isPro = false,
  taxPercentage = 30,
  onResumePendingAction,
  launchpadItems = [],
  showLaunchpad = false,
  onOpenDyia,
  onOpenDyiaWithPrompt,
}: DashboardProps) {
  
  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const displayName = userName?.includes('@')
    ? userName.split('@')[0]?.split('.')[0] || 'there'
    : userName || 'there'
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1)

  // Calculate workflow stats
  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = jobs.filter(j => {
      const d = new Date(j.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    
    const thisWeek = jobs.filter(j => {
      const d = new Date(j.date)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return d >= weekAgo
    })

    const todayStr = now.toISOString().split('T')[0]
    const todayJobs = jobs.filter(j => j.date === todayStr)
    const todayRevenue = todayJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)

    // Best week (by job count) in last 12 weeks
    const weekCounts: number[] = []
    for (let w = 0; w < 12; w++) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - 7 * (w + 1))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const count = jobs.filter(j => {
        const d = new Date(j.date)
        return d >= weekStart && d < weekEnd
      }).length
      weekCounts.push(count)
    }
    const bestWeekJobs = Math.max(0, ...weekCounts)
    const jobsAwayFromBest = bestWeekJobs > thisWeek.length ? bestWeekJobs - thisWeek.length : 0

    const totalRevenue = thisMonth.reduce((sum, j) => sum + (j.revenue || 0), 0)
    const totalExpenses = thisMonth.reduce((sum, j) => 
      sum + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + 
      (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)

    const pendingQuotes = quotes.filter(q => {
      const created = new Date(q.createdAt)
      const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
      return daysSince < 30 // Active quotes less than 30 days old
    })

    const quoteValue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0)

    const grossProfit = totalRevenue - totalExpenses
    const netProfit = grossProfit - fixedMonthlyExpenses
    const taxSetAside = netProfit > 0 ? netProfit * (taxPercentage / 100) : 0
    const takeHome = netProfit - taxSetAside

    return {
      todayJobs,
      todayJobsCount: todayJobs.length,
      todayRevenue,
      jobsThisWeek: thisWeek.length,
      jobsAwayFromBest,
      jobsThisMonth: thisMonth.length,
      revenueThisMonth: totalRevenue,
      jobExpenses: totalExpenses,
      grossProfit,
      netProfit,
      taxSetAside,
      takeHome,
      pendingQuotes: pendingQuotes.length,
      quoteValue,
      goalProgress: settings.monthlyGoal > 0
        ? Math.round((totalRevenue / settings.monthlyGoal) * 100)
        : 0
    }
  }, [jobs, quotes, settings.monthlyGoal, fixedMonthlyExpenses, taxPercentage])

  // Recent quotes (last 5, newest first)
  const recentQuotes = useMemo(() => {
    return [...quotes]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5)
  }, [quotes])

  // Build action items for the action feed
  const actionItems = useMemo(() => {
    const items: Array<{ id: string; type: 'followup' | 'job' | 'quote' | 'insight'; title: string; subtitle: string; action: () => void; urgency: 'hot' | 'warm' | 'info' }> = []

    // Hot follow-ups
    if (pendingFollowUps > 0) {
      items.push({
        id: 'followups',
        type: 'followup',
        title: `${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? 's' : ''} need attention`,
        subtitle: 'Following up within 48hrs has a 3x conversion rate',
        action: () => onNavigate('followUps'),
        urgency: 'hot',
      })
    }

    // Today's jobs
    if (stats.todayJobsCount > 0) {
      items.push({
        id: 'today-jobs',
        type: 'job',
        title: `${stats.todayJobsCount} job${stats.todayJobsCount !== 1 ? 's' : ''} today`,
        subtitle: `${formatCurrency(stats.todayRevenue)} expected revenue`,
        action: () => onNavigate('jobs'),
        urgency: 'info',
      })
    }

    // Pending quotes
    if (stats.pendingQuotes > 0) {
      items.push({
        id: 'pending-quotes',
        type: 'quote',
        title: `${stats.pendingQuotes} pending quote${stats.pendingQuotes !== 1 ? 's' : ''}`,
        subtitle: `${formatCurrency(stats.quoteValue)} total value`,
        action: () => onNavigate('quotes'),
        urgency: 'warm',
      })
    }

    // Goal progress insight
    if (settings.monthlyGoal > 0 && stats.goalProgress < 100) {
      items.push({
        id: 'goal',
        type: 'insight',
        title: `${stats.goalProgress}% to your monthly goal`,
        subtitle: `${formatCurrency(settings.monthlyGoal - stats.revenueThisMonth)} to go`,
        action: () => {},
        urgency: 'info',
      })
    }

    return items
  }, [pendingFollowUps, stats, settings.monthlyGoal, onNavigate])

  const urgencyColors = {
    hot: 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
    warm: 'border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/10',
    info: 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10',
  }

  const typeIcons = {
    followup: (
      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    job: (
      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    quote: (
      <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    insight: (
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  }

  return (
    <div className="space-y-6 animate-view-enter">
      {/* ===== BRIEFING STRIP ===== */}
      <div className="animate-fade-in">
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden">
          {/* Decorative background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/20" />
            <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-white/10" />
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <img src="/dyia-agent.png" alt="" className="w-8 h-8 sm:w-10 sm:h-10 object-contain mt-0.5 shrink-0 drop-shadow-md" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold">
                  {greeting}, {capitalizedName}
                </h1>
                <p className="text-sm text-white/80 mt-0.5">
                  {stats.todayJobsCount > 0 
                    ? `${stats.todayJobsCount} job${stats.todayJobsCount !== 1 ? 's' : ''} today worth ${formatCurrency(stats.todayRevenue)}.`
                    : jobs.length > 0 
                      ? `${stats.jobsThisMonth} jobs this month, ${formatCurrency(stats.revenueThisMonth)} revenue.`
                      : 'Let\u2019s get your business rolling.'
                  }
                  {pendingFollowUps > 0 && ` ${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? 's' : ''} waiting.`}
                  {stats.goalProgress > 0 && stats.goalProgress < 100 && ` ${stats.goalProgress}% to your goal.`}
                </p>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2 shrink-0">
              <button 
                onClick={() => onNavigate('jobs')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-medium rounded-lg transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Log Job</span>
              </button>
              <button 
                onClick={() => onNavigate('quoteBuilder')}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-medium rounded-lg transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>New Quote</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== AI BRIEFING (Dyia Pro) ===== */}
      {isPro && <DyiaBriefingCard />}

      {/* ===== VISUAL WORKFLOW PIPELINE ===== */}
      <div className="animate-fade-in delay-fade-1">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Business Pipeline
          </h2>
          {stats.jobsAwayFromBest > 0 && stats.jobsThisWeek > 0 && (
            <span className="text-xs text-[var(--color-text-faint)]">
              {stats.jobsAwayFromBest} job{stats.jobsAwayFromBest !== 1 ? 's' : ''} from best week
            </span>
          )}
        </div>
        
        {/* Pipeline - Horizontal flow with arrows */}
        <div className="relative">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {/* Quotes Stage */}
            <button 
              onClick={() => onNavigate('quotes')}
              className="flex-1 min-w-[120px] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-l-xl p-3 sm:p-4 text-left hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase">Quotes</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{stats.pendingQuotes}</p>
              <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)]">{formatCurrency(stats.quoteValue)}</p>
            </button>

            {/* Arrow */}
            <div className="flex items-center -mx-1.5 z-10 text-[var(--color-text-faint)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Follow-ups Stage */}
            <button 
              onClick={() => onNavigate('followUps')}
              className="flex-1 min-w-[120px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 sm:p-4 text-left hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Follow-ups</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{pendingFollowUps}</p>
              <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)]">Pending</p>
            </button>

            {/* Arrow */}
            <div className="flex items-center -mx-1.5 z-10 text-[var(--color-text-faint)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Jobs Stage */}
            <button 
              onClick={() => onNavigate('jobs')}
              className="flex-1 min-w-[120px] bg-[var(--color-bg-card)] border border-[var(--color-border)] p-3 sm:p-4 text-left hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-green-600 dark:text-green-400 uppercase">Jobs</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{stats.jobsThisMonth}</p>
              <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)]">{formatCurrency(stats.revenueThisMonth)}</p>
            </button>

            {/* Arrow */}
            <div className="flex items-center -mx-1.5 z-10 text-[var(--color-text-faint)]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Revenue Stage */}
            <div className="flex-1 min-w-[120px] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-r-xl p-3 sm:p-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-[10px] sm:text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase">Take Home</span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold ${stats.takeHome >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(stats.takeHome)}</p>
              <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)]">After {taxPercentage}% tax</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ACTION FEED ===== */}
      {actionItems.length > 0 && (
        <div className="animate-fade-in delay-fade-2">
          <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            Needs Your Attention
          </h2>
          <div className="space-y-2">
            {actionItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 border border-[var(--color-border)] text-left transition-all hover:shadow-md group ${urgencyColors[item.urgency]}`}
              >
                <span className="shrink-0">{typeIcons[item.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{item.subtitle}</p>
                </div>
                <svg className="w-4 h-4 text-[var(--color-text-faint)] group-hover:text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-all shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== DO IT WITH DYIA PRO ===== */}
      {onOpenDyiaWithPrompt && (
        <div className="animate-fade-in delay-fade-2">
          <div className="flex items-center gap-2 mb-3">
            <img src="/dyia-agent.png" alt="" className="w-4 h-4 object-contain" />
            <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Do it with Dyia
            </h2>
            {!isPro && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-500 uppercase">Pro</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <DyiaActionButton variant="card" label="Log a job" description="Revenue, expenses & details" prompt={DYIA_PROMPTS.logJob} onClick={onOpenDyiaWithPrompt} isPro={isPro}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            />
            <DyiaActionButton variant="card" label="Create a quote" description="Professional estimate" prompt={DYIA_PROMPTS.createQuote} onClick={onOpenDyiaWithPrompt} isPro={isPro}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            />
            <DyiaActionButton variant="card" label="Log expense" description="Track a business cost" prompt={DYIA_PROMPTS.logExpense} onClick={onOpenDyiaWithPrompt} isPro={isPro}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <DyiaActionButton variant="card" label="Business summary" description="Revenue, profit & trends" prompt={DYIA_PROMPTS.businessSummary} onClick={onOpenDyiaWithPrompt} isPro={isPro}
              icon={<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
          </div>
        </div>
      )}

      {/* ===== DYIA PRO UPGRADE NUDGE (for basic users only) ===== */}
      {!isPro && (
        <div className="animate-fade-in delay-fade-2">
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-5 sm:p-6 text-white">
            {/* Decorative glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <img src="/dyia-agent.png" alt="" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Dyia Pro</h3>
                  <p className="text-xs text-slate-400">AI-powered business management</p>
                </div>
              </div>

              <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                Stop doing busywork. Let Dyia handle your jobs, quotes, expenses, and follow-ups through simple chat — so you can focus on making money.
              </p>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {['Log jobs via chat', 'AI quote pricing', 'Smart follow-ups', 'Business insights'].map((feat) => (
                  <div key={feat} className="flex items-center gap-1.5 text-xs text-slate-300">
                    <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {feat}
                  </div>
                ))}
              </div>

              <Link
                href="/app?view=settings"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:shadow-xl active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Try Dyia Pro Free for 14 Days
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ===== GOAL PROGRESS ===== */}
      {settings.monthlyGoal > 0 && (
        <div className="animate-fade-in delay-fade-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Monthly Goal</h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {formatCurrency(stats.revenueThisMonth)} of {formatCurrency(settings.monthlyGoal)}
              </p>
            </div>
            <span className={`text-lg font-bold ${stats.goalProgress >= 100 ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text-primary)]'}`}>
              {stats.goalProgress}%
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full progress-animated ${
                stats.goalProgress >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-orange-500 to-amber-500'
              }`}
              style={{ width: `${Math.min(stats.goalProgress, 100)}%` }} 
            />
          </div>
        </div>
      )}

      {/* Pending Actions from Dyia */}
      <div className="animate-fade-in delay-fade-2">
        <PendingActionsCard 
          onResume={(action) => {
            if (onResumePendingAction) {
              onResumePendingAction(action)
            } else {
              onNavigate('assistant')
            }
          }}
          onDismiss={() => {}}
        />
      </div>

      {/* ===== MONTHLY BREAKDOWN (collapsible) ===== */}
      {stats.revenueThisMonth > 0 && (
        <details className="animate-fade-in delay-fade-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <summary className="px-4 sm:px-5 py-3 cursor-pointer hover:bg-[var(--color-bg-subtle)] transition-colors select-none flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Monthly Breakdown
            </span>
            <svg className="w-4 h-4 text-[var(--color-text-faint)] transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-4 sm:px-5 pb-4 space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Revenue</span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.revenueThisMonth)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Job Expenses</span>
              <span className="text-sm font-medium text-red-500">-{formatCurrency(stats.jobExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Fixed Overhead</span>
              <span className="text-sm font-medium text-red-500">-{formatCurrency(fixedMonthlyExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Tax ({taxPercentage}%)</span>
              <span className="text-sm font-medium text-amber-600">-{formatCurrency(stats.taxSetAside)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 -mx-4 sm:-mx-5 px-4 sm:px-5 rounded-b-lg">
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Take Home</span>
              <span className={`text-base font-bold ${stats.takeHome >= 0 ? 'text-purple-700 dark:text-purple-300' : 'text-red-600'}`}>
                {formatCurrency(stats.takeHome)}
              </span>
            </div>
          </div>
        </details>
      )}

      {/* ===== RECENT ACTIVITY ===== */}
      {(jobs.length > 0 || recentQuotes.length > 0) && (
        <div className="animate-fade-in delay-fade-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Jobs */}
            {jobs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Recent Jobs
                  </h2>
                  <button onClick={() => onNavigate('jobs')} className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
                    View all
                  </button>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                  {jobs.slice(0, 4).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-3 hover:bg-[var(--color-bg-subtle)] transition-colors cursor-pointer" onClick={() => onNavigate('jobs')}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{job.customerName}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {new Date(job.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400 shrink-0 ml-2">{formatCurrency(job.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Quotes */}
            {recentQuotes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Recent Quotes
                  </h2>
                  <button onClick={() => onNavigate('quotes')} className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
                    View all
                  </button>
                </div>
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                  {recentQuotes.slice(0, 4).map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between p-3 hover:bg-[var(--color-bg-subtle)] transition-colors cursor-pointer" onClick={() => onNavigate('quotes')}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{quote.customer.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[var(--color-text-muted)]">{new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              quote.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                              quote.status === 'sent' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                              'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>{quote.status}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 shrink-0 ml-2">{formatCurrency(quote.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== EMPTY STATE ===== */}
      {jobs.length === 0 && !showLaunchpad && (
        <div className="animate-card-pop bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-center py-10 px-6">
          <div className="empty-state-float w-14 h-14 bg-orange-50 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <img src="/dyia-agent.png" alt="" className="w-8 h-8 object-contain" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Welcome to dyia
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm mx-auto">
            I&apos;m Dyia, your business sidekick. Tap the orange orb in the corner to chat with me, or get started below.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button 
              onClick={() => onNavigate('jobs')}
              className="btn-press inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25 text-white text-sm font-medium rounded-xl transition-all duration-200 group"
            >
              <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Your First Job
            </button>
            {onOpenDyia && (
              <button
                onClick={onOpenDyia}
                className="btn-press inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-orange-300 text-[var(--color-text-secondary)] text-sm font-medium rounded-xl transition-all duration-200"
              >
                <img src="/dyia-agent.png" alt="" className="w-4 h-4 object-contain" />
                Chat with Dyia
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
