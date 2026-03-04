'use client'

import { useMemo, useState } from 'react'
import type { AppJob } from '@/types/database'
import { formatCurrency, parseLocalDate } from '@/lib/utils'

interface MiniCalendarProps {
  jobs: AppJob[]
  onDayClick?: (date: string) => void
  onViewFullCalendar?: () => void
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function MiniCalendar({ jobs, onDayClick, onViewFullCalendar }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  const todayStr = new Date().toISOString().split('T')[0]

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
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPad = firstDayOfMonth.getDay()
    const totalDays = lastDay.getDate()

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean; isToday: boolean; jobs: AppJob[] }> = []

    const prevMonthLast = new Date(year, month, 0).getDate()
    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevMonthLast - i
      const prevDate = new Date(year, month - 1, d)
      const fullDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: fullDateStr, day: d, isCurrentMonth: false, isToday: false, jobs: jobsByDate.get(fullDateStr) || [] })
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: dateStr, day: d, isCurrentMonth: true, isToday: dateStr === todayStr, jobs: jobsByDate.get(dateStr) || [] })
    }

    // Only pad to fill complete rows (multiples of 7)
    const rowsNeeded = Math.ceil(days.length / 7)
    const totalCells = rowsNeeded * 7
    const remaining = totalCells - days.length
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d)
      const fullDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: fullDateStr, day: d, isCurrentMonth: false, isToday: false, jobs: jobsByDate.get(fullDateStr) || [] })
    }

    return days
  }, [currentMonth, jobsByDate, todayStr])

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const goToPrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const goToNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  const goToToday = () => setCurrentMonth(new Date())

  const monthStats = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const monthJobs = jobs.filter(j => {
      const d = parseLocalDate(j.date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const revenue = monthJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)
    return { count: monthJobs.length, revenue }
  }, [jobs, currentMonth])

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--color-border-light)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Calendar</h3>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {monthStats.count} job{monthStats.count !== 1 ? 's' : ''}
              {monthStats.revenue > 0 && <> &middot; {formatCurrency(monthStats.revenue)}</>}
            </p>
          </div>
        </div>
        {onViewFullCalendar && (
          <button
            onClick={onViewFullCalendar}
            className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
          >
            Full view
          </button>
        )}
      </div>

      {/* Month Navigation */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button onClick={goToToday} className="text-xs font-semibold text-[var(--color-text-primary)] hover:text-orange-500 transition-colors">
          {monthLabel}
        </button>
        <button onClick={goToNextMonth} className="p-1 rounded hover:bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="px-3 grid grid-cols-7 gap-0">
        {WEEKDAYS.map(day => (
          <div key={day} className="text-center text-[10px] font-medium text-[var(--color-text-faint)] py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="px-3 pb-3 grid grid-cols-7 gap-0">
        {calendarDays.map((day, i) => {
          const hasJobs = day.jobs.length > 0
          const totalRevenue = day.jobs.reduce((sum, j) => sum + (j.revenue || 0), 0)

          return (
            <button
              key={i}
              onClick={() => onDayClick?.(day.date)}
              className={`
                relative aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all
                ${day.isCurrentMonth ? '' : 'opacity-30'}
                ${day.isToday ? 'bg-orange-500 text-white font-bold shadow-sm shadow-orange-500/30' : ''}
                ${!day.isToday && hasJobs ? 'font-semibold text-[var(--color-text-primary)] hover:bg-orange-50 dark:hover:bg-orange-900/20 cursor-pointer' : ''}
                ${!day.isToday && !hasJobs ? 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] cursor-pointer' : ''}
              `}
              title={hasJobs ? `${day.jobs.length} job${day.jobs.length !== 1 ? 's' : ''} · ${formatCurrency(totalRevenue)}` : undefined}
            >
              <span className="leading-none">{day.day}</span>
              {hasJobs && (
                <span className="absolute bottom-0.5 flex gap-px">
                  {day.jobs.slice(0, 3).map((_, j) => (
                    <span
                      key={j}
                      className={`w-1 h-1 rounded-full ${day.isToday ? 'bg-white/80' : 'bg-orange-500'}`}
                    />
                  ))}
                  {day.jobs.length > 3 && (
                    <span className={`text-[7px] font-bold leading-none ${day.isToday ? 'text-white/80' : 'text-orange-500'}`}>+</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
