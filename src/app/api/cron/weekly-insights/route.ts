import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { weeklyInsightsEmail, type WeeklyInsightsData } from '@/lib/resend/templates'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Build minimal weekly stats from jobs (no AI). Used for weekly insights email.
 */
async function getWeeklyInsightsData(supabase: ReturnType<typeof createClient>, userId: string): Promise<WeeklyInsightsData> {
  const now = new Date()
  const thisWeekStart = new Date(now)
  thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - 7)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setUTCDate(lastWeekStart.getUTCDate() - 7)

  const format = (d: Date) => d.toISOString().slice(0, 10)

  const { data: jobs } = await supabase
    .from('dyia_jobs')
    .select('date, revenue, labor, gas, dump_fee, dumpster_rental, additional_expense, num_workers, cost_per_worker, source')
    .eq('user_id', userId)
    .gte('date', format(lastWeekStart))
    .lt('date', format(new Date(now.getTime() + 86400000)))

  const thisWeekStartStr = format(thisWeekStart)
  const thisWeekEndStr = format(now)

  let thisWeekRevenue = 0
  let thisWeekProfit = 0
  let thisWeekCount = 0
  const thisWeekSources: Record<string, number> = {}

  let lastWeekRevenue = 0

  for (const j of jobs || []) {
    const rev = parseFloat(String(j.revenue)) || 0
    const labor = parseFloat(String(j.labor)) || 0
    const gas = parseFloat(String(j.gas)) || 0
    const dumpFee = parseFloat(String(j.dump_fee)) || 0
    const dumpsterRental = parseFloat(String(j.dumpster_rental)) || 0
    const additional = parseFloat(String(j.additional_expense)) || 0
    const numWorkers = parseInt(String(j.num_workers), 10) || 0
    const costPerWorker = parseFloat(String(j.cost_per_worker)) || 0
    const cost = labor + gas + dumpFee + dumpsterRental + additional + numWorkers * costPerWorker
    const profit = rev - cost

    const dateStr = (j.date as string).slice(0, 10)
    if (dateStr >= thisWeekStartStr && dateStr <= thisWeekEndStr) {
      thisWeekRevenue += rev
      thisWeekProfit += profit
      thisWeekCount++
      const src = (j.source as string)?.trim() || 'Unknown'
      thisWeekSources[src] = (thisWeekSources[src] || 0) + 1
    } else {
      lastWeekRevenue += rev
    }
  }

  const revenueChange = lastWeekRevenue > 0
    ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 1000) / 10
    : (thisWeekRevenue > 0 ? 100 : 0)

  const topSource = Object.entries(thisWeekSources).sort((a, b) => b[1] - a[1])[0]?.[0] || ''

  return {
    revenue: Math.round(thisWeekRevenue),
    revenueChange,
    profit: Math.round(thisWeekProfit),
    jobCount: thisWeekCount,
    avgJobValue: thisWeekCount > 0 ? Math.round(thisWeekRevenue / thisWeekCount) : 0,
    topSource,
    insights: [],
    recommendations: [],
  }
}

/**
 * Cron: send weekly insights email to Pro users.
 * Call with: Authorization: Bearer CRON_SECRET
 * Schedule: weekly (e.g. Monday 9:00 UTC).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ error: 'Resend not configured' }, { status: 503 })
  }

  try {
    const supabase = getSupabase()

    const { data: users, error } = await supabase
      .from('dyia_users')
      .select('id, email, first_name')
      .in('subscription_status', ['active', 'trialing'])

    if (error) {
      console.error('Weekly insights fetch users error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let sent = 0
    for (const u of users || []) {
      if (!u.email) continue
      try {
        const data = await getWeeklyInsightsData(supabase, u.id)
        const result = await sendEmail(
          u.email,
          'Your Weekly Business Insights',
          weeklyInsightsEmail(u.first_name || 'there', data),
          'weekly_insights'
        )
        if (result.success) sent++
      } catch (err) {
        console.error(`Weekly insights failed for ${u.id}:`, err)
      }
    }

    return NextResponse.json({ sent, total: (users || []).length })
  } catch (err) {
    console.error('Weekly insights cron:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
