import type { AppJob, AppSettings, AppFixedExpense } from '@/types/database'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a YYYY-MM-DD date string as local time instead of UTC.
 * Prevents the day-shift bug in western timezones where
 * `new Date("2026-03-02")` (UTC midnight) displays as March 1 in US zones.
 */
export function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes('T')) return new Date(dateStr)
  return new Date(dateStr + 'T12:00:00')
}

/**
 * Format a Date as YYYY-MM-DD using local calendar fields.
 * Avoids UTC conversion bugs from `toISOString()` for date inputs.
 */
export function formatLocalDateInput(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get a local YYYY-MM-DD string offset by whole calendar days.
 */
export function getRelativeLocalDateInput(daysOffset = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return formatLocalDateInput(date)
}

const ADDITIONAL_EXPENSE_LABEL_PREFIX = 'Other expense:'

export function extractAdditionalExpenseLabel(notes?: string | null): {
  additionalExpenseLabel?: string
  cleanNotes?: string
} {
  const trimmedNotes = notes?.trim()
  if (!trimmedNotes) return {}

  const [firstLine, ...remainingLines] = trimmedNotes.split('\n')
  if (!firstLine.startsWith(ADDITIONAL_EXPENSE_LABEL_PREFIX)) {
    return { cleanNotes: trimmedNotes }
  }

  const additionalExpenseLabel = firstLine.slice(ADDITIONAL_EXPENSE_LABEL_PREFIX.length).trim() || undefined
  const cleanNotes = remainingLines.join('\n').trim() || undefined
  return { additionalExpenseLabel, cleanNotes }
}

export function mergeAdditionalExpenseLabelIntoNotes(notes?: string | null, label?: string | null): string | null {
  const cleanLabel = label?.trim()
  const { cleanNotes } = extractAdditionalExpenseLabel(notes)

  if (!cleanLabel && !cleanNotes) return null
  if (!cleanLabel) return cleanNotes || null
  if (!cleanNotes) return `${ADDITIONAL_EXPENSE_LABEL_PREFIX} ${cleanLabel}`
  return `${ADDITIONAL_EXPENSE_LABEL_PREFIX} ${cleanLabel}\n${cleanNotes}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function calculateStats(jobs: AppJob[], settings: AppSettings) {
  const totalRevenue = jobs.reduce((sum, job) => sum + (job.revenue || 0), 0)
  const totalExpenses = jobs.reduce((sum, job) => {
    return sum + (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) +
                 (job.dumpsterRental || 0) + (job.additionalExpense || 0)
  }, 0)
  const netProfit = totalRevenue - totalExpenses
  const setAside = netProfit * (settings.taxPercentage / 100)
  const goalProgress = settings.monthlyGoal > 0 
    ? Math.min((totalRevenue / settings.monthlyGoal) * 100, 100) 
    : 0

  const sources: Record<string, number> = {}
  jobs.forEach(job => {
    if (job.source && job.source.trim()) {
      sources[job.source] = (sources[job.source] || 0) + 1
    }
  })

  let topSource: string | null = null
  let topCount = 0
  for (const [source, count] of Object.entries(sources)) {
    if (count > topCount) {
      topSource = source
      topCount = count
    }
  }

  return {
    jobCount: jobs.length,
    totalRevenue,
    totalExpenses,
    netProfit,
    setAside,
    goalProgress,
    topSource,
    topSourceCount: topCount,
    topSourcePercent: jobs.length > 0 ? ((topCount / jobs.length) * 100).toFixed(0) : '0',
  }
}

export async function compressImage(dataUrl: string, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas context unavailable')); return }
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to load image for compression'))
    img.src = dataUrl
  })
}

// ============================================
// FIXED EXPENSE UTILITIES
// ============================================

/**
 * Calculate total monthly fixed expenses
 * Converts yearly expenses to monthly equivalent (yearly / 12)
 */
export function calculateMonthlyFixedExpenses(expenses: AppFixedExpense[]): number {
  return expenses
    .filter(e => e.isActive)
    .reduce((total, expense) => {
      const monthlyAmount = expense.frequency === 'yearly' 
        ? expense.amount / 12 
        : expense.amount
      return total + monthlyAmount
    }, 0)
}

/**
 * Calculate total yearly fixed expenses
 * Converts monthly expenses to yearly equivalent (monthly * 12)
 */
export function calculateYearlyFixedExpenses(expenses: AppFixedExpense[]): number {
  return expenses
    .filter(e => e.isActive)
    .reduce((total, expense) => {
      const yearlyAmount = expense.frequency === 'monthly' 
        ? expense.amount * 12 
        : expense.amount
      return total + yearlyAmount
    }, 0)
}

/**
 * Group expenses by category with totals
 */
export function groupExpensesByCategory(expenses: AppFixedExpense[]): Record<string, { 
  expenses: AppFixedExpense[]
  monthlyTotal: number 
}> {
  const grouped: Record<string, { expenses: AppFixedExpense[]; monthlyTotal: number }> = {}
  
  expenses.forEach(expense => {
    const category = expense.category || 'other'
    if (!grouped[category]) {
      grouped[category] = { expenses: [], monthlyTotal: 0 }
    }
    grouped[category].expenses.push(expense)
    if (expense.isActive) {
      const monthlyAmount = expense.frequency === 'yearly' 
        ? expense.amount / 12 
        : expense.amount
      grouped[category].monthlyTotal += monthlyAmount
    }
  })
  
  return grouped
}

// Category labels and emojis for fixed expenses
export const EXPENSE_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  vehicle: { label: 'Vehicle', emoji: '🚗' },
  insurance: { label: 'Insurance', emoji: '🛡️' },
  software: { label: 'Software', emoji: '💻' },
  rent: { label: 'Rent/Lease', emoji: '🏢' },
  utilities: { label: 'Utilities', emoji: '⚡' },
  marketing: { label: 'Marketing', emoji: '📣' },
  equipment: { label: 'Equipment', emoji: '🔧' },
  subscription: { label: 'Subscriptions', emoji: '📱' },
  other: { label: 'Other', emoji: '📦' },
}
