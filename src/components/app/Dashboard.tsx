'use client'

import { useMemo } from 'react'
import type { AppJob, AppQuote, AppSettings } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { AIInsights } from './AIInsights'
import { PendingActionsCard } from './PendingActionsCard'
import type { LaunchpadItem } from './Launchpad'

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

  // Launchpad progress
  const launchpadCompleted = launchpadItems.filter(i => i.completed).length
  const launchpadTotal = launchpadItems.length
  const launchpadProgress = launchpadTotal > 0 ? (launchpadCompleted / launchpadTotal) * 100 : 0

  return (
    <div className="space-y-6 animate-view-enter">
      {/* Greeting + Quick Actions */}
      <div className="animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
              {greeting}, {capitalizedName}
            </h1>
            <p className="text-sm sm:text-base text-[var(--color-text-muted)] mt-1">
              Here&apos;s what&apos;s happening with your business
            </p>
          </div>

          {/* Quick Actions - RIGHT at the top */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => onNavigate('jobs')}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25 text-white text-sm font-medium rounded-lg transition-all duration-200 group"
            >
              <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Log Job</span>
            </button>
            <button 
              onClick={() => onNavigate('quoteBuilder')}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md text-[var(--color-text-secondary)] text-sm font-medium rounded-lg transition-all duration-200 group"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>New Quote</span>
            </button>
            <button 
              onClick={() => onNavigate('assistant')}
              className="btn-press inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md text-[var(--color-text-secondary)] text-sm font-medium rounded-lg transition-all duration-200 group"
            >
              <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="hidden sm:inline">Ask Dyia</span>
            </button>
          </div>
        </div>
      </div>

      {/* Launchpad - Getting Started (when incomplete) */}
      {showLaunchpad && launchpadItems.length > 0 && (
        <div className="animate-fade-in delay-fade-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-orange-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Getting Started</h3>
                <p className="text-xs text-[var(--color-text-muted)]">{launchpadCompleted} of {launchpadTotal} complete</p>
              </div>
            </div>
            <div className="w-12 h-12 relative">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-200 dark:text-slate-700"
                  stroke="currentColor"
                  strokeWidth="3"
                  fill="none"
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-orange-500"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                  strokeDasharray={`${launchpadProgress}, 100`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[var(--color-text-primary)]">
                {Math.round(launchpadProgress)}%
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {launchpadItems.map((item) => (
              <button
                key={item.id}
                onClick={item.action}
                disabled={item.completed || !item.action}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                  item.completed
                    ? 'text-[var(--color-text-muted)] cursor-default'
                    : item.action
                      ? 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] cursor-pointer group'
                      : 'text-[var(--color-text-muted)] cursor-default'
                }`}
              >
                {item.completed ? (
                  <span className="text-green-500 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="block w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 group-hover:border-orange-400 shrink-0 transition-colors" />
                )}
                <div className="min-w-0">
                  <p className={`truncate ${item.completed ? 'line-through' : 'font-medium'}`}>{item.label}</p>
                  {item.description && !item.completed && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{item.description}</p>
                  )}
                </div>
                {!item.completed && item.action && (
                  <svg className="w-4 h-4 ml-auto text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights - Pro feature */}
      {isPro && jobs.length > 0 && (
        <AIInsights type="dashboard" compact autoRefresh className="animate-fade-in delay-fade-1" />
      )}

      {/* Pending Actions from Dyia */}
      <div className="animate-fade-in delay-fade-1">
        <PendingActionsCard 
          onResume={(action) => {
            if (onResumePendingAction) {
              onResumePendingAction(action)
            } else {
              onNavigate('assistant')
            }
          }}
          onDismiss={() => {
            // Optionally show a toast or notification
          }}
        />
      </div>

      {/* Today card - now actionable with job list */}
      <div className="animate-fade-in delay-fade-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Today
          </h2>
          {stats.todayJobsCount > 0 && (
            <button
              onClick={() => onNavigate('jobs')}
              className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
            >
              View all jobs
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{stats.todayJobsCount}</p>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">Jobs</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.todayRevenue)}</p>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">Expected revenue</p>
          </div>
          {stats.jobsAwayFromBest > 0 && stats.jobsThisWeek > 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              You&apos;re <span className="font-medium text-[var(--color-text-primary)]">{stats.jobsAwayFromBest}</span> job{stats.jobsAwayFromBest !== 1 ? 's' : ''} away from your best week.
            </p>
          )}
        </div>
        {/* Today's jobs list */}
        {stats.todayJobs.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[var(--color-border)] space-y-2">
            {stats.todayJobs.map(job => (
              <div key={job.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm text-[var(--color-text-primary)] truncate">{job.customerName}</span>
                </div>
                <span className="text-sm font-medium text-green-600 dark:text-green-400 shrink-0">{formatCurrency(job.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workflow Pipeline */}
      <div className="animate-fade-in delay-fade-1" style={{ animationFillMode: 'both' }}>
        <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 sm:mb-4">
          Workflow
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Quotes */}
          <button 
            onClick={() => onNavigate('quotes')}
            className="stagger-card interactive-card stat-highlight bg-[var(--color-bg-card)] border-l-4 border-l-blue-500 border border-[var(--color-border)] rounded-xl p-3 sm:p-5 text-left group"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">Quotes</span>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
              <span className="stat-number text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{stats.pendingQuotes}</span>
              <span className="text-xs sm:text-sm text-[var(--color-text-faint)]">{formatCurrency(stats.quoteValue)}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-1">Pending</p>
          </button>

          {/* Follow-ups */}
          <button 
            onClick={() => onNavigate('followUps')}
            className="stagger-card interactive-card stat-highlight bg-[var(--color-bg-card)] border-l-4 border-l-amber-500 border border-[var(--color-border)] rounded-xl p-3 sm:p-5 text-left group"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Follow-ups</span>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="stat-number text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{pendingFollowUps}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-1">Need attention</p>
          </button>

          {/* Jobs */}
          <button 
            onClick={() => onNavigate('jobs')}
            className="stagger-card interactive-card stat-highlight bg-[var(--color-bg-card)] border-l-4 border-l-green-500 border border-[var(--color-border)] rounded-xl p-3 sm:p-5 text-left group"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Jobs</span>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 group-hover:text-green-500 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0 sm:gap-2">
              <span className="stat-number text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{stats.jobsThisMonth}</span>
              <span className="text-xs sm:text-sm text-[var(--color-text-faint)]">{formatCurrency(stats.revenueThisMonth)}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-1">This month</p>
          </button>

          {/* Fixed Expenses - hidden on smallest screens */}
          <button
            onClick={() => onNavigate('settings')}
            className="stagger-card interactive-card stat-highlight bg-[var(--color-bg-card)] border-l-4 border-l-red-400 border border-[var(--color-border)] rounded-xl p-3 sm:p-5 text-left group hidden sm:block"
          >
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wide">Overhead</span>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300 dark:text-slate-600 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="stat-number text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
                {formatCurrency(fixedMonthlyExpenses)}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-1">Monthly fixed</p>
          </button>

          {/* Take Home (after tax) */}
          <div className="stagger-card stat-highlight bg-[var(--color-bg-card)] border-l-4 border-l-purple-500 border border-[var(--color-border)] rounded-xl p-3 sm:p-5 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">Take Home</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`stat-number text-2xl sm:text-3xl font-bold ${stats.takeHome >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(stats.takeHome)}
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-1">After {taxPercentage}% tax</p>
          </div>
        </div>
      </div>

      {/* Monthly Financial Breakdown - collapsible */}
      {stats.revenueThisMonth > 0 && (
        <details className="animate-fade-in delay-fade-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl sm:rounded-2xl overflow-hidden" style={{ animationFillMode: 'both' }}>
          <summary className="px-4 sm:px-6 py-4 cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors select-none">
            <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Monthly Breakdown
            </span>
          </summary>
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-2 sm:space-y-3">
            {/* Revenue */}
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Revenue</span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.revenueThisMonth)}</span>
            </div>
            {/* Variable Expenses */}
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Job Expenses (variable)</span>
              <span className="text-sm font-medium text-red-500 dark:text-red-400">-{formatCurrency(stats.jobExpenses)}</span>
            </div>
            {/* Gross Profit */}
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)] bg-slate-50/50 dark:bg-slate-800/30 -mx-4 sm:-mx-6 px-4 sm:px-6">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Gross Profit</span>
              <span className={`text-sm font-semibold ${stats.grossProfit >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(stats.grossProfit)}
              </span>
            </div>
            {/* Fixed Expenses */}
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Fixed Expenses (overhead)</span>
              <span className="text-sm font-medium text-red-500 dark:text-red-400">-{formatCurrency(fixedMonthlyExpenses)}</span>
            </div>
            {/* Net Profit */}
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)] bg-slate-50/50 dark:bg-slate-800/30 -mx-4 sm:-mx-6 px-4 sm:px-6">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Net Profit</span>
              <span className={`text-sm font-semibold ${stats.netProfit >= 0 ? 'text-[var(--color-text-primary)]' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(stats.netProfit)}
              </span>
            </div>
            {/* Tax Set-Aside */}
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light)]">
              <span className="text-sm text-[var(--color-text-secondary)]">Tax Set-Aside ({taxPercentage}%)</span>
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">-{formatCurrency(stats.taxSetAside)}</span>
            </div>
            {/* Take Home */}
            <div className="flex justify-between items-center py-3 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 -mx-4 sm:-mx-6 px-4 sm:px-6 rounded-b-xl">
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Take Home</span>
              <span className={`text-lg font-bold ${stats.takeHome >= 0 ? 'text-purple-700 dark:text-purple-300' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(stats.takeHome)}
              </span>
            </div>
          </div>
        </details>
      )}

      {/* Goal Progress (if set) */}
      {settings.monthlyGoal > 0 && (
        <div className="animate-fade-in delay-fade-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 border border-[var(--color-border)] rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-md transition-shadow duration-300" style={{ animationFillMode: 'both' }}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">Monthly Goal</h3>
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                {formatCurrency(stats.revenueThisMonth)} of {formatCurrency(settings.monthlyGoal)}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-xl sm:text-2xl font-bold transition-colors duration-300 ${stats.goalProgress >= 100 ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text-primary)]'}`}>
                {stats.goalProgress}%
              </span>
            </div>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full progress-animated ${
                stats.goalProgress >= 100 
                  ? 'bg-green-500' 
                  : 'bg-gradient-to-r from-orange-500 to-amber-500'
              }`}
              style={{ width: `${Math.min(stats.goalProgress, 100)}%` }} 
            />
          </div>
          {stats.goalProgress < 100 && (
            <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)] mt-2">
              {formatCurrency(settings.monthlyGoal - stats.revenueThisMonth)} to go
            </p>
          )}
        </div>
      )}

      {/* Recent Activity - Jobs */}
      {jobs.length > 0 && (
        <div className="animate-fade-in delay-fade-4" style={{ animationFillMode: 'both' }}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Recent Jobs
            </h2>
            <button 
              onClick={() => onNavigate('jobs')}
              className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium hover:underline transition-all duration-200"
            >
              View all
            </button>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl sm:rounded-2xl divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {jobs.slice(0, 5).map((job, index) => (
              <div 
                key={job.id} 
                className="list-row flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--color-bg-subtle)] transition-colors duration-200 cursor-pointer"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => onNavigate('jobs')}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-50 dark:bg-green-900/30 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] truncate">{job.customerName}</p>
                    <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                      {new Date(job.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                      {job.source && <span className="text-slate-300 dark:text-slate-600 hidden sm:inline"> · {job.source}</span>}
                    </p>
                  </div>
                </div>
                <span className="text-sm sm:text-base font-semibold text-green-600 dark:text-green-400 shrink-0 ml-2">
                  {formatCurrency(job.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Quotes */}
      {recentQuotes.length > 0 && (
        <div className="animate-fade-in delay-fade-4" style={{ animationFillMode: 'both' }}>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Recent Quotes
            </h2>
            <button 
              onClick={() => onNavigate('quotes')}
              className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-medium hover:underline transition-all duration-200"
            >
              View all
            </button>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl sm:rounded-2xl divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
            {recentQuotes.map((quote, index) => (
              <div 
                key={quote.id}
                className="list-row flex items-center justify-between p-3 sm:p-4 hover:bg-[var(--color-bg-subtle)] transition-colors duration-200 cursor-pointer"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => onNavigate('quotes')}
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] truncate">{quote.customer.name}</p>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--color-text-muted)]">
                      <span>{new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        quote.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        quote.status === 'sent' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                        quote.status === 'declined' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}>
                        {quote.status}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-sm sm:text-base font-semibold text-blue-600 dark:text-blue-400 shrink-0 ml-2">
                  {formatCurrency(quote.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {jobs.length === 0 && !showLaunchpad && (
        <div className="animate-card-pop bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl sm:rounded-2xl text-center py-8 sm:py-12 px-4 sm:px-6">
          <div className="empty-state-float w-12 h-12 sm:w-16 sm:h-16 bg-orange-50 dark:bg-orange-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-2">
            Welcome to dyia
          </h3>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)] mb-4 sm:mb-6 max-w-sm mx-auto">
            Start by logging your first job to track your revenue and profits.
          </p>
          <button 
            onClick={() => onNavigate('jobs')}
            className="btn-press inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-orange-500 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/25 text-white text-sm sm:text-base font-medium rounded-lg sm:rounded-xl transition-all duration-200 group"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Your First Job
          </button>
        </div>
      )}
    </div>
  )
}
