'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { AppJob, AppQuote, AppSettings } from '@/types/database'
import { formatCurrency, parseLocalDate } from '@/lib/utils'
import { PendingActionsCard } from './PendingActionsCard'
import { DyiaActionButton, DYIA_PROMPTS } from './DyiaActionButton'
import { AIInsights } from './AIInsights'
import { MiniCalendar } from './MiniCalendar'
import type { LaunchpadItem } from './Launchpad'

// Dynamic message from Dyia based on which step is next
function getDyiaMessage(items: LaunchpadItem[]): string {
  const completedCount = items.filter(i => i.completed).length
  if (completedCount === 0) {
    return "Welcome! I'm Dyia, your AI business partner. Let's get you set up so I can start helping you make more money. It only takes a minute."
  }
  const next = items.find(i => !i.completed)
  if (!next) return "You're all set! Your dashboard is ready to go."
  const msgs: Record<string, string> = {
    'onboarding': "Great start! Next, let's finish setting up your business profile so I can personalize everything for you.",
    'business-info': "Now let's add your business info — this is what shows on your quotes and helps you look professional.",
    'first-job': "Nice progress! Log your first job so I can start tracking your revenue and profits.",
    'first-customer': "Let's build your customer database. This helps me track repeat business and suggest follow-ups.",
    'first-quote': "Try creating a quote — you can send professional estimates to customers in seconds.",
    'first-template': "Almost done! Save a price template to speed up future quotes. You'll thank yourself later.",
  }
  return msgs[next.id] || "Keep going — you're almost there!"
}

function GettingStartedCard({ items }: { items: LaunchpadItem[] }) {
  const completedCount = items.filter(i => i.completed).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  if (completedCount === totalCount) return null

  const dyiaMessage = getDyiaMessage(items)

  return (
    <div className="onboarding-checklist">
      {/* Dyia guide header */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 dark:from-orange-500/20 dark:to-amber-500/20 p-1.5">
            <img src="/dyia-agent.png" alt="Dyia" className="w-full h-full object-contain rounded-lg" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--color-bg-card)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Dyia</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">AI Guide</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{dyiaMessage}</p>
        </div>
      </div>

      {/* Progress section */}
      <div className="px-5 py-3 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-[var(--color-text-muted)] whitespace-nowrap">{completedCount}/{totalCount}</span>
      </div>

      {/* Checklist */}
      <div className="px-3 pb-3 space-y-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            disabled={item.completed || !item.action}
            className={`checklist-item group ${item.completed ? 'completed' : item.action ? 'actionable' : ''}`}
          >
            <span className="flex-shrink-0">
              {item.completed ? (
                <div className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-orange-400 transition-colors" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.completed ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)]'}`}>
                {item.label}
              </p>
              {item.description && !item.completed && (
                <p className="text-xs text-[var(--color-text-muted)] truncate">{item.description}</p>
              )}
            </div>
            {!item.completed && item.action && (
              <svg className="w-4 h-4 text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// Revenue Forecast card (Pro) — client-side calculation using job data
function RevenueForecastCard({ jobs, onOpenDyiaWithPrompt }: { jobs: AppJob[]; onOpenDyiaWithPrompt?: (prompt: string) => void }) {
  const forecast = useMemo(() => {
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const recentJobs = jobs.filter(j => j.status !== 'scheduled' && parseLocalDate(j.date) >= threeMonthsAgo)

    if (recentJobs.length < 5) return null

    // This month calculations
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = daysInMonth - dayOfMonth

    const thisMonthRevenue = recentJobs
      .filter(j => parseLocalDate(j.date) >= thisMonthStart)
      .reduce((sum, j) => sum + (j.revenue || 0), 0)

    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const lastMonthRevenue = recentJobs
      .filter(j => { const d = parseLocalDate(j.date); return d >= lastMonthStart && d <= lastMonthEnd })
      .reduce((sum, j) => sum + (j.revenue || 0), 0)

    // Two months ago
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0)
    const twoMonthsAgoRevenue = recentJobs
      .filter(j => { const d = parseLocalDate(j.date); return d >= twoMonthsAgoStart && d <= twoMonthsAgoEnd })
      .reduce((sum, j) => sum + (j.revenue || 0), 0)

    const monthlyAverage = (lastMonthRevenue + twoMonthsAgoRevenue) / 2
    const dailyPace = dayOfMonth > 0 ? thisMonthRevenue / dayOfMonth : 0
    const pacedForecast = thisMonthRevenue + (dailyPace * daysRemaining)
    const paceWeight = Math.min(dayOfMonth / daysInMonth + 0.3, 0.8)
    const projected = Math.round((pacedForecast * paceWeight) + (monthlyAverage * (1 - paceWeight)))
    const confidence: 'high' | 'medium' | 'low' = dayOfMonth >= 15 ? 'high' : dayOfMonth >= 7 ? 'medium' : 'low'

    return {
      projected,
      current: thisMonthRevenue,
      remaining: Math.max(0, projected - thisMonthRevenue),
      daysRemaining,
      confidence,
      percentComplete: projected > 0 ? Math.round((thisMonthRevenue / projected) * 100) : 0,
    }
  }, [jobs])

  if (!forecast) return null

  const confidenceLabel = { high: 'High confidence', medium: 'Moderate confidence', low: 'Early estimate' }
  const confidenceColor = { high: 'text-green-600 dark:text-green-400', medium: 'text-amber-600 dark:text-amber-400', low: 'text-slate-500' }

  return (
    <div className="stat-card !p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Revenue Forecast</h3>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/10 text-orange-500 uppercase">Pro</span>
        </div>
        <span className={`text-xs font-medium ${confidenceColor[forecast.confidence]}`}>
          {confidenceLabel[forecast.confidence]}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(forecast.projected)}</span>
        <span className="text-xs text-[var(--color-text-muted)]">projected this month</span>
      </div>

      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 progress-animated"
          style={{ width: `${Math.min(forecast.percentComplete, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>{formatCurrency(forecast.current)} earned so far</span>
        <span>{forecast.daysRemaining} days left</span>
      </div>

      {onOpenDyiaWithPrompt && (
        <button
          onClick={() => onOpenDyiaWithPrompt('Give me a detailed revenue forecast for this month and next month. Include trends and recommendations.')}
          className="mt-3 w-full text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium text-center"
        >
          Ask Dyia for detailed forecast &rarr;
        </button>
      )}
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
  onLogDailyExpenses?: (date: string) => void
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
  onLogDailyExpenses,
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
      const d = parseLocalDate(j.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    
    const thisWeek = jobs.filter(j => {
      const d = parseLocalDate(j.date)
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return d >= weekAgo
    })

    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
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
        const d = parseLocalDate(j.date)
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
      return q.status === 'sent' || q.status === 'draft'
    })

    const quoteValue = pendingQuotes.reduce((sum, q) => sum + (q.total || 0), 0)

    const grossProfit = totalRevenue - totalExpenses
    const netProfit = grossProfit - fixedMonthlyExpenses
    const taxSetAside = netProfit > 0 ? netProfit * (taxPercentage / 100) : 0
    const takeHome = netProfit - taxSetAside

    const todayExpenses = todayJobs.reduce((sum, j) =>
      sum + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) +
      (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)
    const todayHasExpenses = todayExpenses > 0
    const todayProfit = todayRevenue - todayExpenses

    const byDate = new Map<string, { revenue: number; expenses: number }>()
    thisMonth.forEach(j => {
      const rev = (j.revenue || 0)
      const exp = (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + (j.dumpsterRental || 0) + (j.additionalExpense || 0)
      const cur = byDate.get(j.date) || { revenue: 0, expenses: 0 }
      byDate.set(j.date, { revenue: cur.revenue + rev, expenses: cur.expenses + exp })
    })
    const daysNeedingExpenses = Array.from(byDate.entries())
      .filter(([, v]) => v.revenue > 0 && v.expenses === 0).length

    return {
      todayJobs,
      todayJobsCount: todayJobs.length,
      todayRevenue,
      todayExpenses,
      todayHasExpenses,
      todayProfit,
      daysNeedingExpenses,
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
    const items: Array<{ id: string; type: 'followup' | 'job' | 'quote' | 'insight' | 'expense'; title: string; subtitle: string; action: () => void; urgency: 'hot' | 'warm' | 'info' }> = []

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

    // Days needing expenses
    if (stats.daysNeedingExpenses > 0) {
      items.push({
        id: 'pending-expenses',
        type: 'expense',
        title: `${stats.daysNeedingExpenses} day${stats.daysNeedingExpenses !== 1 ? 's' : ''} without expenses logged`,
        subtitle: 'Log expenses to see your real profit',
        action: () => onNavigate('jobs'),
        urgency: 'warm',
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

  const typeIcons: Record<string, React.ReactNode> = {
    expense: (
      <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
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
    <div className="page-content">
      {/* ===== PAGE HEADER ===== */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {capitalizedName}</h1>
          <p className="page-subtitle">
            {stats.todayJobsCount > 0 
              ? `${stats.todayJobsCount} job${stats.todayJobsCount !== 1 ? 's' : ''} today worth ${formatCurrency(stats.todayRevenue)}`
              : jobs.length > 0 
                ? `${stats.jobsThisMonth} jobs this month, ${formatCurrency(stats.revenueThisMonth)} revenue`
                : 'Let\u2019s get your business rolling'
            }
            {pendingFollowUps > 0 && ` \u00B7 ${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? 's' : ''} waiting`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={() => onNavigate('jobs')}
            className="app-btn-primary text-sm py-2.5 px-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Job
          </button>
          <button 
            onClick={() => onNavigate('quoteBuilder')}
            className="app-btn-secondary text-sm py-2.5 px-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            New Quote
          </button>
        </div>
      </div>

      {/* ===== GETTING STARTED CHECKLIST (top priority for new users) ===== */}
      {showLaunchpad && launchpadItems.length > 0 && (
        <GettingStartedCard items={launchpadItems} />
      )}

      {/* ===== AI INSIGHTS (Dyia Pro) — only after checklist is done ===== */}
      {isPro && !showLaunchpad && (
        <AIInsights type="dashboard" compact />
      )}

      {/* ===== YOUR DAY + MINI CALENDAR ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Your Day Card */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Your Day</h3>
                <p className="text-[10px] text-[var(--color-text-muted)]">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
              </div>
            </div>
            {stats.todayJobsCount > 0 && (
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
              >
                View in calendar
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            {/* Revenue + Profit summary */}
            {stats.todayJobsCount > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">Revenue</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.todayRevenue)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Profit</p>
                  <p className={`text-lg font-bold ${
                    (() => {
                      const todayProfit = stats.todayJobs.reduce((sum, j) =>
                        sum + j.revenue - (j.labor || 0) - (j.gas || 0) - (j.dumpFee || 0) - (j.dumpsterRental || 0) - (j.additionalExpense || 0), 0)
                      return todayProfit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-500'
                    })()
                  }`}>
                    {formatCurrency(stats.todayJobs.reduce((sum, j) =>
                      sum + j.revenue - (j.labor || 0) - (j.gas || 0) - (j.dumpFee || 0) - (j.dumpsterRental || 0) - (j.additionalExpense || 0), 0))}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">Expected Revenue</span>
                <span className="text-lg font-bold text-[var(--color-text-faint)]">{formatCurrency(0)}</span>
              </div>
            )}

            {/* Today's Jobs List */}
            {stats.todayJobs.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-[var(--color-text-muted)]">
                  {stats.todayJobsCount} job{stats.todayJobsCount !== 1 ? 's' : ''} today
                </p>
                {stats.todayJobs.slice(0, 4).map((job) => (
                  <button
                    key={job.id}
                    onClick={() => onNavigate('calendar')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[var(--color-bg-subtle)] hover:bg-orange-50 dark:hover:bg-orange-900/15 transition-colors text-left group"
                  >
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-md flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-[var(--color-text-primary)] truncate flex-1">{job.customerName}</span>
                    <span className={`text-xs font-semibold shrink-0 ${job.status === 'scheduled' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                      {job.status === 'scheduled'
                        ? (job.estimateLow || job.estimateHigh
                          ? `${job.estimateLow ? formatCurrency(job.estimateLow) : '$0'}–${job.estimateHigh ? formatCurrency(job.estimateHigh) : '$0'}`
                          : 'Scheduled')
                        : formatCurrency(job.revenue)}
                    </span>
                  </button>
                ))}
                {stats.todayJobs.length > 4 && (
                  <button onClick={() => onNavigate('calendar')} className="text-[10px] text-[var(--color-text-faint)] hover:text-orange-500 text-center w-full transition-colors">
                    +{stats.todayJobs.length - 4} more
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">No jobs scheduled today</p>
                <button onClick={() => onNavigate('jobs')} className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
                  Log a job &rarr;
                </button>
              </div>
            )}

            {/* Close Out Your Day */}
            {stats.todayJobsCount > 0 && (
              <div className="pt-2 border-t border-[var(--color-border-light)]">
                {stats.todayHasExpenses ? (
                  <div className="flex items-center gap-2 px-2.5 py-2 bg-emerald-50 dark:bg-emerald-900/15 rounded-lg">
                    <div className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Day closed out</p>
                      <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/60">{formatCurrency(stats.todayRevenue)} rev &middot; {formatCurrency(stats.todayProfit)} profit</p>
                    </div>
                    {onLogDailyExpenses && (
                      <button
                        onClick={() => {
                          const now = new Date()
                          onLogDailyExpenses(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
                        }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium shrink-0"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (onLogDailyExpenses) {
                        const now = new Date()
                        onLogDailyExpenses(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
                      } else {
                        onNavigate('jobs')
                      }
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2.5 bg-orange-50 dark:bg-orange-900/15 border border-orange-200/50 dark:border-orange-800/30 rounded-lg hover:bg-orange-100/70 dark:hover:bg-orange-900/25 transition-colors group"
                  >
                    <div className="w-7 h-7 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">Close out your day</p>
                      <p className="text-[10px] text-orange-600/70 dark:text-orange-400/60">Log expenses to see your real profit</p>
                    </div>
                    <svg className="w-4 h-4 text-orange-400 group-hover:translate-x-0.5 transition-transform shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Motivational Stat */}
            {jobs.length > 0 && stats.todayJobsCount === 0 && (
              <div className="pt-2 border-t border-[var(--color-border-light)]">
                <div className="flex items-start gap-2 px-2 py-1.5 bg-amber-50 dark:bg-amber-900/15 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                    {stats.jobsAwayFromBest > 0
                      ? `You're ${stats.jobsAwayFromBest} job${stats.jobsAwayFromBest !== 1 ? 's' : ''} away from your best week ever!`
                      : stats.jobsThisWeek > 0
                        ? `${stats.jobsThisWeek} job${stats.jobsThisWeek !== 1 ? 's' : ''} this week — you're on a roll!`
                        : `${stats.jobsThisMonth} job${stats.jobsThisMonth !== 1 ? 's' : ''} this month. Keep pushing!`
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mini Calendar */}
        <MiniCalendar
          jobs={jobs}
          onDayClick={() => onNavigate('calendar')}
          onViewFullCalendar={() => onNavigate('calendar')}
        />
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="stat-grid">
        <button onClick={() => onNavigate('quotes')} className="stat-card text-left hover:border-[var(--color-border-hover)] transition-colors">
          <p className="stat-card-label">Quotes</p>
          <p className="stat-card-value" style={{ color: 'var(--color-info)' }}>{stats.pendingQuotes}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{formatCurrency(stats.quoteValue)}</p>
        </button>
        <button onClick={() => onNavigate('followUps')} className="stat-card text-left hover:border-[var(--color-border-hover)] transition-colors">
          <p className="stat-card-label">Follow-ups</p>
          <p className="stat-card-value" style={{ color: 'var(--color-warning)' }}>{pendingFollowUps}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">Pending</p>
        </button>
        <button onClick={() => onNavigate('jobs')} className="stat-card text-left hover:border-[var(--color-border-hover)] transition-colors">
          <p className="stat-card-label">Jobs This Month</p>
          <p className="stat-card-value" style={{ color: 'var(--color-success)' }}>{stats.jobsThisMonth}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{formatCurrency(stats.revenueThisMonth)}</p>
        </button>
        <div className="stat-card">
          <p className="stat-card-label">Take Home</p>
          <p className="stat-card-value" style={{ color: stats.takeHome >= 0 ? 'var(--color-brand)' : 'var(--color-danger)' }}>{formatCurrency(stats.takeHome)}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">After {taxPercentage}% tax</p>
        </div>
      </div>

      {/* ===== ACTION FEED ===== */}
      {actionItems.length > 0 && (
        <div>
          <h2 className="page-section-label">Needs Your Attention</h2>
          <div className="content-list">
            {actionItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                className={`content-list-item w-full gap-3 text-left group border-l-[3px] ${
                  item.urgency === 'hot' ? 'border-l-red-500' : item.urgency === 'warm' ? 'border-l-amber-500' : 'border-l-blue-500'
                }`}
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
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src="/dyia-agent.png" alt="" className="w-4 h-4 object-contain" />
            <h2 className="page-section-label !mb-0">Do it with Dyia</h2>
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
        <div>
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-xl p-5 sm:p-6 text-white">

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
        <div className="stat-card !p-5">
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

      {/* ===== REVENUE FORECAST (Pro) ===== */}
      {isPro && <RevenueForecastCard jobs={jobs} onOpenDyiaWithPrompt={onOpenDyiaWithPrompt} />}

      {/* Pending Actions from Dyia */}
      <div>
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
        <details className="content-list overflow-hidden">
          <summary className="px-4 sm:px-5 py-3 cursor-pointer hover:bg-[var(--color-bg-subtle)] transition-colors select-none flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-faint)] uppercase tracking-wider">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Jobs */}
          {jobs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="page-section-label !mb-0">Recent Jobs</h2>
                <button onClick={() => onNavigate('jobs')} className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
                  View all
                </button>
              </div>
              <div className="content-list">
                {[...jobs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((job) => (
                  <div key={job.id} className="content-list-item cursor-pointer" onClick={() => onNavigate('jobs')}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{job.customerName}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {parseLocalDate(job.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                <h2 className="page-section-label !mb-0">Recent Quotes</h2>
                <button onClick={() => onNavigate('quotes')} className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
                  View all
                </button>
              </div>
              <div className="content-list">
                {recentQuotes.slice(0, 4).map((quote) => (
                  <div key={quote.id} className="content-list-item cursor-pointer" onClick={() => onNavigate('quotes')}>
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
      )}

      {/* ===== WELCOMING EMPTY STATE ===== */}
      {jobs.length === 0 && !showLaunchpad && (
        <div className="content-list text-center py-12 px-6">
          <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
            <img src="/dyia-agent.png" alt="" className="w-8 h-8 object-contain" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1.5">
            Welcome to Dyia
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-md mx-auto leading-relaxed">
            Your business command center is ready. Start by logging your first job to see your revenue, profits, and insights come to life.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button 
              onClick={() => onNavigate('jobs')}
              className="app-btn-primary text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Log Your First Job
            </button>
            <button 
              onClick={() => onNavigate('quoteBuilder')}
              className="app-btn-secondary text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Create a Quote
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
