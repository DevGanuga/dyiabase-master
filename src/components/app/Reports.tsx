'use client'

import { useMemo, useState } from 'react'
import type { AppJob, AppQuote } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { AIInsights } from './AIInsights'

interface ReportsProps {
  jobs: AppJob[]
  quotes: AppQuote[]
  fixedMonthlyExpenses: number
  isPro?: boolean
  taxPercentage?: number
}

type TimeRange = 'week' | 'month' | 'quarter' | 'year' | 'all'

export function Reports({ jobs, quotes, fixedMonthlyExpenses, isPro = false, taxPercentage = 30 }: ReportsProps) {
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

    return jobs.filter(j => new Date(j.date) >= cutoffDate)
  }, [jobs, timeRange])

  const stats = useMemo(() => {
    const totalRevenue = filteredJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)
    const totalExpenses = filteredJobs.reduce((sum, j) => 
      sum + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + 
      (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)
    const grossProfit = totalRevenue - totalExpenses
    
    // Calculate months in range for fixed expense adjustment
    let months: number
    if (timeRange === 'all' && filteredJobs.length > 0) {
      // For "All" range, calculate actual months from earliest job to now
      const earliest = new Date(filteredJobs[filteredJobs.length - 1].date)
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
    filteredJobs.forEach(j => {
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
    filteredJobs.forEach(j => {
      const day = new Date(j.date).toLocaleDateString('en-US', { weekday: 'short' })
      dayMap[day] = (dayMap[day] || 0) + 1
    })

    // Monthly trend
    const monthMap: Record<string, { revenue: number; profit: number; jobs: number }> = {}
    filteredJobs.forEach(j => {
      const month = new Date(j.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
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
      labor: filteredJobs.reduce((sum, j) => sum + (j.labor || 0), 0),
      gas: filteredJobs.reduce((sum, j) => sum + (j.gas || 0), 0),
      dumpFees: filteredJobs.reduce((sum, j) => sum + (j.dumpFee || 0), 0),
      dumpster: filteredJobs.reduce((sum, j) => sum + (j.dumpsterRental || 0), 0),
      other: filteredJobs.reduce((sum, j) => sum + (j.additionalExpense || 0), 0),
    }

    // Tax set-aside and take-home
    const taxSetAside = netProfit > 0 ? netProfit * (taxPercentage / 100) : 0
    const takeHome = netProfit - taxSetAside

    return {
      jobCount: filteredJobs.length,
      totalRevenue,
      totalExpenses,
      grossProfit,
      fixedExpenses,
      netProfit,
      taxSetAside,
      takeHome,
      avgJobRevenue: filteredJobs.length > 0 ? totalRevenue / filteredJobs.length : 0,
      avgJobProfit: filteredJobs.length > 0 ? grossProfit / filteredJobs.length : 0,
      profitMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      sources,
      dayMap,
      monthlyTrend,
      expenseBreakdown,
      quoteCount: quotes.length,
      convertedQuotes: quotes.filter(q => q.status === 'accepted').length,
      conversionRate: quotes.length > 0 ? (quotes.filter(q => q.status === 'accepted').length / quotes.length) * 100 : 0,
    }
  }, [filteredJobs, fixedMonthlyExpenses, timeRange, quotes.length, taxPercentage])

  const timeRangeLabel = {
    week: 'Last 7 Days',
    month: 'Last 30 Days',
    quarter: 'Last 3 Months',
    year: 'Last 12 Months',
    all: 'All Time',
  }[timeRange]

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">Reports</h1>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)]">Business analytics and insights</p>
        </div>
        <div className="flex gap-1.5 sm:gap-2 flex-wrap">
          {(['week', 'month', 'quarter', 'year', 'all'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-[var(--color-bg-card)] border border-[var(--color-border)] text-slate-600 dark:text-slate-400 hover:bg-[var(--color-bg-subtle)]'
              }`}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-3 sm:p-5">
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mb-0.5 sm:mb-1">Total Revenue</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)] mt-0.5 sm:mt-1">{stats.jobCount} jobs</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-3 sm:p-5">
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mb-0.5 sm:mb-1">Gross Profit</p>
          <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stats.grossProfit)}</p>
          <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)] mt-0.5 sm:mt-1">{Math.round(stats.profitMargin)}% margin</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-3 sm:p-5">
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mb-0.5 sm:mb-1">Avg Job Value</p>
          <p className="text-lg sm:text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(stats.avgJobRevenue)}</p>
          <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)] mt-0.5 sm:mt-1">{formatCurrency(stats.avgJobProfit)} profit</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-3 sm:p-5">
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mb-0.5 sm:mb-1">Job Expenses</p>
          <p className="text-lg sm:text-2xl font-bold text-red-500 dark:text-red-400">{formatCurrency(stats.totalExpenses)}</p>
          <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)] mt-0.5 sm:mt-1">+ {formatCurrency(stats.fixedExpenses)} fixed</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue by Source */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] mb-3 sm:mb-4">Revenue by Source</h3>
          {stats.sources.length === 0 ? (
            <p className="text-[var(--color-text-faint)] text-xs sm:text-sm">No data yet</p>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {stats.sources.slice(0, 5).map((source, idx) => {
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
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] mb-3 sm:mb-4">Expense Breakdown</h3>
          {stats.totalExpenses === 0 ? (
            <p className="text-[var(--color-text-faint)] text-xs sm:text-sm">No expenses logged</p>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {[
                { name: 'Labor', value: stats.expenseBreakdown.labor, color: 'bg-blue-500' },
                { name: 'Gas', value: stats.expenseBreakdown.gas, color: 'bg-green-500' },
                { name: 'Dump Fees', value: stats.expenseBreakdown.dumpFees, color: 'bg-yellow-500' },
                { name: 'Dumpster', value: stats.expenseBreakdown.dumpster, color: 'bg-purple-500' },
                { name: 'Other', value: stats.expenseBreakdown.other, color: 'bg-[var(--color-bg-subtle)]0' },
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
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] mb-3 sm:mb-4">Monthly Trend</h3>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200/50 dark:border-green-800/30 rounded-lg sm:rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--color-bg-card)] rounded-lg flex items-center justify-center text-green-600 dark:text-green-400">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-green-800 dark:text-green-300">Best Day</p>
              <p className="text-sm sm:text-base font-semibold text-green-900 dark:text-green-200">
                {Object.entries(stats.dayMap).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
              </p>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400">
            {Object.entries(stats.dayMap).sort(([,a], [,b]) => b - a)[0]?.[1] || 0} jobs on this day
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/30 rounded-lg sm:rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--color-bg-card)] rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300">Quote Conversion</p>
              <p className="text-sm sm:text-base font-semibold text-blue-900 dark:text-blue-200">{Math.round(stats.conversionRate)}%</p>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-blue-600 dark:text-blue-400">
            {stats.convertedQuotes} converted of {stats.quoteCount} quotes
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200/50 dark:border-purple-800/30 rounded-lg sm:rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--color-bg-card)] rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-purple-800 dark:text-purple-300">Take Home</p>
              <p className={`text-sm sm:text-base font-semibold ${stats.takeHome >= 0 ? 'text-purple-900 dark:text-purple-200' : 'text-red-600'}`}>{formatCurrency(stats.takeHome)}</p>
            </div>
          </div>
          <p className="text-[10px] sm:text-xs text-purple-600 dark:text-purple-400">
            After {formatCurrency(stats.fixedExpenses)} fixed + {formatCurrency(stats.taxSetAside)} tax ({taxPercentage}%)
          </p>
        </div>
      </div>

      {/* P&L Breakdown */}
      {stats.jobCount > 0 && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl p-4 sm:p-6">
          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] mb-3 sm:mb-4">Profit & Loss — {timeRangeLabel}</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light,var(--color-border))]">
              <span className="text-sm text-[var(--color-text-secondary)]">Revenue</span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.totalRevenue)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light,var(--color-border))]">
              <span className="text-sm text-[var(--color-text-secondary)]">Job Expenses</span>
              <span className="text-sm font-medium text-red-500">-{formatCurrency(stats.totalExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light,var(--color-border))]">
              <span className="text-sm text-[var(--color-text-secondary)]">Gross Profit</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(stats.grossProfit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light,var(--color-border))]">
              <span className="text-sm text-[var(--color-text-secondary)]">Fixed Overhead</span>
              <span className="text-sm font-medium text-red-500">-{formatCurrency(stats.fixedExpenses)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light,var(--color-border))]">
              <span className="text-sm text-[var(--color-text-secondary)]">Net Profit</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatCurrency(stats.netProfit)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--color-border-light,var(--color-border))]">
              <span className="text-sm text-[var(--color-text-secondary)]">Tax Set-Aside ({taxPercentage}%)</span>
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">-{formatCurrency(stats.taxSetAside)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 -mx-4 sm:-mx-6 px-4 sm:px-6 rounded-b-lg">
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Take Home</span>
              <span className={`text-base font-bold ${stats.takeHome >= 0 ? 'text-purple-700 dark:text-purple-300' : 'text-red-600'}`}>
                {formatCurrency(stats.takeHome)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {stats.jobCount === 0 && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg sm:rounded-xl text-center py-8 sm:py-12 px-4 sm:px-6">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 dark:bg-slate-800 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-2">No data for {timeRangeLabel.toLowerCase()}</h3>
          <p className="text-sm sm:text-base text-[var(--color-text-muted)]">Start logging jobs to see your analytics.</p>
        </div>
      )}
    </div>
  )
}
