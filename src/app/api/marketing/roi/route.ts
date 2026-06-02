import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getDyiaUserId(supabase: SupabaseClient, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return (data as { id: string } | null)?.id ?? null
}

/** GET: ROI by marketing source. Query: month (YYYY-MM) optional; omit for all-time. */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const monthParam = searchParams.get('month')
    const allTime = !monthParam || monthParam === 'all'

    let spendQuery = supabase
      .from('dyia_marketing_spend')
      .select('source, amount')
      .eq('user_id', dyiaUserId)
    let jobsQuery = supabase
      .from('dyia_jobs')
      .select('source, revenue')
      .eq('user_id', dyiaUserId)
    let quotesQuery = supabase
      .from('dyia_quotes')
      .select('source')
      .eq('user_id', dyiaUserId)

    if (!allTime) {
      const monthStart = `${monthParam!.slice(0, 7)}-01`
      const [year, month] = monthStart.split('-').map(Number)
      const nextMonth = month === 12 ? [year + 1, 1] : [year, month + 1]
      const monthEnd = `${nextMonth[0]}-${String(nextMonth[1]).padStart(2, '0')}-01`
      spendQuery = spendQuery.eq('month', monthStart)
      jobsQuery = jobsQuery.gte('date', monthStart).lt('date', monthEnd)
      quotesQuery = quotesQuery.gte('created_at', monthStart).lt('created_at', monthEnd)
    }

    const [spendRes, jobsRes, quotesRes] = await Promise.all([spendQuery, jobsQuery, quotesQuery])

    if (spendRes.error) {
      console.error('Marketing ROI spend fetch:', spendRes.error)
      return NextResponse.json({ error: spendRes.error.message }, { status: 500 })
    }
    if (jobsRes.error) {
      console.error('Marketing ROI jobs fetch:', jobsRes.error)
      return NextResponse.json({ error: jobsRes.error.message }, { status: 500 })
    }

    type SpendRow = { source: string; amount: number }
    type JobRow = { source: string | null; revenue: number }
    type QuoteRow = { source: string | null }
    const spendRows = (spendRes.data ?? []) as SpendRow[]
    const jobRows = (jobsRes.data ?? []) as JobRow[]
    const quoteRows = (quotesRes.data ?? []) as QuoteRow[]

    // Normalize source names (case-insensitive, trimmed)
    const normalizeSource = (s: string | null | undefined): string => {
      const trimmed = (s || '').trim()
      if (!trimmed) return 'Unknown'
      // Capitalize first letter of each word for display consistency
      return trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    }

    const spendBySource: Record<string, number> = {}
    for (const row of spendRows) {
      const src = normalizeSource(row.source)
      spendBySource[src] = (spendBySource[src] || 0) + (parseFloat(String(row.amount)) || 0)
    }

    const revenueBySource: Record<string, number> = {}
    const jobsBySource: Record<string, number> = {}
    for (const row of jobRows) {
      const src = normalizeSource(row.source)
      revenueBySource[src] = (revenueBySource[src] || 0) + (parseFloat(String(row.revenue)) || 0)
      jobsBySource[src] = (jobsBySource[src] || 0) + 1
    }

    // Count quotes (leads) by source
    const quotesBySource: Record<string, number> = {}
    for (const row of quoteRows) {
      if (row.source) {
        const src = normalizeSource(row.source)
        quotesBySource[src] = (quotesBySource[src] || 0) + 1
      }
    }

    const allSources = new Set([...Object.keys(spendBySource), ...Object.keys(revenueBySource), ...Object.keys(quotesBySource)])
    const roi = Array.from(allSources).map(source => {
      const spend = spendBySource[source] ?? 0
      const revenue = revenueBySource[source] ?? 0
      const jobs = jobsBySource[source] ?? 0
      const quotes = quotesBySource[source] ?? 0
      const roiPct = spend > 0 ? ((revenue - spend) / spend) * 100 : (revenue > 0 ? 100 : 0)
      const costPerJob = jobs > 0 ? spend / jobs : 0
      const costPerLead = quotes > 0 ? spend / quotes : 0
      const conversionRate = quotes > 0 ? Math.round((jobs / quotes) * 100) : (jobs > 0 ? 100 : 0)
      return {
        source, spend, revenue, jobs, quotes,
        roi: Math.round(roiPct * 100) / 100,
        costPerJob: Math.round(costPerJob * 100) / 100,
        costPerLead: Math.round(costPerLead * 100) / 100,
        conversionRate,
      }
    })

    roi.sort((a, b) => b.revenue - a.revenue)

    const monthStart = allTime ? null : `${monthParam!.slice(0, 7)}-01`
    return NextResponse.json({ month: monthStart, items: roi })
  } catch (err) {
    console.error('Marketing ROI GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
