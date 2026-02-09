import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env not set')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
}

async function getDyiaUserId(supabase: ReturnType<typeof getSupabase>, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase.from('dyia_users').select('id').eq('clerk_user_id', clerkUserId).single()
  return (data as { id: string } | null)?.id ?? null
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsvSection(title: string, headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.join(',')
  const dataLines = rows.map(r => headers.map(h => csvEscape(r[h])).join(','))
  return `# ${title}\n${headerLine}\n${dataLines.join('\n')}`
}

/** GET: export ALL user financial data as CSV (jobs, quotes, fixed expenses, settings, P&L). */
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Fetch all data in parallel
    const [jobsRes, quotesRes, expensesRes, settingsRes, customersRes] = await Promise.all([
      supabase.from('dyia_jobs').select('*').eq('user_id', dyiaUserId).order('date', { ascending: false }),
      supabase.from('dyia_quotes').select('id, customer_name, customer_phone, customer_email, customer_address, job_description, estimate_low, estimate_high, total, status, source, created_at').eq('user_id', dyiaUserId).order('created_at', { ascending: false }),
      supabase.from('dyia_fixed_expenses').select('*').eq('user_id', dyiaUserId).order('name'),
      supabase.from('dyia_settings').select('tax_percentage, monthly_goal, business_name, business_phone, business_email, business_address').eq('user_id', dyiaUserId).single(),
      supabase.from('dyia_customers').select('name, email, phone, address, tags, created_at').eq('user_id', dyiaUserId).order('name'),
    ])

    const jobs = (jobsRes.data || []) as Record<string, unknown>[]
    const quotes = (quotesRes.data || []) as Record<string, unknown>[]
    const expenses = (expensesRes.data || []) as Record<string, unknown>[]
    const settings = settingsRes.data as Record<string, unknown> | null
    const customers = (customersRes.data || []) as Record<string, unknown>[]

    // ── Jobs section ──
    const jobHeaders = ['date', 'customer_name', 'source', 'revenue', 'labor', 'gas', 'dump_fee', 'dumpster_rental', 'additional_expense', 'num_workers', 'cost_per_worker', 'notes']
    const jobsCsv = toCsvSection('Jobs', jobHeaders, jobs)

    // ── Quotes section ──
    const quoteHeaders = ['created_at', 'customer_name', 'customer_phone', 'customer_email', 'customer_address', 'job_description', 'estimate_low', 'estimate_high', 'total', 'status', 'source']
    const quotesCsv = toCsvSection('Quotes', quoteHeaders, quotes)

    // ── Fixed expenses section ──
    const expenseHeaders = ['name', 'amount', 'frequency', 'category', 'is_active']
    const expensesCsv = toCsvSection('Fixed Expenses', expenseHeaders, expenses)

    // ── Customers section ──
    const customerHeaders = ['name', 'email', 'phone', 'address', 'tags', 'created_at']
    const customersCsv = toCsvSection('Customers', customerHeaders, customers)

    // ── P&L Summary ──
    const totalRevenue = jobs.reduce((s, j) => s + (Number(j.revenue) || 0), 0)
    const totalJobExpenses = jobs.reduce((s, j) =>
      s + (Number(j.labor) || 0) + (Number(j.gas) || 0) + (Number(j.dump_fee) || 0) +
      (Number(j.dumpster_rental) || 0) + (Number(j.additional_expense) || 0), 0)
    const grossProfit = totalRevenue - totalJobExpenses

    const monthlyFixed = expenses
      .filter(e => e.is_active !== false)
      .reduce((s, e) => {
        const amt = Number(e.amount) || 0
        return s + (e.frequency === 'yearly' ? amt / 12 : amt)
      }, 0)

    // Calculate months spanned by job data
    let monthsSpan = 1
    if (jobs.length > 1) {
      const dates = jobs.map(j => new Date(j.date as string).getTime()).filter(d => !isNaN(d))
      if (dates.length > 1) {
        const earliest = new Date(Math.min(...dates))
        const latest = new Date(Math.max(...dates))
        monthsSpan = Math.max(1, (latest.getFullYear() - earliest.getFullYear()) * 12 + (latest.getMonth() - earliest.getMonth()) + 1)
      }
    }
    const totalFixedExpenses = monthlyFixed * monthsSpan
    const netProfit = grossProfit - totalFixedExpenses
    const taxPct = Number(settings?.tax_percentage) || 30
    const taxSetAside = netProfit > 0 ? netProfit * (taxPct / 100) : 0
    const takeHome = netProfit - taxSetAside

    const plSummary = [
      `# Profit & Loss Summary`,
      `metric,amount`,
      `Total Revenue,${totalRevenue.toFixed(2)}`,
      `Job Expenses,${totalJobExpenses.toFixed(2)}`,
      `Gross Profit,${grossProfit.toFixed(2)}`,
      `Fixed Overhead (${monthsSpan} months),${totalFixedExpenses.toFixed(2)}`,
      `Net Profit,${netProfit.toFixed(2)}`,
      `Tax Set-Aside (${taxPct}%),${taxSetAside.toFixed(2)}`,
      `Take Home,${takeHome.toFixed(2)}`,
      ``,
      `Total Jobs,${jobs.length}`,
      `Total Quotes,${quotes.length}`,
      `Total Customers,${customers.length}`,
      `Tax Percentage,${taxPct}%`,
      `Monthly Fixed Expenses,${monthlyFixed.toFixed(2)}`,
      `Monthly Goal,${settings?.monthly_goal || 0}`,
    ].join('\n')

    // ── Settings section ──
    const settingsCsv = settings ? [
      `# Business Settings`,
      `setting,value`,
      `Business Name,${csvEscape(settings.business_name)}`,
      `Phone,${csvEscape(settings.business_phone)}`,
      `Email,${csvEscape(settings.business_email)}`,
      `Address,${csvEscape(settings.business_address)}`,
      `Tax Percentage,${taxPct}%`,
      `Monthly Goal,${settings.monthly_goal || 0}`,
    ].join('\n') : ''

    const combined = [plSummary, jobsCsv, quotesCsv, expensesCsv, customersCsv, settingsCsv].filter(Boolean).join('\n\n')

    return new NextResponse(combined, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dyia-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err) {
    console.error('Export error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Export failed' }, { status: 500 })
  }
}
