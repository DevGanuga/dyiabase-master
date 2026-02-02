import { createClient } from '@supabase/supabase-js'
import type { DyiaFunctionName } from './functions'

// Create Supabase client with service role for server-side operations
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Result type for all handlers
export interface HandlerResult {
  success: boolean
  data?: Record<string, unknown>
  error?: string
  message: string
}

// =============================================
// HANDLER IMPLEMENTATIONS
// =============================================

async function createJob(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const jobDate = (args.date as string) || new Date().toISOString().split('T')[0]
    const revenue = args.revenue as number
    const labor = (args.labor as number) || 0
    const gas = (args.gas as number) || 0
    const dumpFee = (args.dump_fee as number) || 0
    const dumpsterRental = (args.dumpster_rental as number) || 0
    const additionalExpense = (args.additional_expense as number) || 0
    
    const { data, error } = await supabase
      .from('dyia_jobs')
      .insert({
        user_id: dyiaUserId,
        date: jobDate,
        customer_name: args.customer_name as string,
        source: (args.source as string) || null,
        revenue: revenue,
        labor: labor,
        gas: gas,
        dump_fee: dumpFee,
        dumpster_rental: dumpsterRental,
        additional_expense: additionalExpense,
        num_workers: (args.num_workers as number) || 1,
        cost_per_worker: (args.cost_per_worker as number) || 0,
        notes: (args.notes as string) || null
      })
      .select()
      .single()

    if (error) throw error

    const totalExpenses = labor + gas + dumpFee + dumpsterRental + additionalExpense
    const profit = revenue - totalExpenses
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

    return {
      success: true,
      data: { 
        jobId: data.id, 
        date: jobDate,
        customer: args.customer_name,
        revenue,
        expenses: totalExpenses,
        profit,
        margin
      },
      message: `✅ Job logged for ${args.customer_name}!\n\n💰 Revenue: $${revenue.toLocaleString()}\n📦 Expenses: $${totalExpenses.toLocaleString()}\n📈 Profit: $${profit.toLocaleString()} (${margin}% margin)`
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

async function generateQuote(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const estimateLow = args.estimate_low as number
    const estimateHigh = args.estimate_high as number
    const total = Math.round((estimateLow + estimateHigh) / 2)
    
    const { data, error } = await supabase
      .from('dyia_quotes')
      .insert({
        user_id: dyiaUserId,
        customer_name: args.customer_name as string,
        customer_phone: (args.customer_phone as string) || null,
        customer_email: (args.customer_email as string) || null,
        customer_address: (args.customer_address as string) || null,
        job_description: args.job_description as string,
        pricing: {},
        estimate_low: estimateLow,
        estimate_high: estimateHigh,
        total: total,
        status: 'draft',
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
      data: { 
        quoteId: data.id,
        customer: args.customer_name,
        estimate: `$${estimateLow.toLocaleString()} - $${estimateHigh.toLocaleString()}`,
        description: args.job_description
      },
      message: `✅ Quote created for ${args.customer_name}!\n\n📋 ${args.job_description}\n💵 Estimate: $${estimateLow.toLocaleString()} - $${estimateHigh.toLocaleString()}\n\n📍 A follow-up has been automatically scheduled.`
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

async function logExpense(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const amount = args.amount as number
    const frequency = args.frequency as 'monthly' | 'yearly'
    
    const { data, error } = await supabase
      .from('dyia_fixed_expenses')
      .insert({
        user_id: dyiaUserId,
        name: args.name as string,
        amount: amount,
        frequency: frequency,
        category: (args.category as string) || 'other',
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    const monthlyEquiv = frequency === 'yearly' ? amount / 12 : amount
    const yearlyEquiv = frequency === 'monthly' ? amount * 12 : amount

    return {
      success: true,
      data: { 
        expenseId: data.id,
        name: args.name,
        amount,
        frequency,
        monthlyEquivalent: monthlyEquiv
      },
      message: `✅ Fixed expense added: "${args.name}"\n\n💸 Amount: $${amount.toLocaleString()}/${frequency}\n📊 Monthly impact: $${Math.round(monthlyEquiv).toLocaleString()}/mo\n📅 Yearly total: $${Math.round(yearlyEquiv).toLocaleString()}/yr`
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

async function getPerformanceStats(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const period = (args.period as string) || 'this_month'
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
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0

    const periodLabel = {
      today: 'Today',
      this_week: 'This Week',
      this_month: 'This Month',
      last_month: 'Last Month',
      this_year: 'This Year',
      all_time: 'All Time'
    }[period] || 'This Month'

    return {
      success: true,
      data: {
        period: periodLabel,
        jobCount,
        totalRevenue,
        totalExpenses,
        netProfit,
        avgJobRevenue,
        profitMargin
      },
      message: `📊 **${periodLabel} Performance**\n\n🔢 Jobs: ${jobCount}\n💰 Revenue: $${totalRevenue.toLocaleString()}\n📦 Expenses: $${totalExpenses.toLocaleString()}\n📈 Net Profit: $${netProfit.toLocaleString()}\n📉 Margin: ${profitMargin}%\n💵 Avg/Job: $${Math.round(avgJobRevenue).toLocaleString()}`
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

async function getPendingFollowUps(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const limit = (args.limit as number) || 5
    const now = new Date()
    
    const { data: followUps, error } = await supabase
      .from('dyia_follow_ups')
      .select(`
        *,
        quote:dyia_quotes(*)
      `)
      .eq('user_id', dyiaUserId)
      .in('status', ['pending', 'contacted', 'snoozed'])
      .order('created_at', { ascending: true })
      .limit(limit * 2)

    if (error) throw error

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
        message: '✨ No pending follow-ups! You\'re all caught up.'
      }
    }

    const summaries = limited.map(fu => {
      const emoji = fu.priority === 'hot' ? '🔥' : fu.priority === 'warm' ? '🌡️' : '❄️'
      const phone = fu.quote?.customer_phone ? ` • ${fu.quote.customer_phone}` : ''
      return `${emoji} **${fu.quote?.customer_name}**${phone}\n   $${fu.quote?.estimate_low}-$${fu.quote?.estimate_high} • ${fu.daysSince}d ago`
    })

    return {
      success: true,
      data: { 
        followUps: limited.map(fu => ({
          id: fu.id,
          customerName: fu.quote?.customer_name,
          phone: fu.quote?.customer_phone,
          estimate: `$${fu.quote?.estimate_low}-$${fu.quote?.estimate_high}`,
          daysSince: fu.daysSince,
          priority: fu.priority
        }))
      },
      message: `📍 **${limited.length} Follow-ups Need Attention**\n\n${summaries.join('\n\n')}`
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

async function suggestQuotePrice(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
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

    const desc = (args.job_description as string).toLowerCase()
    const factors = (args.factors as string[]) || []
    let baseLow = prices.minimumFee || 75
    let baseHigh = prices.minimumFee || 75
    const appliedFactors: string[] = []

    // Analyze job description for pricing
    if (desc.includes('full') && (desc.includes('load') || desc.includes('truck'))) {
      baseLow = prices.fullLoad || 450
      baseHigh = baseLow * 1.2
      appliedFactors.push('Full load')
    } else if (desc.includes('3/4') || desc.includes('three quarter')) {
      baseLow = prices.threeQuarterLoad || 350
      baseHigh = baseLow * 1.2
      appliedFactors.push('3/4 load')
    } else if (desc.includes('half') || desc.includes('1/2')) {
      baseLow = prices.halfLoad || 250
      baseHigh = baseLow * 1.2
      appliedFactors.push('Half load')
    } else if (desc.includes('quarter') || desc.includes('1/4')) {
      baseLow = prices.quarterLoad || 150
      baseHigh = baseLow * 1.2
      appliedFactors.push('Quarter load')
    }

    // Check for specialty items
    if (desc.includes('hot tub') || desc.includes('hottub') || desc.includes('jacuzzi')) {
      baseLow += prices.surcharges?.hotTub || 200
      baseHigh += prices.surcharges?.hotTub || 200
      appliedFactors.push('Hot tub removal')
    }
    if (desc.includes('trampoline')) {
      baseLow += prices.surcharges?.trampoline || 100
      baseHigh += prices.surcharges?.trampoline || 100
      appliedFactors.push('Trampoline')
    }
    if (desc.includes('piano')) {
      baseLow += prices.surcharges?.piano || 150
      baseHigh += prices.surcharges?.piano || 150
      appliedFactors.push('Piano')
    }

    // Check for complexity
    if (desc.includes('garage') || desc.includes('basement') || desc.includes('attic') || desc.includes('cleanout')) {
      baseLow *= 1.2
      baseHigh *= 1.4
      appliedFactors.push('Full cleanout')
    }

    // Additional factors
    if (factors.includes('stairs') || desc.includes('stairs') || desc.includes('upstairs') || desc.includes('second floor')) {
      baseLow += 50
      baseHigh += 100
      appliedFactors.push('Stairs access')
    }
    if (factors.includes('long distance') || desc.includes('far') || desc.includes('distance')) {
      baseLow += 50
      baseHigh += 100
      appliedFactors.push('Distance surcharge')
    }
    if (desc.includes('commercial') || desc.includes('office') || desc.includes('business')) {
      baseLow *= 1.2
      baseHigh *= 1.3
      appliedFactors.push('Commercial job')
    }

    const suggestedLow = Math.round(baseLow)
    const suggestedHigh = Math.round(baseHigh)

    return {
      success: true,
      data: {
        suggestedLow,
        suggestedHigh,
        factors: appliedFactors
      },
      message: `💰 **Suggested Price Range**\n\n**$${suggestedLow.toLocaleString()} - $${suggestedHigh.toLocaleString()}**\n\n${appliedFactors.length > 0 ? `📋 Factors considered:\n• ${appliedFactors.join('\n• ')}\n\n` : ''}💡 Adjust based on specific job conditions, customer budget, and your availability.`
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

async function updateFollowUpStatus(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const followUpId = args.follow_up_id as string
    const status = args.status as string
    const notes = args.notes as string
    const snoozeUntil = args.snooze_until as string

    const updateData: Record<string, unknown> = {
      status,
      notes: notes || null
    }

    if (status === 'contacted') {
      updateData.last_contacted_at = new Date().toISOString()
      // Fetch current contact count and increment manually
      const { data: current } = await supabase
        .from('dyia_follow_ups')
        .select('contact_count')
        .eq('id', followUpId)
        .eq('user_id', dyiaUserId)
        .single()
      updateData.contact_count = ((current?.contact_count as number) || 0) + 1
    }

    if (status === 'snoozed' && snoozeUntil) {
      updateData.next_follow_up_at = snoozeUntil
    }

    const { error } = await supabase
      .from('dyia_follow_ups')
      .update(updateData)
      .eq('id', followUpId)
      .eq('user_id', dyiaUserId)

    if (error) throw error

    // When converted, create a job from the quote and mark quote as accepted
    if (status === 'converted') {
      // Look up the quote via the follow-up
      const { data: followUpData } = await supabase
        .from('dyia_follow_ups')
        .select('quote_id')
        .eq('id', followUpId)
        .single()

      if (followUpData?.quote_id) {
        const { data: quoteData } = await supabase
          .from('dyia_quotes')
          .select('*')
          .eq('id', followUpData.quote_id)
          .single()

        if (quoteData) {
          const avgEstimate = Math.round(((parseFloat(quoteData.estimate_low) || 0) + (parseFloat(quoteData.estimate_high) || 0)) / 2)
          const { data: newJob } = await supabase
            .from('dyia_jobs')
            .insert({
              user_id: dyiaUserId,
              date: new Date().toISOString().split('T')[0],
              customer_name: quoteData.customer_name,
              source: 'Quote',
              revenue: avgEstimate,
              labor: 0,
              gas: 0,
              dump_fee: 0,
              dumpster_rental: 0,
              additional_expense: 0,
              num_workers: 1,
              cost_per_worker: 0,
              notes: quoteData.job_description || null,
            })
            .select()
            .single()

          if (newJob) {
            await supabase
              .from('dyia_quotes')
              .update({ job_id: newJob.id, status: 'accepted' })
              .eq('id', followUpData.quote_id)
          }
        }
      }
    }

    const statusEmoji = {
      contacted: '📞',
      converted: '🎉',
      lost: '❌',
      snoozed: '⏰'
    }[status] || '✅'

    const statusMessage = {
      contacted: 'marked as contacted',
      converted: 'converted to a job! Nice work!',
      lost: 'marked as lost',
      snoozed: `snoozed until ${snoozeUntil}`
    }[status] || 'updated'

    return {
      success: true,
      data: { followUpId, status },
      message: `${statusEmoji} Follow-up ${statusMessage}${notes ? `\n\n📝 Notes: ${notes}` : ''}`
    }
  } catch (error) {
    console.error('Error updating follow-up:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to update follow-up. Please try again.'
    }
  }
}

async function convertQuoteToJob(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const quoteId = args.quote_id as string
    const jobDate = (args.date as string) || new Date().toISOString().split('T')[0]

    // Fetch the quote
    const { data: quote, error: quoteError } = await supabase
      .from('dyia_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('user_id', dyiaUserId)
      .single()

    if (quoteError || !quote) {
      return { success: false, error: 'Quote not found', message: 'Could not find that quote. Please check the ID and try again.' }
    }

    const avgEstimate = Math.round(((parseFloat(quote.estimate_low) || 0) + (parseFloat(quote.estimate_high) || 0)) / 2)
    const revenue = (args.revenue as number) || avgEstimate

    // Create the job
    const { data: job, error: jobError } = await supabase
      .from('dyia_jobs')
      .insert({
        user_id: dyiaUserId,
        date: jobDate,
        customer_name: quote.customer_name,
        source: 'Quote',
        revenue,
        labor: 0,
        gas: 0,
        dump_fee: 0,
        dumpster_rental: 0,
        additional_expense: 0,
        num_workers: 1,
        cost_per_worker: 0,
        notes: quote.job_description || null,
      })
      .select()
      .single()

    if (jobError) throw jobError

    // Link the quote to the job and mark accepted
    await supabase
      .from('dyia_quotes')
      .update({ job_id: job.id, status: 'accepted' })
      .eq('id', quoteId)

    // Also mark any follow-up as converted
    await supabase
      .from('dyia_follow_ups')
      .update({ status: 'converted' })
      .eq('quote_id', quoteId)
      .eq('user_id', dyiaUserId)

    return {
      success: true,
      data: { jobId: job.id, quoteId, customer: quote.customer_name, revenue },
      message: `✅ Quote for ${quote.customer_name} converted to a job!\n\n💰 Revenue: $${revenue.toLocaleString()}\n📅 Date: ${jobDate}\n🔗 Quote is now linked to the new job.`
    }
  } catch (error) {
    console.error('Error converting quote to job:', error)
    return { success: false, error: String(error), message: 'Failed to convert quote to job. Please try again.' }
  }
}

async function getBusinessSummary(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const period = args.period as string
    const now = new Date()
    let startDate: string
    let endDate: string = now.toISOString().split('T')[0]

    switch (period) {
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
      case 'this_quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
        startDate = quarterStart.toISOString().split('T')[0]
        break
      case 'this_year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    }

    // Get jobs
    const { data: jobs } = await supabase
      .from('dyia_jobs')
      .select('*')
      .eq('user_id', dyiaUserId)
      .gte('date', startDate)
      .lte('date', endDate)

    // Get fixed expenses
    const { data: expenses } = await supabase
      .from('dyia_fixed_expenses')
      .select('*')
      .eq('user_id', dyiaUserId)
      .eq('is_active', true)

    // Get pending follow-ups
    const { data: followUps } = await supabase
      .from('dyia_follow_ups')
      .select('*')
      .eq('user_id', dyiaUserId)
      .eq('status', 'pending')

    const jobCount = jobs?.length || 0
    const totalRevenue = jobs?.reduce((sum, j) => sum + (parseFloat(j.revenue) || 0), 0) || 0
    const jobExpenses = jobs?.reduce((sum, j) => 
      sum + (parseFloat(j.labor) || 0) + (parseFloat(j.gas) || 0) + 
      (parseFloat(j.dump_fee) || 0) + (parseFloat(j.dumpster_rental) || 0) + 
      (parseFloat(j.additional_expense) || 0), 0) || 0

    const monthlyFixed = expenses?.reduce((sum, e) => {
      const monthly = e.frequency === 'yearly' ? parseFloat(e.amount) / 12 : parseFloat(e.amount)
      return sum + monthly
    }, 0) || 0

    const totalExpenses = jobExpenses + monthlyFixed
    const netProfit = totalRevenue - totalExpenses

    // Top sources
    const sources: Record<string, number> = {}
    jobs?.forEach(job => {
      if (job.source) {
        sources[job.source] = (sources[job.source] || 0) + 1
      }
    })
    const topSources = Object.entries(sources)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)

    const periodLabel = {
      this_week: 'This Week',
      this_month: 'This Month',
      last_month: 'Last Month',
      this_quarter: 'This Quarter',
      this_year: 'This Year'
    }[period] || period

    let summary = `📊 **${periodLabel} Business Summary**\n\n`
    summary += `**Revenue & Profit**\n`
    summary += `• Jobs: ${jobCount}\n`
    summary += `• Revenue: $${totalRevenue.toLocaleString()}\n`
    summary += `• Job Expenses: $${jobExpenses.toLocaleString()}\n`
    summary += `• Fixed Overhead: $${Math.round(monthlyFixed).toLocaleString()}\n`
    summary += `• Net Profit: $${netProfit.toLocaleString()}\n\n`

    if (topSources.length > 0) {
      summary += `**Top Lead Sources**\n`
      topSources.forEach(([source, count]) => {
        summary += `• ${source}: ${count} jobs\n`
      })
      summary += '\n'
    }

    summary += `**Action Items**\n`
    summary += `• Pending follow-ups: ${followUps?.length || 0}\n`

    return {
      success: true,
      data: {
        period: periodLabel,
        jobCount,
        totalRevenue,
        totalExpenses,
        netProfit,
        topSources,
        pendingFollowUps: followUps?.length || 0
      },
      message: summary
    }
  } catch (error) {
    console.error('Error getting business summary:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to get business summary. Please try again.'
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
  const supabase = getSupabase()
  
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
      return createJob(args, dyiaUserId)
    
    case 'generate_quote':
      return generateQuote(args, dyiaUserId)
    
    case 'log_expense':
      return logExpense(args, dyiaUserId)
    
    case 'get_performance_stats':
      return getPerformanceStats(args, dyiaUserId)
    
    case 'get_pending_follow_ups':
      return getPendingFollowUps(args, dyiaUserId)
    
    case 'suggest_quote_price':
      return suggestQuotePrice(args, dyiaUserId)
    
    case 'update_follow_up_status':
      return updateFollowUpStatus(args, dyiaUserId)

    case 'convert_quote_to_job':
      return convertQuoteToJob(args, dyiaUserId)

    case 'get_business_summary':
      return getBusinessSummary(args, dyiaUserId)
    
    default:
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
        message: `I don't know how to handle that action yet.`
      }
  }
}
