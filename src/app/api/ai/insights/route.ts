import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type InsightType = 'dashboard' | 'weekly' | 'monthly' | 'reports'

interface InsightRequest {
  type: InsightType
  forceRefresh?: boolean
}

interface BusinessData {
  revenueThisMonth: number
  revenueLastMonth: number
  profitThisMonth: number
  profitMargin: number
  jobCountThisMonth: number
  jobCountLastMonth: number
  avgJobValue: number
  pendingFollowUps: number
  topSource: string
  fixedExpenses: number
  monthlyGoal: number
  goalProgress: number
}

// Cache duration in seconds
const CACHE_DURATION = {
  dashboard: 3600, // 1 hour
  weekly: 86400, // 24 hours
  monthly: 86400 * 7, // 1 week
  reports: 3600, // 1 hour
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: InsightRequest = await req.json()
    const { type = 'dashboard', forceRefresh = false } = body

    // Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from('dyia_users')
      .select('id, subscription_status, first_name')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check subscription for Pro features
    const isPro = ['active', 'trialing'].includes(userProfile.subscription_status || '')
    if (!isPro && type !== 'dashboard') {
      return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 })
    }

    // Check cache unless force refresh
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('dyia_insights_cache')
        .select('report_data, generated_at')
        .eq('user_id', userProfile.id)
        .eq('report_type', type)
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()

      if (cached) {
        return NextResponse.json({
          insight: cached.report_data,
          cached: true,
          generatedAt: cached.generated_at,
        })
      }
    }

    // Fetch business data
    const businessData = await fetchBusinessData(userProfile.id)

    // Build the insight directly from business data so this endpoint is fast and deterministic.
    const insight = generateInsight(type, businessData, userProfile.first_name || 'there')

    // Cache the result
    await supabase.from('dyia_insights_cache').insert({
      user_id: userProfile.id,
      report_type: type,
      report_data: insight,
      expires_at: new Date(Date.now() + CACHE_DURATION[type] * 1000).toISOString(),
    })

    return NextResponse.json({
      insight,
      cached: false,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('AI Insights error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to generate insights'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function fetchBusinessData(userId: string): Promise<BusinessData> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  // Get jobs for this month
  const { data: thisMonthJobs } = await supabase
    .from('dyia_jobs')
    .select('revenue, labor, gas, dump_fee, dumpster_rental, additional_expense, source, status')
    .eq('user_id', userId)
    .gte('date', startOfMonth.toISOString().split('T')[0])

  // Get jobs for last month
  const { data: lastMonthJobs } = await supabase
    .from('dyia_jobs')
    .select('revenue, labor, gas, dump_fee, dumpster_rental, additional_expense, source, status')
    .eq('user_id', userId)
    .gte('date', startOfLastMonth.toISOString().split('T')[0])
    .lte('date', endOfLastMonth.toISOString().split('T')[0])

  // Get pending follow-ups
  const { count: followUpCount } = await supabase
    .from('dyia_follow_ups')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['pending', 'contacted', 'snoozed'])

  // Get fixed expenses
  const { data: fixedExpenses } = await supabase
    .from('dyia_fixed_expenses')
    .select('amount, frequency')
    .eq('user_id', userId)
    .eq('is_active', true)

  // Get settings
  const { data: settings } = await supabase
    .from('dyia_settings')
    .select('monthly_goal')
    .eq('user_id', userId)
    .single()

  // Calculate metrics
  const jobs = (thisMonthJobs || []).filter(job => job.status !== 'scheduled')
  const lastJobs = (lastMonthJobs || []).filter(job => job.status !== 'scheduled')

  const calcRevenue = (jobList: typeof jobs) =>
    jobList.reduce((sum, j) => sum + (parseFloat(j.revenue) || 0), 0)

  const calcExpenses = (jobList: typeof jobs) =>
    jobList.reduce(
      (sum, j) =>
        sum +
        (parseFloat(j.labor) || 0) +
        (parseFloat(j.gas) || 0) +
        (parseFloat(j.dump_fee) || 0) +
        (parseFloat(j.dumpster_rental) || 0) +
        (parseFloat(j.additional_expense) || 0),
      0
    )

  const revenueThisMonth = calcRevenue(jobs)
  const revenueLastMonth = calcRevenue(lastJobs)
  const expensesThisMonth = calcExpenses(jobs)
  const profitThisMonth = revenueThisMonth - expensesThisMonth

  // Calculate fixed monthly expenses
  const monthlyFixed = (fixedExpenses || []).reduce((sum, e) => {
    const amount = parseFloat(e.amount) || 0
    return sum + (e.frequency === 'yearly' ? amount / 12 : amount)
  }, 0)

  // Source breakdown
  const sourceMap: Record<string, number> = {}
  jobs.forEach((j) => {
    const source = j.source || 'Unknown'
    sourceMap[source] = (sourceMap[source] || 0) + 1
  })
  const topSource =
    Object.entries(sourceMap).sort(([, a], [, b]) => b - a)[0]?.[0] || 'None'

  const monthlyGoal = parseFloat(settings?.monthly_goal) || 0

  return {
    revenueThisMonth,
    revenueLastMonth,
    profitThisMonth,
    profitMargin: revenueThisMonth > 0 ? (profitThisMonth / revenueThisMonth) * 100 : 0,
    jobCountThisMonth: jobs.length,
    jobCountLastMonth: lastJobs.length,
    avgJobValue: jobs.length > 0 ? revenueThisMonth / jobs.length : 0,
    pendingFollowUps: followUpCount || 0,
    topSource,
    fixedExpenses: monthlyFixed,
    monthlyGoal,
    goalProgress: monthlyGoal > 0 ? (revenueThisMonth / monthlyGoal) * 100 : 0,
  }
}

function generateInsight(
  type: InsightType,
  data: BusinessData,
  firstName: string
): InsightResult {
  switch (type) {
    case 'weekly':
      return buildWeeklyInsight(data, firstName)
    case 'monthly':
      return buildMonthlyInsight(data, firstName)
    case 'reports':
      return buildReportsInsight(data, firstName)
    case 'dashboard':
    default:
      return buildDashboardInsight(data, firstName)
  }
}

function buildDashboardInsight(data: BusinessData, firstName: string): InsightResult {
  const revenueDelta = getDeltaPercent(data.revenueThisMonth, data.revenueLastMonth)
  const jobsDelta = getDeltaPercent(data.jobCountThisMonth, data.jobCountLastMonth)

  if (data.jobCountThisMonth === 0) {
    return {
      headline: data.pendingFollowUps > 0 ? 'Follow-ups are the move' : 'No completed jobs yet',
      summary:
        data.pendingFollowUps > 0
          ? `${firstName}, you have no completed jobs logged this month yet, but ${data.pendingFollowUps} follow-up${data.pendingFollowUps === 1 ? '' : 's'} still in play. Closing even one of them gets revenue moving again.`
          : `${firstName}, there are no completed jobs logged this month yet. As soon as the first job is closed out, this card will start tracking revenue, margin, and momentum automatically.`,
      metric: {
        label: data.pendingFollowUps > 0 ? 'Pending follow-ups' : 'Jobs this month',
        value: data.pendingFollowUps > 0 ? String(data.pendingFollowUps) : '0',
        trend: 'neutral',
      },
      tip:
        data.pendingFollowUps > 0
          ? 'Reach out to the hottest quote today.'
          : 'Log your first completed job to start trends.',
    }
  }

  if (data.goalProgress >= 100) {
    return {
      headline: 'Monthly goal cleared',
      summary: `${firstName}, you are at ${formatPercent(data.goalProgress)} of your monthly goal with ${formatCurrency(data.revenueThisMonth)} in completed revenue. Profit is ${formatCurrency(data.profitThisMonth)} at a ${formatPercent(data.profitMargin)} margin.`,
      metric: {
        label: 'Goal progress',
        value: formatPercent(data.goalProgress),
        trend: 'up',
      },
      tip: 'Protect margin now that revenue is in.',
    }
  }

  if (data.profitMargin < 30) {
    return {
      headline: 'Margins need attention',
      summary: `${firstName}, revenue is ${formatCurrency(data.revenueThisMonth)} across ${data.jobCountThisMonth} completed jobs, but profit margin is only ${formatPercent(data.profitMargin)}. Costs are eating too much of each job right now.`,
      metric: {
        label: 'Profit margin',
        value: formatPercent(data.profitMargin),
        trend: 'down',
      },
      tip: 'Review pricing or expense-heavy jobs first.',
    }
  }

  if (data.pendingFollowUps >= 3) {
    return {
      headline: 'Revenue is still on table',
      summary: `${firstName}, ${data.pendingFollowUps} follow-ups are still open while completed revenue sits at ${formatCurrency(data.revenueThisMonth)}. With ${data.topSource !== 'None' ? `${data.topSource} driving the most jobs, ` : ''}fast follow-up is likely the easiest way to grow this month.`,
      metric: {
        label: 'Pending follow-ups',
        value: String(data.pendingFollowUps),
        trend: 'up',
      },
      tip: 'Work the warmest follow-ups before chasing new leads.',
    }
  }

  return {
    headline: revenueDelta >= 0 ? 'Revenue is moving up' : 'Revenue is off pace',
    summary: `${firstName}, completed revenue is ${formatCurrency(data.revenueThisMonth)} from ${data.jobCountThisMonth} jobs this month. That is ${formatSignedPercent(revenueDelta)} versus last month, and your average completed job is ${formatCurrency(data.avgJobValue)}.`,
    metric: {
      label: 'Revenue vs last month',
      value: formatSignedPercent(revenueDelta),
      trend: revenueDelta > 0 ? 'up' : revenueDelta < 0 ? 'down' : 'neutral',
    },
    tip:
      jobsDelta < 0
        ? 'More booked jobs will matter more than higher ticket size.'
        : data.topSource !== 'None'
          ? `Double down on ${data.topSource}.`
          : 'Keep logging source data to spot what is working.',
  }
}

function buildWeeklyInsight(data: BusinessData, firstName: string): InsightResult {
  const revenueDelta = getDeltaPercent(data.revenueThisMonth, data.revenueLastMonth)
  return {
    headline: revenueDelta >= 0 ? 'Weekly momentum is solid' : 'Weekly pace needs a push',
    summary: `${firstName}, you have ${data.jobCountThisMonth} completed jobs this month generating ${formatCurrency(data.revenueThisMonth)} in revenue and ${formatCurrency(data.profitThisMonth)} in profit. That puts average job value at ${formatCurrency(data.avgJobValue)} with ${data.pendingFollowUps} follow-up${data.pendingFollowUps === 1 ? '' : 's'} still open.`,
    highlights: [
      `${formatCurrency(data.revenueThisMonth)} revenue this month`,
      `${formatPercent(data.profitMargin)} profit margin`,
    ],
    recommendations: [
      data.pendingFollowUps > 0
        ? `Contact ${data.pendingFollowUps} open follow-up${data.pendingFollowUps === 1 ? '' : 's'} this week`
        : 'Keep current lead flow warm with quick callbacks',
      data.topSource !== 'None'
        ? `Lean into ${data.topSource}, your top source right now`
        : 'Track lead source on every job to improve attribution',
    ],
  }
}

function buildMonthlyInsight(data: BusinessData, firstName: string): InsightResult {
  const revenueDelta = getDeltaPercent(data.revenueThisMonth, data.revenueLastMonth)
  return {
    headline: data.goalProgress >= 100 ? 'Strong month on the board' : 'Month still has room',
    summary: `${firstName}, the month is at ${formatCurrency(data.revenueThisMonth)} in completed revenue versus ${formatCurrency(data.revenueLastMonth)} last month. Profit is ${formatCurrency(data.profitThisMonth)} with ${formatCurrency(data.fixedExpenses)} in fixed monthly overhead and a ${formatPercent(data.profitMargin)} margin.`,
    keyMetrics: [
      { label: 'Revenue', value: formatCurrency(data.revenueThisMonth), change: formatSignedPercent(revenueDelta) },
      { label: 'Jobs', value: String(data.jobCountThisMonth), change: formatSignedPercent(getDeltaPercent(data.jobCountThisMonth, data.jobCountLastMonth)) },
      { label: 'Avg job', value: formatCurrency(data.avgJobValue), change: data.profitMargin >= 40 ? 'healthy margin' : 'watch margin' },
    ],
    strengths: [
      data.topSource !== 'None' ? `${data.topSource} is leading your completed jobs` : 'You are building a baseline month of data',
    ],
    opportunities: [
      data.pendingFollowUps > 0
        ? `${data.pendingFollowUps} follow-up${data.pendingFollowUps === 1 ? '' : 's'} could still turn into closed revenue`
        : 'More lead volume is the clearest growth lever right now',
    ],
    nextMonthFocus:
      data.profitMargin < 30
        ? 'Raise margin on lower-profit jobs before scaling volume.'
        : data.goalProgress < 100
          ? 'Close follow-ups faster so revenue catches up to goal.'
          : 'Scale the sources bringing in your best-paying jobs.',
  }
}

function buildReportsInsight(data: BusinessData, firstName: string): InsightResult {
  const revenueDelta = getDeltaPercent(data.revenueThisMonth, data.revenueLastMonth)
  const insights = [
    `Completed revenue is ${formatCurrency(data.revenueThisMonth)} across ${data.jobCountThisMonth} jobs.`,
    `Average completed job value is ${formatCurrency(data.avgJobValue)} with a ${formatPercent(data.profitMargin)} margin.`,
    data.topSource !== 'None'
      ? `${data.topSource} is the top source in your logged jobs this month.`
      : 'Lead source data is still too thin to identify a winner.',
  ]

  return {
    headline: revenueDelta >= 0 ? 'Business trend is improving' : 'Business trend is mixed',
    summary: `${firstName}, the report shows ${formatCurrency(data.revenueThisMonth)} in completed revenue this month, ${formatCurrency(data.profitThisMonth)} in gross profit, and ${formatCurrency(data.fixedExpenses)} in fixed monthly overhead. ${data.monthlyGoal > 0 ? `You are at ${formatPercent(data.goalProgress)} of the monthly goal.` : 'Set a monthly goal to benchmark pace more clearly.'}`,
    keyMetrics: [
      { label: 'Revenue', value: formatCurrency(data.revenueThisMonth), change: formatSignedPercent(revenueDelta) },
      { label: 'Profit', value: formatCurrency(data.profitThisMonth), change: `${formatPercent(data.profitMargin)} margin` },
      { label: 'Follow-ups', value: String(data.pendingFollowUps), change: data.pendingFollowUps > 0 ? 'pipeline open' : 'pipeline clear' },
    ],
    insights,
    recommendation:
      data.pendingFollowUps > 0
        ? 'Push follow-ups first. That is the fastest path to more closed revenue.'
        : data.profitMargin < 30
          ? 'Tighten pricing or job costs before adding more volume.'
          : data.topSource !== 'None'
            ? `Invest more in ${data.topSource} while margins are healthy.`
            : 'Keep logging consistent source data so the report can identify what converts best.',
  }
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function formatSignedPercent(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

function getDeltaPercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0
    return 100
  }
  return ((current - previous) / previous) * 100
}

// Type for insight results
export interface InsightResult {
  headline: string
  summary: string
  metric?: {
    label: string
    value: string
    trend: 'up' | 'down' | 'neutral'
  }
  tip?: string
  highlights?: string[]
  recommendations?: string[]
  keyMetrics?: { label: string; value: string; change: string }[]
  strengths?: string[]
  opportunities?: string[]
  nextMonthFocus?: string
  insights?: string[]
  recommendation?: string
}
