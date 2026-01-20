'use client'

import type { AppJob, AppSettings } from '@/types/database'
import { formatCurrency, calculateStats } from '@/lib/utils'

interface DashboardProps {
  jobs: AppJob[]
  settings: AppSettings
  selectedMonth: Date
  setSelectedMonth: (date: Date) => void
  onAddJob: () => void
}

export function Dashboard({ jobs, settings, selectedMonth, setSelectedMonth, onAddJob }: DashboardProps) {
  const monthJobs = jobs.filter(job => {
    const jobDate = new Date(job.date)
    return jobDate.getMonth() === selectedMonth.getMonth() &&
           jobDate.getFullYear() === selectedMonth.getFullYear()
  })

  const stats = calculateStats(monthJobs, settings)
  const monthValue = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`
  const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const navigateMonth = (dir: number) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + dir)
    setSelectedMonth(newDate)
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{monthName} Overview</p>
        </div>
        <button onClick={onAddJob} className="app-btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Jobs
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-3 mb-8">
        <button 
          onClick={() => navigateMonth(-1)} 
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-all"
          title="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <input
          type="month"
          value={monthValue}
          onChange={(e) => {
            const [year, month] = e.target.value.split('-')
            setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1))
          }}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:border-emerald-500"
        />
        <button 
          onClick={() => navigateMonth(1)} 
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-all"
          title="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button 
          onClick={() => setSelectedMonth(new Date())} 
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 font-medium text-sm transition-all"
        >
          Today
        </button>
      </div>

      {/* Goal Progress Card */}
      {settings.monthlyGoal > 0 && (
        <div className="app-card mb-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-100">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎯</span>
                <h3 className="text-lg font-bold text-emerald-900">Monthly Revenue Goal</h3>
              </div>
              <p className="text-emerald-700">
                <span className="font-semibold">{formatCurrency(stats.totalRevenue)}</span>
                <span className="text-emerald-600/70"> of </span>
                <span className="font-semibold">{formatCurrency(settings.monthlyGoal)}</span>
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-4xl font-bold text-emerald-600">{Math.round(stats.goalProgress)}%</div>
              <p className="text-sm text-emerald-600/70">
                {stats.goalProgress >= 100 
                  ? '🎉 Goal achieved!' 
                  : `${formatCurrency(settings.monthlyGoal - stats.totalRevenue)} to go`
                }
              </p>
            </div>
          </div>
          <div className="progress-bar-container bg-emerald-200/50">
            <div 
              className="progress-bar" 
              style={{ width: `${Math.min(stats.goalProgress, 100)}%` }} 
            />
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Jobs Count */}
        <div className="app-stat-card">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-4">
            📊
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Jobs This Month</p>
          <p className="text-3xl font-bold text-slate-900">{stats.jobCount}</p>
          {stats.jobCount > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              Avg {formatCurrency(stats.totalRevenue / stats.jobCount)} per job
            </p>
          )}
        </div>

        {/* Total Revenue */}
        <div className="app-stat-card">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-2xl mb-4">
            💵
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-emerald-600">{formatCurrency(stats.totalRevenue)}</p>
        </div>

        {/* Total Expenses */}
        <div className="app-stat-card">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl mb-4">
            📦
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Total Expenses</p>
          <p className="text-3xl font-bold text-orange-600">{formatCurrency(stats.totalExpenses)}</p>
          {stats.totalRevenue > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              {Math.round((stats.totalExpenses / stats.totalRevenue) * 100)}% of revenue
            </p>
          )}
        </div>

        {/* Net Profit */}
        <div className="app-stat-card">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-4">
            📈
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">Net Profit</p>
          <p className={`text-3xl font-bold ${stats.netProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
            {formatCurrency(stats.netProfit)}
          </p>
          {stats.totalRevenue > 0 && (
            <p className="text-xs text-slate-400 mt-2">
              {Math.round((stats.netProfit / stats.totalRevenue) * 100)}% margin
            </p>
          )}
        </div>

        {/* Tax Set-Aside */}
        <div className="app-stat-card bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl mb-4 shadow-sm">
            🐷
          </div>
          <p className="text-sm font-medium text-amber-800 mb-1">
            Set Aside ({settings.taxPercentage}%)
          </p>
          <p className="text-3xl font-bold text-amber-700">{formatCurrency(stats.setAside)}</p>
          <p className="text-xs text-amber-600/70 mt-2">💡 For taxes & savings</p>
        </div>

        {/* Top Marketing Source */}
        {stats.topSource ? (
          <div className="app-stat-card bg-gradient-to-br from-violet-50 to-purple-50 border-violet-100">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl mb-4 shadow-sm">
              📣
            </div>
            <p className="text-sm font-medium text-violet-800 mb-1">Top Source</p>
            <p className="text-2xl font-bold text-violet-700 truncate">{stats.topSource}</p>
            <p className="text-xs text-violet-600/70 mt-2">
              {stats.topSourceCount} jobs ({stats.topSourcePercent}%)
            </p>
          </div>
        ) : stats.jobCount > 0 ? (
          <div className="app-stat-card bg-slate-50 border-slate-100">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl mb-4">
              📣
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">Top Source</p>
            <p className="text-lg font-semibold text-slate-400">No data yet</p>
            <p className="text-xs text-slate-400 mt-2">Add sources to your jobs</p>
          </div>
        ) : null}
      </div>

      {/* Empty State */}
      {stats.jobCount === 0 && (
        <div className="app-card mt-6 text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-slate-700 mb-2">No jobs this month</h3>
          <p className="text-slate-500 mb-6">Start tracking your profits by adding your first job.</p>
          <button onClick={onAddJob} className="app-btn-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Your First Job
          </button>
        </div>
      )}
    </div>
  )
}
