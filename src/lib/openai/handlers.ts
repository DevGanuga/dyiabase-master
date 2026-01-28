import { createClient } from '@supabase/supabase-js'
import type { DyiaFunctionName } from './functions'

// Create Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Type definitions for function arguments
interface CreateJobArgs {
  date?: string
  customerName: string
  source?: string
  revenue: number
  labor?: number
  gas?: number
  dumpFee?: number
  dumpsterRental?: number
  additionalExpense?: number
  numWorkers?: number
  costPerWorker?: number
  notes?: string
}

interface GenerateQuoteArgs {
  customerName: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  jobDescription: string
  estimateLow: number
  estimateHigh: number
}

interface LogExpenseArgs {
  name: string
  amount: number
  frequency: 'monthly' | 'yearly'
  category?: string
}

interface GetPerformanceStatsArgs {
  period?: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all_time'
}

interface GetPendingFollowUpsArgs {
  priority?: 'hot' | 'warm' | 'cold' | 'all'
  limit?: number
}

interface SuggestQuotePriceArgs {
  jobDescription: string
  factors?: string[]
}

// Result type for all handlers
interface HandlerResult {
  success: boolean
  data?: unknown
  error?: string
  message: string
}

// =============================================
// HANDLER IMPLEMENTATIONS
// =============================================

async function createJob(args: CreateJobArgs, dyiaUserId: string): Promise<HandlerResult> {
  try {
    const jobDate = args.date || new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('dyia_jobs')
      .insert({
        user_id: dyiaUserId,
        date: jobDate,
        customer_name: args.customerName,
        source: args.source || null,
        revenue: args.revenue,
        labor: args.labor || 0,
        gas: args.gas || 0,
        dump_fee: args.dumpFee || 0,
        dumpster_rental: args.dumpsterRental || 0,
        additional_expense: args.additionalExpense || 0,
        num_workers: args.numWorkers || 1,
        cost_per_worker: args.costPerWorker || 0,
        notes: args.notes || null
      })
      .select()
      .single()

    if (error) throw error

    const totalExpenses = (args.labor || 0) + (args.gas || 0) + (args.dumpFee || 0) + 
                          (args.dumpsterRental || 0) + (args.additionalExpense || 0)
    const profit = args.revenue - totalExpenses

    return {
      success: true,
      data: { jobId: data.id, date: jobDate },
      message: `Job logged for ${args.customerName}. Revenue: $${args.revenue.toLocaleString()}, Expenses: $${totalExpenses.toLocaleString()}, Profit: $${profit.toLocaleString()}`
    }
  } catch (error) {
    console.error('Error creating job:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to create job. Please try again.'
    }
  }
}

async function generateQuote(args: GenerateQuoteArgs, dyiaUserId: string): Promise<HandlerResult> {
  try {
    const total = Math.round((args.estimateLow + args.estimateHigh) / 2)
    
    const { data, error } = await supabase
      .from('dyia_quotes')
      .insert({
        user_id: dyiaUserId,
        customer_name: args.customerName,
        customer_phone: args.customerPhone || null,
        customer_email: args.customerEmail || null,
        customer_address: args.customerAddress || null,
        job_description: args.jobDescription,
        pricing: {},
        estimate_low: args.estimateLow,
        estimate_high: args.estimateHigh,
        total: total,
        photo_urls: []
      })
      .select()
      .single()

    if (error) throw error

    // Auto-create a follow-up for this quote
    await supabase
      .from('dyia_follow_ups')
      .insert({
        user_id: dyiaUserId,
        quote_id: data.id,
        status: 'pending',
        contact_count: 0
      })

    return {
      success: true,
      data: { quoteId: data.id },
      message: `Quote created for ${args.customerName}. Estimate: $${args.estimateLow.toLocaleString()} - $${args.estimateHigh.toLocaleString()} for "${args.jobDescription}"`
    }
  } catch (error) {
    console.error('Error generating quote:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to create quote. Please try again.'
    }
  }
}

async function logExpense(args: LogExpenseArgs, dyiaUserId: string): Promise<HandlerResult> {
  try {
    const { data, error } = await supabase
      .from('dyia_fixed_expenses')
      .insert({
        user_id: dyiaUserId,
        name: args.name,
        amount: args.amount,
        frequency: args.frequency,
        category: args.category || 'other',
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    const monthlyEquiv = args.frequency === 'yearly' ? args.amount / 12 : args.amount

    return {
      success: true,
      data: { expenseId: data.id },
      message: `Fixed expense "${args.name}" added: $${args.amount.toLocaleString()}/${args.frequency} (≈$${Math.round(monthlyEquiv).toLocaleString()}/month)`
    }
  } catch (error) {
    console.error('Error logging expense:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to log expense. Please try again.'
    }
  }
}

async function getPerformanceStats(args: GetPerformanceStatsArgs, dyiaUserId: string): Promise<HandlerResult> {
  try {
    const period = args.period || 'this_month'
    let startDate: string
    let endDate: string = new Date().toISOString().split('T')[0]

    const now = new Date()
    switch (period) {
      case 'today':
        startDate = endDate
        break
      case 'this_week':
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        startDate = weekStart.toISOString().split('T')[0]
        break
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        break
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]
        break
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
        break
      case 'all_time':
        startDate = '2000-01-01'
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    }

    const { data: jobs, error } = await supabase
      .from('dyia_jobs')
      .select('*')
      .eq('user_id', dyiaUserId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) throw error

    const jobCount = jobs?.length || 0
    const totalRevenue = jobs?.reduce((sum, j) => sum + (parseFloat(j.revenue) || 0), 0) || 0
    const totalExpenses = jobs?.reduce((sum, j) => 
      sum + (parseFloat(j.labor) || 0) + (parseFloat(j.gas) || 0) + 
      (parseFloat(j.dump_fee) || 0) + (parseFloat(j.dumpster_rental) || 0) + 
      (parseFloat(j.additional_expense) || 0), 0) || 0
    const netProfit = totalRevenue - totalExpenses
    const avgJobRevenue = jobCount > 0 ? totalRevenue / jobCount : 0

    const periodLabel = {
      today: 'Today',
      this_week: 'This Week',
      this_month: 'This Month',
      last_month: 'Last Month',
      this_year: 'This Year',
      all_time: 'All Time'
    }[period]

    return {
      success: true,
      data: {
        period: periodLabel,
        jobCount,
        totalRevenue,
        totalExpenses,
        netProfit,
        avgJobRevenue
      },
      message: `${periodLabel} Stats: ${jobCount} jobs, $${totalRevenue.toLocaleString()} revenue, $${netProfit.toLocaleString()} profit, $${Math.round(avgJobRevenue).toLocaleString()} avg per job`
    }
  } catch (error) {
    console.error('Error getting stats:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to get performance stats. Please try again.'
    }
  }
}

async function getPendingFollowUps(args: GetPendingFollowUpsArgs, dyiaUserId: string): Promise<HandlerResult> {
  try {
    const limit = args.limit || 5
    const now = new Date()
    
    // Get follow-ups with quote info
    const { data: followUps, error } = await supabase
      .from('dyia_follow_ups')
      .select(`
        *,
        quote:dyia_quotes(*)
      `)
      .eq('user_id', dyiaUserId)
      .in('status', ['pending', 'contacted', 'snoozed'])
      .order('created_at', { ascending: true })
      .limit(limit * 2) // Get extra to filter by priority

    if (error) throw error

    // Calculate priority and filter
    const withPriority = (followUps || []).map(fu => {
      const quoteDate = new Date(fu.quote?.created_at || fu.created_at)
      const daysSince = Math.floor((now.getTime() - quoteDate.getTime()) / (1000 * 60 * 60 * 24))
      const priority: 'hot' | 'warm' | 'cold' = daysSince <= 3 ? 'hot' : daysSince <= 7 ? 'warm' : 'cold'
      return { ...fu, daysSince, priority }
    })

    const filtered = args.priority && args.priority !== 'all'
      ? withPriority.filter(fu => fu.priority === args.priority)
      : withPriority

    const limited = filtered.slice(0, limit)

    if (limited.length === 0) {
      return {
        success: true,
        data: { followUps: [] },
        message: 'No pending follow-ups found. Great job staying on top of things!'
      }
    }

    const summaries = limited.map(fu => {
      const emoji = fu.priority === 'hot' ? '🔥' : fu.priority === 'warm' ? '🌡️' : '❄️'
      return `${emoji} ${fu.quote?.customer_name || 'Unknown'} - $${fu.quote?.estimate_low}-$${fu.quote?.estimate_high} (${fu.daysSince}d ago)`
    })

    return {
      success: true,
      data: { 
        followUps: limited.map(fu => ({
          id: fu.id,
          customerName: fu.quote?.customer_name,
          phone: fu.quote?.customer_phone,
          estimateRange: `$${fu.quote?.estimate_low}-$${fu.quote?.estimate_high}`,
          daysSince: fu.daysSince,
          priority: fu.priority
        }))
      },
      message: `${limited.length} follow-ups need attention:\n${summaries.join('\n')}`
    }
  } catch (error) {
    console.error('Error getting follow-ups:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to get follow-ups. Please try again.'
    }
  }
}

async function suggestQuotePrice(args: SuggestQuotePriceArgs, dyiaUserId: string): Promise<HandlerResult> {
  try {
    // Get user's default price template
    const { data: template } = await supabase
      .from('dyia_price_templates')
      .select('prices')
      .eq('user_id', dyiaUserId)
      .eq('is_default', true)
      .single()

    const prices = template?.prices || {
      minimumFee: 75,
      quarterLoad: 150,
      halfLoad: 250,
      threeQuarterLoad: 350,
      fullLoad: 450,
      laborPerHour: 50,
      surcharges: { trampoline: 100, hotTub: 200, piano: 150 }
    }

    const desc = args.jobDescription.toLowerCase()
    let baseLow = prices.minimumFee || 75
    let baseHigh = prices.minimumFee || 75
    const factors: string[] = []

    // Analyze job description for pricing
    if (desc.includes('full') && desc.includes('load')) {
      baseLow = prices.fullLoad || 450
      baseHigh = baseLow * 1.2
      factors.push('Full load')
    } else if (desc.includes('half') || desc.includes('1/2')) {
      baseLow = prices.halfLoad || 250
      baseHigh = baseLow * 1.2
      factors.push('Half load')
    } else if (desc.includes('quarter') || desc.includes('1/4')) {
      baseLow = prices.quarterLoad || 150
      baseHigh = baseLow * 1.2
      factors.push('Quarter load')
    }

    // Check for specialty items
    if (desc.includes('hot tub') || desc.includes('hottub')) {
      baseLow += prices.surcharges?.hotTub || 200
      baseHigh += prices.surcharges?.hotTub || 200
      factors.push('Hot tub removal')
    }
    if (desc.includes('trampoline')) {
      baseLow += prices.surcharges?.trampoline || 100
      baseHigh += prices.surcharges?.trampoline || 100
      factors.push('Trampoline')
    }
    if (desc.includes('piano')) {
      baseLow += prices.surcharges?.piano || 150
      baseHigh += prices.surcharges?.piano || 150
      factors.push('Piano')
    }

    // Check for complexity factors
    if (desc.includes('garage') || desc.includes('basement') || desc.includes('attic')) {
      baseLow *= 1.1
      baseHigh *= 1.3
      factors.push('Full cleanout')
    }

    // Additional factors from args
    if (args.factors?.includes('stairs')) {
      baseLow += 50
      baseHigh += 100
      factors.push('Stairs access')
    }
    if (args.factors?.includes('long distance') || args.factors?.includes('far')) {
      baseLow += 50
      baseHigh += 100
      factors.push('Distance surcharge')
    }

    const suggestedLow = Math.round(baseLow)
    const suggestedHigh = Math.round(baseHigh)

    return {
      success: true,
      data: {
        suggestedLow,
        suggestedHigh,
        factors
      },
      message: `Suggested price range: $${suggestedLow.toLocaleString()} - $${suggestedHigh.toLocaleString()}${factors.length > 0 ? `\n\nFactors: ${factors.join(', ')}` : ''}\n\nThis is based on your pricing template. Adjust based on the specific job conditions.`
    }
  } catch (error) {
    console.error('Error suggesting price:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to suggest price. Please try again.'
    }
  }
}

// =============================================
// MAIN HANDLER ROUTER
// =============================================

export async function handleFunctionCall(
  functionName: DyiaFunctionName,
  args: Record<string, unknown>,
  clerkUserId: string
): Promise<HandlerResult> {
  // First, get the dyia user ID from clerk user ID
  const { data: userData, error: userError } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (userError || !userData) {
    return {
      success: false,
      error: 'User not found',
      message: 'Unable to find your account. Please try again.'
    }
  }

  const dyiaUserId = userData.id

  // Route to appropriate handler
  switch (functionName) {
    case 'create_job':
      return createJob(args as unknown as CreateJobArgs, dyiaUserId)
    
    case 'generate_quote':
      return generateQuote(args as unknown as GenerateQuoteArgs, dyiaUserId)
    
    case 'log_expense':
      return logExpense(args as unknown as LogExpenseArgs, dyiaUserId)
    
    case 'get_performance_stats':
      return getPerformanceStats(args as unknown as GetPerformanceStatsArgs, dyiaUserId)
    
    case 'get_pending_follow_ups':
      return getPendingFollowUps(args as unknown as GetPendingFollowUpsArgs, dyiaUserId)
    
    case 'suggest_quote_price':
      return suggestQuotePrice(args as unknown as SuggestQuotePriceArgs, dyiaUserId)
    
    default:
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
        message: `I don't know how to handle that action yet.`
      }
  }
}
