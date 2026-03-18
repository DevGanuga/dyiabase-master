'use client'

import { useMemo, useState } from 'react'
import type { AppJob, AppQuote } from '@/types/database'
import { formatCurrency, parseLocalDate } from '@/lib/utils'
import { AIInsights } from './AIInsights'

interface ReportsProps {
  jobs: AppJob[]
  quotes: AppQuote[]
  fixedMonthlyExpenses: number
  isPro?: boolean
}

type TimeRange = 'week' | 'month' | 'quarter' | 'year' | 'all'

export function Reports({ jobs, quotes, fixedMonthlyExpenses, isPro = false }: ReportsProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('month')

  const filteredJobs = useMemo(() => {
    const now = new Date()
    const cutoffDate = new Date()

    switch (timeRange) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
      case 'all':
        return jobs
    }

    return jobs.filter(j => parseLocalDate(j.date) >= cutoffDate)
  }, [jobs, timeRange])

  const stats = useMemo(() => {
    const completedJobs = filteredJobs.filter(j => j.status !== 'scheduled')
    const totalRevenue = completedJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)
    const totalExpenses = completedJobs.reduce((sum, j) => 
      sum + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + 
      (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)
    const grossProfit = totalRevenue - totalExpenses
    
    // Calculate months in range for fixed expense adjustment
    let months: number
    if (timeRange === 'all' && filteredJobs.length > 0) {
      // For "All" range, calculate actual months from earliest job to now
      const earliest = parseLocalDate(filteredJobs[filteredJobs.length - 1].date)
      const now = new Date()
      months = Math.max(1, (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1)
    } else {
      months = timeRange === 'week' ? 0.25 : 
               timeRange === 'month' ? 1 : 
               timeRange === 'quarter' ? 3 : 
               timeRange === 'year' ? 12 : 1
    }
    const fixedExpenses = fixedMonthlyExpenses * months
    const netProfit = grossProfit - fixedExpenses

    // Source breakdown
    const sourceMap: Record<string, { count: number; revenue: number }> = {}
    completedJobs.forEach(j => {
      const source = j.source || 'Unknown'
      if (!sourceMap[source]) sourceMap[source] = { count: 0, revenue: 0 }
      sourceMap[source].count++
      sourceMap[source].revenue += j.revenue || 0
    })
    const sources = Object.entries(sourceMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)

    // Daily/Weekly breakdown
    const dayMap: Record<string, number> = {}
    completedJobs.forEach(j => {
      const day = parseLocalDate(j.date).toLocaleDateString('en-US', { weekday: 'short' })
      dayMap[day] = (dayMap[day] || 0) + 1
    })

    // Monthly trend
    const monthMap: Record<string, { revenue: number; profit: number; jobs: number }> = {}
    completedJobs.forEach(j => {
      const month = parseLocalDate(j.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!monthMap[month]) monthMap[month] = { revenue: 0, profit: 0, jobs: 0 }
      const jobExpenses = (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + (j.dumpsterRental || 0) + (j.additionalExpense || 0)
      monthMap[month].revenue += j.revenue || 0
      monthMap[month].profit += (j.revenue || 0) - jobExpenses
      monthMap[month].jobs++
    })
    const monthlyTrend = Object.entries(monthMap)
      .map(([month, data]) => ({ month, ...data }))
      .slice(-6)

    // Expense breakdown
    const expenseBreakdown = {
      labor: completedJobs.reduce((sum, j) => sum + (j.labor || 0), 0),
      gas: completedJobs.reduce((sum, j) => sum + (j.gas || 0), 0),
      dumpFees: completedJobs.reduce((sum, j) => sum + (j.dumpFee || 0), 0),
      dumpster: completedJobs.reduce((sum, j) => sum + (j.dumpsterRental || 0), 0),
      other: completedJobs.reduce((sum, j) => sum + (j.additionalExpense || 0), 0),
    }

    return {
      jobCount: completedJobs.length,
      totalRevenue,
      totalExpenses,
      grossProfit,
      fixedExpenses,
      netProfit,
      avgJobRevenue: completedJobs.length > 0 ? totalRevenue / completedJobs.length : 0,
      avgJobProfit: completedJobs.length > 0 ? grossProfit / completedJobs.length : 0,
      profitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      sources,
      dayMap,
      monthlyTrend,
      expenseBreakdown,
      quoteCount: quotes.length,
      // Conversion rate: quotes that became jobs (accepted) / total quotes
      convertedQuotes: quotes.filter(q => q.status === 'accepted').length,
      conversionRate: quotes.length > 0 ? (quotes.filter(q => q.status === 'accepted').length / quotes.length) * 100 : 0,
    }
  }, [filteredJobs, fixedMonthlyExpenses, timeRange, quotes])

  const timeRangeLabel = {
    week: 'Last 7 Days',
    month: 'Last 30 Days',
    quarter: 'Last 3 Months',
    year: 'Last 12 Months',
    all: 'All Time',
  }[timeRange]

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Business analytics and insights</p>
        </div>
        <div className="filter-pills">
          {(['week', 'month', 'quarter', 'year', 'all'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`filter-pill ${timeRange === range ? 'active' : ''}`}
            >
              {range === 'week' ? '7D' : range === 'month' ? '30D' : range === 'quarter' ? '3M' : range === 'year' ? '1Y' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* AI Insights - Pro feature */}
      {isPro && stats.jobCount > 0 && (
        <AIInsights type="reports" className="animate-fade-in" />
      )}

      {/* Summary Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-card-label">Total Revenue</p>
          <p className="stat-card-value text-green-600 dark:text-green-400">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{stats.jobCount} jobs</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Gross Profit</p>
          <p className="stat-card-value text-purple-600 dark:text-purple-400">{formatCurrency(stats.grossProfit)}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{Math.round(stats.profitMargin)}% margin</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Avg Job Value</p>
          <p className="stat-card-value">{formatCurrency(stats.avgJobRevenue)}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">{formatCurrency(stats.avgJobProfit)} profit</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Job Expenses</p>
          <p className="stat-card-value text-red-500 dark:text-red-400">{formatCurrency(stats.totalExpenses)}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">+ {formatCurrency(stats.fixedExpenses)} fixed</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue by Source */}
        <div className="stat-card !p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Revenue by Source</h3>
          {stats.sources.length === 0 ? (
            <p className="text-[var(--color-text-faint)] text-xs sm:text-sm">No data yet</p>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {stats.sources.slice(0, 5).map((source) => {
                const percentage = stats.totalRevenue > 0 ? (source.revenue / stats.totalRevenue) * 100 : 0
                return (
                  <div key={source.name}>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="font-medium text-[var(--color-text-secondary)]">{source.name}</span>
                      <span className="text-[var(--color-text-muted)]">{formatCurrency(source.revenue)} <span className="hidden sm:inline">({source.count})</span></span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Expense Breakdown */}
        <div className="stat-card !p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Expense Breakdown</h3>
          {stats.totalExpenses === 0 ? (
            <p className="text-[var(--color-text-faint)] text-xs sm:text-sm">No expenses logged</p>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {[
                { name: 'Labor', value: stats.expenseBreakdown.labor, color: 'bg-blue-500' },
                { name: 'Gas', value: stats.expenseBreakdown.gas, color: 'bg-green-500' },
                { name: 'Dump Fees', value: stats.expenseBreakdown.dumpFees, color: 'bg-yellow-500' },
                { name: 'Dumpster', value: stats.expenseBreakdown.dumpster, color: 'bg-purple-500' },
                { name: 'Other', value: stats.expenseBreakdown.other, color: 'bg-slate-400' },
              ].filter(e => e.value > 0).map((expense) => {
                const percentage = stats.totalExpenses > 0 ? (expense.value / stats.totalExpenses) * 100 : 0
                return (
                  <div key={expense.name}>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="font-medium text-[var(--color-text-secondary)]">{expense.name}</span>
                      <span className="text-[var(--color-text-muted)]">{formatCurrency(expense.value)} ({Math.round(percentage)}%)</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${expense.color} rounded-full`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Trend */}
      {stats.monthlyTrend.length > 0 && (
        <div className="stat-card !p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Monthly Trend</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="text-left text-xs sm:text-sm text-[var(--color-text-muted)] border-b border-[var(--color-border-light)]">
                  <th className="pb-2 sm:pb-3 font-medium">Month</th>
                  <th className="pb-2 sm:pb-3 font-medium text-right">Jobs</th>
                  <th className="pb-2 sm:pb-3 font-medium text-right">Revenue</th>
                  <th className="pb-2 sm:pb-3 font-medium text-right">Profit</th>
                  <th className="pb-2 sm:pb-3 font-medium text-right hidden sm:table-cell">Avg/Job</th>
                </tr>
              </thead>
              <tbody>
                {stats.monthlyTrend.map((m) => (
                  <tr key={m.month} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="py-2 sm:py-3 font-medium text-xs sm:text-sm text-[var(--color-text-primary)]">{m.month}</td>
                    <td className="py-2 sm:py-3 text-right text-xs sm:text-sm text-slate-600 dark:text-slate-400">{m.jobs}</td>
                    <td className="py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(m.revenue)}</td>
                    <td className="py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(m.profit)}</td>
                    <td className="py-2 sm:py-3 text-right text-xs sm:text-sm text-slate-600 dark:text-slate-400 hidden sm:table-cell">{formatCurrency(m.jobs > 0 ? m.revenue / m.jobs : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="stat-card">
          <p className="stat-card-label">Best Day</p>
          <p className="stat-card-value !text-lg text-green-600 dark:text-green-400">
            {Object.entries(stats.dayMap).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
          </p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
            {Object.entries(stats.dayMap).sort(([,a], [,b]) => b - a)[0]?.[1] || 0} jobs on this day
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Quote Conversion</p>
          <p className="stat-card-value !text-lg text-blue-600 dark:text-blue-400">{Math.round(stats.conversionRate)}%</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
            {stats.convertedQuotes} converted of {stats.quoteCount} quotes
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Net Profit</p>
          <p className="stat-card-value !text-lg text-purple-600 dark:text-purple-400">{formatCurrency(stats.netProfit)}</p>
          <p className="text-xs text-[var(--color-text-faint)] mt-0.5">
            After {formatCurrency(stats.fixedExpenses)} fixed
          </p>
        </div>
      </div>

      {/* Empty State */}
      {stats.jobCount === 0 && (
        <div className="content-list text-center py-12 px-6">
          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1.5">No data for {timeRangeLabel.toLowerCase()}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">Start logging jobs to see your analytics.</p>
        </div>
      )}
    </div>
  )
}
