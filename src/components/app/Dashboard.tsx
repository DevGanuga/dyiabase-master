'use client'

import { useMemo } from 'react'
import type { AppJob, AppQuote, AppSettings } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

interface DashboardProps {
  jobs: AppJob[]
  quotes: AppQuote[]
  settings: AppSettings
  userName?: string
  onNavigate: (view: string) => void
  pendingFollowUps?: number
  fixedMonthlyExpenses?: number
}

export function Dashboard({ 
  jobs, 
  quotes = [],
  settings, 
  userName,
  onNavigate,
  pendingFollowUps = 0,
  fixedMonthlyExpenses = 0
}: DashboardProps) {
  
  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const displayName = userName?.split('@')[0]?.split('.')[0] || 'there'
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

    return {
      jobsThisWeek: thisWeek.length,
      jobsThisMonth: thisMonth.length,
      revenueThisMonth: totalRevenue,
      jobExpenses: totalExpenses,
      profitThisMonth: totalRevenue - totalExpenses - fixedMonthlyExpenses,
      pendingQuotes: pendingQuotes.length,
      quoteValue,
      goalProgress: settings.monthlyGoal > 0
        ? Math.round((totalRevenue / settings.monthlyGoal) * 100)
        : 0
    }
  }, [jobs, quotes, settings.monthlyGoal, fixedMonthlyExpenses])

  return (
    <div className="space-y-8">
      {/* Greeting Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {greeting}, {capitalizedName}
        </h1>
        <p className="text-slate-500 mt-1">
          Here&apos;s what&apos;s happening with your business
        </p>
      </div>

      {/* Workflow Pipeline */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Workflow
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Quotes */}
          <button 
            onClick={() => onNavigate('quotes')}
            className="bg-white border-l-4 border-l-blue-500 border border-slate-200 rounded-xl p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Quotes</span>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{stats.pendingQuotes}</span>
              <span className="text-sm text-slate-400">{formatCurrency(stats.quoteValue)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Pending</p>
          </button>

          {/* Follow-ups */}
          <button 
            onClick={() => onNavigate('followUps')}
            className="bg-white border-l-4 border-l-amber-500 border border-slate-200 rounded-xl p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-amber-600 uppercase tracking-wide">Follow-ups</span>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{pendingFollowUps}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Need attention</p>
          </button>

          {/* Jobs */}
          <button 
            onClick={() => onNavigate('jobs')}
            className="bg-white border-l-4 border-l-green-500 border border-slate-200 rounded-xl p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Jobs</span>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{stats.jobsThisMonth}</span>
              <span className="text-sm text-slate-400">{formatCurrency(stats.revenueThisMonth)}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">This month</p>
          </button>

          {/* Fixed Expenses */}
          <button
            onClick={() => onNavigate('settings')}
            className="bg-white border-l-4 border-l-red-400 border border-slate-200 rounded-xl p-5 text-left hover:shadow-md hover:border-slate-300 transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-red-500 uppercase tracking-wide">Overhead</span>
              <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">
                {formatCurrency(fixedMonthlyExpenses)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Monthly fixed</p>
          </button>

          {/* Profit */}
          <div className="bg-white border-l-4 border-l-purple-500 border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">Profit</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${stats.profitThisMonth >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                {formatCurrency(stats.profitThisMonth)}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">This month (net)</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => onNavigate('jobs')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log a Job
          </button>
          <button 
            onClick={() => onNavigate('quoteBuilder')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Create Quote
          </button>
          <button 
            onClick={() => onNavigate('assistant')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Ask Dyia
          </button>
        </div>
      </div>

      {/* Goal Progress (if set) */}
      {settings.monthlyGoal > 0 && (
        <div className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Monthly Goal</h3>
              <p className="text-sm text-slate-500">
                {formatCurrency(stats.revenueThisMonth)} of {formatCurrency(settings.monthlyGoal)}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${stats.goalProgress >= 100 ? 'text-green-600' : 'text-slate-900'}`}>
                {stats.goalProgress}%
              </span>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                stats.goalProgress >= 100 
                  ? 'bg-green-500' 
                  : 'bg-gradient-to-r from-orange-500 to-amber-500'
              }`}
              style={{ width: `${Math.min(stats.goalProgress, 100)}%` }} 
            />
          </div>
          {stats.goalProgress < 100 && (
            <p className="text-xs text-slate-400 mt-2">
              {formatCurrency(settings.monthlyGoal - stats.revenueThisMonth)} to go
            </p>
          )}
        </div>
      )}

      {/* Recent Activity */}
      {jobs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Recent Jobs
            </h2>
            <button 
              onClick={() => onNavigate('jobs')}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              View all
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {jobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{job.customerName}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(job.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                      {job.source && <span className="text-slate-300"> · {job.source}</span>}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-green-600">
                  {formatCurrency(job.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {jobs.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl text-center py-12 px-6">
          <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Welcome to dyia
          </h3>
          <p className="text-slate-500 mb-6 max-w-sm mx-auto">
            Start by logging your first job to track your revenue and profits.
          </p>
          <button 
            onClick={() => onNavigate('jobs')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Log Your First Job
          </button>
        </div>
      )}
    </div>
  )
}
