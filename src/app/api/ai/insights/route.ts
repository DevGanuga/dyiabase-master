import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenAI, DYIA_MODEL_MINI } from '@/lib/openai/client'

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

    // Generate insight using OpenAI
    const insight = await generateInsight(type, businessData, userProfile.first_name || 'there')

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
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    )
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
    .select('*')
    .eq('user_id', userId)
    .gte('date', startOfMonth.toISOString().split('T')[0])

  // Get jobs for last month
  const { data: lastMonthJobs } = await supabase
    .from('dyia_jobs')
    .select('*')
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
  const jobs = thisMonthJobs || []
  const lastJobs = lastMonthJobs || []

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

async function generateInsight(
  type: InsightType,
  data: BusinessData,
  firstName: string
): Promise<InsightResult> {
  const openai = getOpenAI()

  const systemPrompt = `You are Dyia's business insights AI. Generate brief, actionable insights for a service business owner.

Guidelines:
- Be encouraging but honest
- Use specific numbers from the data
- Keep it concise (2-3 sentences for dashboard, 3-5 for detailed reports)
- Focus on what's actionable
- Use plain language, no jargon
- Format currency with $ and commas`

  const prompts: Record<InsightType, string> = {
    dashboard: `Generate a brief, personalized greeting insight for ${firstName}'s dashboard.

Business data:
- Revenue this month: $${data.revenueThisMonth.toLocaleString()}
- Revenue last month: $${data.revenueLastMonth.toLocaleString()}
- Profit this month: $${data.profitThisMonth.toLocaleString()} (${Math.round(data.profitMargin)}% margin)
- Jobs this month: ${data.jobCountThisMonth} (vs ${data.jobCountLastMonth} last month)
- Average job value: $${Math.round(data.avgJobValue).toLocaleString()}
- Pending follow-ups: ${data.pendingFollowUps}
- Top lead source: ${data.topSource}
- Monthly goal progress: ${Math.round(data.goalProgress)}% of $${data.monthlyGoal.toLocaleString()}

Return a JSON object with:
{
  "headline": "Brief headline (max 8 words)",
  "summary": "2-3 sentence personalized insight",
  "metric": { "label": "Key metric label", "value": "formatted value", "trend": "up" | "down" | "neutral" },
  "tip": "One actionable tip (max 15 words)"
}`,

    weekly: `Generate a weekly business insight summary for ${firstName}.

Business data:
- Revenue this month: $${data.revenueThisMonth.toLocaleString()}
- Revenue last month: $${data.revenueLastMonth.toLocaleString()}  
- Profit: $${data.profitThisMonth.toLocaleString()} (${Math.round(data.profitMargin)}% margin)
- Jobs: ${data.jobCountThisMonth} this month vs ${data.jobCountLastMonth} last month
- Avg job: $${Math.round(data.avgJobValue).toLocaleString()}
- Follow-ups pending: ${data.pendingFollowUps}
- Top source: ${data.topSource}

Return a JSON object with:
{
  "headline": "Weekly insight headline",
  "summary": "3-4 sentence analysis",
  "highlights": ["highlight 1", "highlight 2"],
  "recommendations": ["rec 1", "rec 2"]
}`,

    monthly: `Generate a monthly business report insight for ${firstName}.

Business data:
- Revenue: $${data.revenueThisMonth.toLocaleString()} (last month: $${data.revenueLastMonth.toLocaleString()})
- Profit: $${data.profitThisMonth.toLocaleString()} (${Math.round(data.profitMargin)}% margin)
- Jobs: ${data.jobCountThisMonth} (last month: ${data.jobCountLastMonth})
- Avg job value: $${Math.round(data.avgJobValue).toLocaleString()}
- Fixed overhead: $${Math.round(data.fixedExpenses).toLocaleString()}/mo
- Top source: ${data.topSource}
- Goal progress: ${Math.round(data.goalProgress)}%

Return a JSON object with:
{
  "headline": "Monthly report headline",
  "summary": "4-5 sentence detailed analysis",
  "keyMetrics": [{ "label": "metric", "value": "value", "change": "+X%" }],
  "strengths": ["strength 1"],
  "opportunities": ["opportunity 1"],
  "nextMonthFocus": "One key focus area"
}`,

    reports: `Generate an analytical insight for the reports page for ${firstName}.

Business data:
- Revenue this month: $${data.revenueThisMonth.toLocaleString()}
- Profit margin: ${Math.round(data.profitMargin)}%
- Jobs: ${data.jobCountThisMonth}
- Avg job value: $${Math.round(data.avgJobValue).toLocaleString()}
- Fixed expenses: $${Math.round(data.fixedExpenses).toLocaleString()}/mo
- Top source: ${data.topSource}

Return a JSON object with:
{
  "headline": "Analytical headline",
  "summary": "3-4 sentence analysis focusing on trends and patterns",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recommendation": "Key recommendation"
}`,
  }

  try {
    const response = await openai.chat.completions.create({
      model: DYIA_MODEL_MINI,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompts[type] },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content || '{}'
    return JSON.parse(content) as InsightResult
  } catch (error) {
    console.error('OpenAI insight generation error:', error)
    // Return fallback insight
    return {
      headline: 'Your Business at a Glance',
      summary: `You've generated $${data.revenueThisMonth.toLocaleString()} in revenue this month with ${data.jobCountThisMonth} jobs completed.`,
      tip: data.pendingFollowUps > 0 
        ? `You have ${data.pendingFollowUps} quotes waiting for follow-up.`
        : 'Keep up the great work!',
    }
  }
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
