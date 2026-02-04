import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getDyiaUserId(supabase: ReturnType<typeof getSupabase>, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return (data as { id: string } | null)?.id ?? null
}

/** GET: export user data as CSV (jobs + quotes summary). */
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [jobsRes, quotesRes] = await Promise.all([
      supabase.from('dyia_jobs').select('*').eq('user_id', dyiaUserId).order('date', { ascending: false }),
      supabase.from('dyia_quotes').select('id, customer_name, estimate_low, estimate_high, total, status, created_at').eq('user_id', dyiaUserId).order('created_at', { ascending: false }),
    ])

    if (jobsRes.error) throw jobsRes.error
    if (quotesRes.error) throw quotesRes.error

    const jobs = (jobsRes.data || []) as Record<string, unknown>[]
    const quotes = (quotesRes.data || []) as Record<string, unknown>[]

    const jobHeaders = ['date', 'customer_name', 'source', 'revenue', 'labor', 'gas', 'dump_fee', 'dumpster_rental', 'additional_expense', 'notes']
    const jobRows = jobs.map(j => jobHeaders.map(h => {
      const v = j[h]
      if (typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g, '""')}"`
      return v ?? ''
    }).join(','))
    const jobsCsv = [jobHeaders.join(','), ...jobRows].join('\n')

    const quoteHeaders = ['created_at', 'customer_name', 'estimate_low', 'estimate_high', 'total', 'status']
    const quoteRows = quotes.map(q => quoteHeaders.map(h => {
      const v = q[h]
      if (typeof v === 'string' && v.includes(',')) return `"${v.replace(/"/g, '""')}"`
      return v ?? ''
    }).join(','))
    const quotesCsv = [quoteHeaders.join(','), ...quoteRows].join('\n')

    const combined = `# Jobs\n${jobsCsv}\n\n# Quotes\n${quotesCsv}`

    return new NextResponse(combined, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dyia-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    )
  }
}
