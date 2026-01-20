import type { AppJob, AppSettings } from '@/types/database'

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
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
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
      ctx?.drawImage(img, 0, 0, width, height)

      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}
