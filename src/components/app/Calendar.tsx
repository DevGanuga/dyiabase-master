'use client'

import { useMemo, useState, useCallback } from 'react'
import type { AppJob } from '@/types/database'
import { formatCurrency, formatLocalDateInput, parseLocalDate } from '@/lib/utils'

interface CalendarProps {
  jobs: AppJob[]
  onNavigate?: (view: string) => void
  initialDate?: string
  onScheduleJob?: (date: string) => void
}

const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function Calendar({ jobs, onNavigate, initialDate, onScheduleJob }: CalendarProps) {
  const todayStr = formatLocalDateInput()

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (initialDate) return new Date(initialDate + 'T00:00:00')
    return new Date()
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate || todayStr)
  const [expandedJob, setExpandedJob] = useState<AppJob | null>(null)

  const jobsByDate = useMemo(() => {
    const map = new Map<string, AppJob[]>()
    for (const job of jobs) {
      const existing = map.get(job.date) || []
      existing.push(job)
      map.set(job.date, existing)
    }
    return map
  }, [jobs])

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const startPad = new Date(year, month, 1).getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()

    const days: Array<{
      date: string
      day: number
      isCurrentMonth: boolean
      isToday: boolean
      isWeekend: boolean
      jobs: AppJob[]
    }> = []

    const prevMonthLast = new Date(year, month, 0).getDate()
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevMonthLast - i
      const prevDate = new Date(year, month - 1, d)
      const fullDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = prevDate.getDay()
      days.push({ date: fullDateStr, day: d, isCurrentMonth: false, isToday: false, isWeekend: dayOfWeek === 0 || dayOfWeek === 6, jobs: jobsByDate.get(fullDateStr) || [] })
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = new Date(year, month, d).getDay()
      days.push({ date: dateStr, day: d, isCurrentMonth: true, isToday: dateStr === todayStr, isWeekend: dayOfWeek === 0 || dayOfWeek === 6, jobs: jobsByDate.get(dateStr) || [] })
    }

    const rowsNeeded = Math.ceil(days.length / 7)
    const totalCells = rowsNeeded * 7
    const remaining = totalCells - days.length
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d)
      const fullDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = nextDate.getDay()
      days.push({ date: fullDateStr, day: d, isCurrentMonth: false, isToday: false, isWeekend: dayOfWeek === 0 || dayOfWeek === 6, jobs: jobsByDate.get(fullDateStr) || [] })
    }

    return days
  }, [currentMonth, jobsByDate, todayStr])

  const selectedDayJobs = useMemo(() => {
    if (!selectedDate) return []
    return jobsByDate.get(selectedDate) || []
  }, [selectedDate, jobsByDate])

  const monthStats = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const monthJobs = jobs.filter(j => {
      const d = parseLocalDate(j.date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const revenue = monthJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)
    const expenses = monthJobs.reduce((sum, j) =>
      sum + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)
    const daysWithJobs = new Set(monthJobs.map(j => j.date)).size
    return { jobCount: monthJobs.length, revenue, profit: revenue - expenses, daysWithJobs }
  }, [jobs, currentMonth])

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const goToPrevMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)); setSelectedDate(null); setExpandedJob(null) }
  const goToNextMonth = () => { setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)); setSelectedDate(null); setExpandedJob(null) }
  const goToToday = () => { setCurrentMonth(new Date()); setSelectedDate(todayStr); setExpandedJob(null) }

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(prev => prev === date ? null : date)
    setExpandedJob(null)
  }, [])

  const getJobProfit = (job: AppJob) => {
    const expenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + (job.dumpsterRental || 0) + (job.additionalExpense || 0)
    return job.revenue - expenses
  }

  const getProfitMargin = (job: AppJob) => {
    if (job.revenue <= 0) return 0
    return Math.round((getJobProfit(job) / job.revenue) * 100)
  }

  const getEstimateLabel = (job: AppJob) => {
    if (job.estimateLow && job.estimateHigh) return `${formatCurrency(job.estimateLow)} - ${formatCurrency(job.estimateHigh)}`
    if (job.estimateLow) return `From ${formatCurrency(job.estimateLow)}`
    if (job.estimateHigh) return `Up to ${formatCurrency(job.estimateHigh)}`
    return null
  }

  const formatSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">
            {monthStats.jobCount > 0
              ? <>{monthStats.jobCount} job{monthStats.jobCount !== 1 ? 's' : ''} in {currentMonth.toLocaleDateString('en-US', { month: 'long' })} &middot; {formatCurrency(monthStats.revenue)} revenue</>
              : <>No jobs in {currentMonth.toLocaleDateString('en-US', { month: 'long' })}</>
            }
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => onScheduleJob?.(selectedDate || todayStr) || onNavigate?.('jobs')} className="app-btn-primary text-sm py-2.5 px-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Job
          </button>
        </div>
      </div>

      {/* Month Stats */}
      {monthStats.jobCount > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card text-center !p-3">
            <p className="text-lg sm:text-2xl font-bold text-[var(--color-text-primary)]">{monthStats.jobCount}</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Jobs</p>
          </div>
          <div className="stat-card text-center !p-3">
            <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(monthStats.revenue)}</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Revenue</p>
          </div>
          <div className="stat-card text-center !p-3">
            <p className={`text-lg sm:text-2xl font-bold ${monthStats.profit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-500'}`}>{formatCurrency(monthStats.profit)}</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Gross Profit</p>
          </div>
          <div className="stat-card text-center !p-3">
            <p className="text-lg sm:text-2xl font-bold text-orange-500">{monthStats.daysWithJobs}</p>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">Active Days</p>
          </div>
        </div>
      )}

      {/* Calendar + Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {/* Month Navigation */}
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between">
            <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">{monthLabel}</h2>
              <button
                onClick={goToToday}
                className="px-2.5 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                Today
              </button>
            </div>
            <button onClick={goToNextMonth} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border-light)]">
            {WEEKDAYS_SHORT.map((day, i) => (
              <div key={day} className={`text-center text-xs font-semibold py-2 ${i === 0 || i === 6 ? 'text-[var(--color-text-faint)]' : 'text-[var(--color-text-muted)]'}`}>
                <span className="hidden sm:inline">{WEEKDAYS_FULL[i]}</span>
                <span className="sm:hidden">{day}</span>
              </div>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const hasJobs = day.jobs.length > 0
              const isSelected = selectedDate === day.date
              const totalRevenue = day.jobs.reduce((sum, j) => sum + (j.revenue || 0), 0)

              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(day.date)}
                  className={`
                    relative min-h-[60px] sm:min-h-[80px] p-1 sm:p-1.5 border-b border-r border-[var(--color-border-light)] text-left transition-all group
                    ${day.isCurrentMonth ? '' : 'opacity-30'}
                    ${isSelected ? 'bg-orange-50 dark:bg-orange-900/20 ring-2 ring-inset ring-orange-500' : ''}
                    ${!isSelected && day.isToday ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}
                    ${!isSelected && !day.isToday ? 'hover:bg-[var(--color-bg-subtle)]' : ''}
                  `}
                >
                  <span className={`
                    inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                    ${day.isToday ? 'bg-orange-500 text-white font-bold' : ''}
                    ${isSelected && !day.isToday ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}
                    ${!day.isToday && !isSelected ? (day.isWeekend ? 'text-[var(--color-text-faint)]' : 'text-[var(--color-text-secondary)]') : ''}
                  `}>
                    {day.day}
                  </span>

                  {hasJobs && (
                    <div className="mt-0.5 space-y-0.5 hidden sm:block">
                      {day.jobs.slice(0, 2).map((job) => (
                        <div
                          key={job.id}
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${
                            job.status === 'scheduled'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                          }`}
                        >
                          {job.customerName}
                        </div>
                      ))}
                      {day.jobs.length > 2 && (
                        <div className="text-[10px] text-[var(--color-text-faint)] px-1">
                          +{day.jobs.length - 2} more
                        </div>
                      )}
                    </div>
                  )}

                  {hasJobs && (
                    <div className="mt-1 flex gap-0.5 sm:hidden justify-center">
                      {day.jobs.slice(0, 3).map((_, j) => (
                        <span key={j} className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      ))}
                      {day.jobs.length > 3 && (
                        <span className="text-[8px] text-orange-500 font-bold ml-0.5">+</span>
                      )}
                    </div>
                  )}

                  {hasJobs && (
                    <div className="absolute bottom-1 right-1 hidden sm:block">
                      <span className="text-[9px] font-semibold text-green-600 dark:text-green-400">
                        {totalRevenue > 0 ? formatCurrency(totalRevenue) : `${day.jobs.length} scheduled`}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day Detail Panel */}
        <div className="lg:col-span-1">
          {selectedDate ? (
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden sticky top-4">
              <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                  {formatSelectedDate(selectedDate)}
                </h3>
                {selectedDayJobs.length > 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {selectedDayJobs.length} job{selectedDayJobs.length !== 1 ? 's' : ''} &middot;{' '}
                    {selectedDayJobs.some(j => (j.revenue || 0) > 0)
                      ? `${formatCurrency(selectedDayJobs.reduce((sum, j) => sum + (j.revenue || 0), 0))} revenue`
                      : 'scheduled work'}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">No jobs</p>
                )}
              </div>

              {selectedDayJobs.length > 0 ? (
                <div className="divide-y divide-[var(--color-border-light)]">
                  {selectedDayJobs.map((job) => {
                    const profit = getJobProfit(job)
                    const margin = getProfitMargin(job)
                    const isExpanded = expandedJob?.id === job.id

                    return (
                      <div key={job.id}>
                        <button
                          onClick={() => setExpandedJob(isExpanded ? null : job)}
                          className="w-full px-4 py-3 text-left hover:bg-[var(--color-bg-subtle)] transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${job.status === 'scheduled' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-green-50 dark:bg-green-900/30'}`}>
                                <svg className={`w-4 h-4 ${job.status === 'scheduled' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{job.customerName}</p>
                                <div className="flex items-center gap-1.5">
                                  {job.status === 'scheduled' && (
                                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Scheduled</span>
                                  )}
                                  {job.source && (
                                    <span className="text-[10px] text-[var(--color-text-faint)]">{job.source}</span>
                                  )}
                                  {job.status !== 'scheduled' && margin > 0 && (
                                    <span className={`text-[10px] font-medium ${margin >= 50 ? 'text-green-600 dark:text-green-400' : margin >= 25 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}`}>
                                      {margin}% margin
                                    </span>
                                  )}
                                </div>
                                {job.status === 'scheduled' && getEstimateLabel(job) && (
                                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">{getEstimateLabel(job)}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2 flex items-center gap-2">
                              <span className={`text-sm font-semibold ${job.status === 'scheduled' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                                {job.status === 'scheduled' ? (getEstimateLabel(job) || 'Scheduled') : formatCurrency(job.revenue)}
                              </span>
                              <svg className={`w-4 h-4 text-[var(--color-text-faint)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-3 animate-fade-in">
                            <div className="bg-[var(--color-bg-subtle)] rounded-lg p-3 space-y-2">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {job.status === 'scheduled' ? (
                                  <>
                                    <div>
                                      <span className="text-[var(--color-text-faint)]">Estimate</span>
                                      <p className="font-semibold text-blue-600 dark:text-blue-400">{getEstimateLabel(job) || 'Not set'}</p>
                                    </div>
                                    <div>
                                      <span className="text-[var(--color-text-faint)]">Status</span>
                                      <p className="font-semibold text-blue-600 dark:text-blue-400">Scheduled</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div>
                                      <span className="text-[var(--color-text-faint)]">Revenue</span>
                                      <p className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(job.revenue)}</p>
                                    </div>
                                    <div>
                                      <span className="text-[var(--color-text-faint)]">Profit</span>
                                      <p className={`font-semibold ${profit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-500'}`}>{formatCurrency(profit)}</p>
                                    </div>
                                  </>
                                )}
                                {job.labor > 0 && (
                                  <div>
                                    <span className="text-[var(--color-text-faint)]">Labor</span>
                                    <p className="font-medium text-[var(--color-text-secondary)]">{formatCurrency(job.labor)}</p>
                                  </div>
                                )}
                                {job.dumpFee > 0 && (
                                  <div>
                                    <span className="text-[var(--color-text-faint)]">Dump Fee</span>
                                    <p className="font-medium text-[var(--color-text-secondary)]">{formatCurrency(job.dumpFee)}</p>
                                  </div>
                                )}
                                {job.gas > 0 && (
                                  <div>
                                    <span className="text-[var(--color-text-faint)]">Gas</span>
                                    <p className="font-medium text-[var(--color-text-secondary)]">{formatCurrency(job.gas)}</p>
                                  </div>
                                )}
                                {job.dumpsterRental > 0 && (
                                  <div>
                                    <span className="text-[var(--color-text-faint)]">Dumpster</span>
                                    <p className="font-medium text-[var(--color-text-secondary)]">{formatCurrency(job.dumpsterRental)}</p>
                                  </div>
                                )}
                                {(job.numWorkers || 0) > 0 && (
                                  <div>
                                    <span className="text-[var(--color-text-faint)]">Workers</span>
                                    <p className="font-medium text-[var(--color-text-secondary)]">{job.numWorkers} &times; {formatCurrency(job.costPerWorker)}</p>
                                  </div>
                                )}
                              </div>
                              {job.notes && (
                                <div className="pt-2 border-t border-[var(--color-border-light)]">
                                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{job.notes}</p>
                                </div>
                              )}
                              {job.address && (
                                <div className="pt-2 border-t border-[var(--color-border-light)]">
                                  <p className="text-xs text-[var(--color-text-faint)]">Address</p>
                                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{job.address}</p>
                                </div>
                              )}
                              <button
                                onClick={() => onNavigate?.('jobs')}
                                className="w-full mt-1 text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium text-center py-1"
                              >
                                {job.status === 'scheduled' ? 'Open in Jobs to complete →' : 'Edit in Jobs →'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-1">No jobs on this day</p>
                  <button
                    onClick={() => onScheduleJob?.(selectedDate) || onNavigate?.('jobs')}
                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
                  >
                    Schedule a job &rarr;
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Select a Day</h3>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Click on any day in the calendar to see scheduled work or add a new job to that date.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
