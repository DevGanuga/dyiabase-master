import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import type { SourceROI } from '@/types/database'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getDyiaUserId(supabase: ReturnType<typeof createClient>, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return data?.id ?? null
}

/** GET: ROI by marketing source for a month. Query: month (YYYY-MM) required. */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    if (!monthParam) return NextResponse.json({ error: 'month (YYYY-MM) is required' }, { status: 400 })
    const monthStart = `${monthParam.slice(0, 7)}-01`
    const [year, month] = monthStart.split('-').map(Number)
    const nextMonth = month === 12 ? [year + 1, 1] : [year, month + 1]
    const monthEnd = `${nextMonth[0]}-${String(nextMonth[1]).padStart(2, '0')}-01`

    const [spendRes, jobsRes] = await Promise.all([
      supabase
        .from('dyia_marketing_spend')
        .select('source, amount')
        .eq('user_id', dyiaUserId)
        .eq('month', monthStart),
      supabase
        .from('dyia_jobs')
        .select('source, revenue')
        .eq('user_id', dyiaUserId)
        .gte('date', monthStart)
        .lt('date', monthEnd),
    ])

    if (spendRes.error) {
      console.error('Marketing ROI spend fetch:', spendRes.error)
      return NextResponse.json({ error: spendRes.error.message }, { status: 500 })
    }
    if (jobsRes.error) {
      console.error('Marketing ROI jobs fetch:', jobsRes.error)
      return NextResponse.json({ error: jobsRes.error.message }, { status: 500 })
    }

    const spendBySource: Record<string, number> = {}
    for (const row of spendRes.data || []) {
      const src = (row.source || '').trim() || 'Unknown'
      spendBySource[src] = (spendBySource[src] || 0) + (parseFloat(row.amount) || 0)
    }

    const revenueBySource: Record<string, number> = {}
    const jobsBySource: Record<string, number> = {}
    for (const row of jobsRes.data || []) {
      const src = (row.source || '').trim() || 'Unknown'
      revenueBySource[src] = (revenueBySource[src] || 0) + (parseFloat(row.revenue) || 0)
      jobsBySource[src] = (jobsBySource[src] || 0) + 1
    }

    const allSources = new Set([...Object.keys(spendBySource), ...Object.keys(revenueBySource)])
    const roi: SourceROI[] = Array.from(allSources).map(source => {
      const spend = spendBySource[source] ?? 0
      const revenue = revenueBySource[source] ?? 0
      const jobs = jobsBySource[source] ?? 0
      const roiPct = spend > 0 ? ((revenue - spend) / spend) * 100 : (revenue > 0 ? 100 : 0)
      const costPerJob = jobs > 0 ? spend / jobs : 0
      return { source, spend, revenue, jobs, roi: Math.round(roiPct * 100) / 100, costPerJob: Math.round(costPerJob * 100) / 100 }
    })

    roi.sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({ month: monthStart, items: roi })
  } catch (err) {
    console.error('Marketing ROI GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
