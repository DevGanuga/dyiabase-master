import { createClient } from '@supabase/supabase-js'
import type { DyiaFunctionName } from './functions'
import type { JobProposal, QuoteProposal, UserContext, ConfidenceLevel } from '@/types/database'
import { generateEmbedding, buildJobEmbeddingText } from './client'
import { ensureCustomer } from '@/lib/customers'

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
  // For proposal handlers, this indicates the action needs user confirmation
  pendingAction?: {
    type: 'create_job' | 'generate_quote' | 'log_expense'
    proposal: JobProposal | QuoteProposal | Record<string, unknown>
  }
}

// =============================================
// HANDLER IMPLEMENTATIONS
// =============================================

async function createJob(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const jobDate = (args.date as string) || new Date().toISOString().split('T')[0]
    const customerName = args.customer_name as string
    const source = (args.source as string) || null
    const notes = (args.notes as string) || null
    const revenue = args.revenue as number
    const labor = (args.labor as number) || 0
    const gas = (args.gas as number) || 0
    const dumpFee = (args.dump_fee as number) || 0
    const dumpsterRental = (args.dumpster_rental as number) || 0
    const additionalExpense = (args.additional_expense as number) || 0
    
    const address = (args.address as string) || null
    const status = (args.status as string) || 'completed'

    const customerId = (args.customer_id as string) || await ensureCustomer(supabase, dyiaUserId, customerName)

    const { data, error } = await supabase
      .from('dyia_jobs')
      .insert({
        user_id: dyiaUserId,
        customer_id: customerId,
        date: jobDate,
        customer_name: customerName,
        source: source,
        revenue: revenue,
        labor: labor,
        gas: gas,
        dump_fee: dumpFee,
        dumpster_rental: dumpsterRental,
        additional_expense: additionalExpense,
        num_workers: (args.num_workers as number) || 1,
        cost_per_worker: (args.cost_per_worker as number) || 0,
        notes: notes,
        address: address,
        status: status
      })
      .select()
      .single()

    if (error) throw error

    const totalExpenses = labor + gas + dumpFee + dumpsterRental + additionalExpense
    const profit = revenue - totalExpenses
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

    if (data) {
      const embeddingText = buildJobEmbeddingText({
        customerName: customerName,
        notes: notes,
        source: source,
        revenue: revenue
      })
      
      generateEmbedding(embeddingText)
        .then(async (embedding) => {
          const updateSupabase = getSupabase()
          const vectorString = `[${embedding.join(',')}]`
          await updateSupabase
            .from('dyia_jobs')
            .update({ 
              embedding: vectorString,
              embedding_text: embeddingText 
            })
            .eq('id', data.id)
        })
        .catch((err) => {
          console.error(`[Embedding] Failed to embed job ${data.id}:`, err)
        })
    }

    return {
      success: true,
      data: { 
        jobId: data.id,
        customerId,
        date: jobDate,
        customer: customerName,
        revenue,
        expenses: totalExpenses,
        profit,
        margin
      },
      message: `✅ Job logged for ${customerName}!\n\n💰 Revenue: $${revenue.toLocaleString()}\n📦 Expenses: $${totalExpenses.toLocaleString()}\n📈 Profit: $${profit.toLocaleString()} (${margin}% margin)`
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
    const customerName = args.customer_name as string

    const customerId = (args.customer_id as string) || await ensureCustomer(supabase, dyiaUserId, customerName, {
      phone: (args.customer_phone as string) || null,
      email: (args.customer_email as string) || null,
      address: (args.customer_address as string) || null,
    })
    
    const { data, error } = await supabase
      .from('dyia_quotes')
      .insert({
        user_id: dyiaUserId,
        customer_id: customerId,
        customer_name: customerName,
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

    await supabase
      .from('dyia_follow_ups')
      .insert({
        user_id: dyiaUserId,
        customer_id: customerId,
        quote_id: data.id,
        status: 'pending',
        contact_count: 0
      })

    return {
      success: true,
      data: { 
        quoteId: data.id,
        customerId,
        customer: customerName,
        estimate: `$${estimateLow.toLocaleString()} - $${estimateHigh.toLocaleString()}`,
        description: args.job_description
      },
      message: `✅ Quote created for ${customerName}!\n\n📋 ${args.job_description}\n💵 Estimate: $${estimateLow.toLocaleString()} - $${estimateHigh.toLocaleString()}\n\n📍 A follow-up has been automatically scheduled.`
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
        quote:dyia_quotes(*),
        customer:dyia_customers(id, name, phone, email, address)
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
      const name = fu.customer?.name || fu.quote?.customer_name
      const emoji = fu.priority === 'hot' ? '🔥' : fu.priority === 'warm' ? '🌡️' : '❄️'
      const phone = fu.customer?.phone || fu.quote?.customer_phone
      const phoneStr = phone ? ` • ${phone}` : ''
      return `${emoji} **${name}**${phoneStr}\n   $${fu.quote?.estimate_low}-$${fu.quote?.estimate_high} • ${fu.daysSince}d ago`
    })

    return {
      success: true,
      data: { 
        followUps: limited.map(fu => ({
          id: fu.id,
          customerId: fu.customer_id,
          customerName: fu.customer?.name || fu.quote?.customer_name,
          phone: fu.customer?.phone || fu.quote?.customer_phone,
          email: fu.customer?.email,
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
    const jobDescription = args.job_description as string
    const factors = (args.factors as string[]) || []
    const desc = jobDescription.toLowerCase()
    
    // =============================================
    // STEP 1: Try to find similar historical jobs first
    // =============================================
    const similarResult = await findSimilarJobs({ description: jobDescription, limit: 5 }, dyiaUserId)
    const similarJobs = (similarResult.data?.jobs || []) as Array<{ revenue: number; profit_margin: number; customer_name: string; date: string }>
    
    // If we have enough similar jobs (3+), use history-based pricing
    if (similarJobs.length >= 3) {
      const revenues = similarJobs.map(j => Number(j.revenue))
      const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length
      const minRevenue = Math.min(...revenues)
      const maxRevenue = Math.max(...revenues)
      const avgMargin = similarJobs.reduce((sum, j) => sum + Number(j.profit_margin), 0) / similarJobs.length
      
      // Calculate range based on historical data with some padding
      const historyLow = Math.round(minRevenue * 0.95)
      const historyHigh = Math.round(maxRevenue * 1.05)
      
      // Build example list
      const examples = similarJobs.slice(0, 3).map(j => 
        `• ${j.customer_name}: $${Number(j.revenue).toLocaleString()} - ${new Date(j.date).toLocaleDateString()}`
      ).join('\n')
      
      return {
        success: true,
        data: {
          suggestedLow: historyLow,
          suggestedHigh: historyHigh,
          avgRevenue: Math.round(avgRevenue),
          avgMargin: Math.round(avgMargin),
          similarJobs: similarJobs.length,
          pricingMethod: 'history'
        },
        message: `💰 **Based on Your History**\n\n**$${historyLow.toLocaleString()} - $${historyHigh.toLocaleString()}**\n\n📊 Found ${similarJobs.length} similar jobs:\n${examples}\n\n**Average:** $${Math.round(avgRevenue).toLocaleString()} at **${Math.round(avgMargin)}% margin**\n\n💡 Price based on your actual job history!`
      }
    }
    
    // =============================================
    // STEP 2: Fall back to template-based pricing
    // =============================================
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
    
    // Include a note about building history if we have some but not enough similar jobs
    const historyNote = similarJobs.length > 0 
      ? `\n\n📈 Found ${similarJobs.length} similar job${similarJobs.length === 1 ? '' : 's'} in your history. Log more jobs to get personalized pricing!`
      : '\n\n📈 Log more jobs to get pricing suggestions based on your actual history!'

    return {
      success: true,
      data: {
        suggestedLow,
        suggestedHigh,
        factors: appliedFactors,
        similarJobsFound: similarJobs.length,
        pricingMethod: 'template'
      },
      message: `💰 **Suggested Price Range**\n\n**$${suggestedLow.toLocaleString()} - $${suggestedHigh.toLocaleString()}**\n\n${appliedFactors.length > 0 ? `📋 Factors considered:\n• ${appliedFactors.join('\n• ')}\n\n` : ''}💡 Based on your pricing template.${historyNote}`
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
          const cid = quoteData.customer_id || await ensureCustomer(supabase, dyiaUserId, quoteData.customer_name)
          const { data: newJob } = await supabase
            .from('dyia_jobs')
            .insert({
              user_id: dyiaUserId,
              customer_id: cid,
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

    const customerId = quote.customer_id || await ensureCustomer(supabase, dyiaUserId, quote.customer_name)

    const { data: job, error: jobError } = await supabase
      .from('dyia_jobs')
      .insert({
        user_id: dyiaUserId,
        customer_id: customerId,
        date: jobDate,
        customer_name: quote.customer_name,
        source: quote.source || 'Quote',
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
// PROPOSAL HANDLERS (Return data for user confirmation)
// =============================================

async function proposeJob(args: Record<string, unknown>): Promise<HandlerResult> {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // ── Validate critical fields — if missing, tell the AI to ask for them ──
    const missingFields: string[] = []
    if (!args.customer_name || !(args.customer_name as string).trim()) missingFields.push('customer name')
    if (typeof args.revenue !== 'number' || args.revenue <= 0) missingFields.push('revenue amount')
    
    if (missingFields.length > 0) {
      return {
        success: false,
        message: `I need a few more details before I can log this job. Can you tell me the **${missingFields.join('** and **')}**?`,
        data: { missingFields },
      }
    }

    // Build confidence levels
    const confidence: Partial<Record<keyof Omit<JobProposal, 'confidence'>, ConfidenceLevel>> = {}
    confidence.date = args.date && args.date !== today ? 'high' : 'inferred'
    confidence.customerName = 'high'
    confidence.revenue = 'high'
    confidence.labor = typeof args.labor === 'number' && args.labor > 0 ? 'high' : 'inferred'
    confidence.gas = typeof args.gas === 'number' && args.gas > 0 ? 'high' : 'inferred'
    confidence.dumpFee = typeof args.dump_fee === 'number' && args.dump_fee > 0 ? 'high' : 'inferred'
    confidence.dumpsterRental = typeof args.dumpster_rental === 'number' && args.dumpster_rental > 0 ? 'high' : 'inferred'
    confidence.additionalExpense = typeof args.additional_expense === 'number' && args.additional_expense > 0 ? 'high' : 'inferred'
    confidence.numWorkers = typeof args.num_workers === 'number' && args.num_workers !== 1 ? 'high' : 'inferred'
    confidence.costPerWorker = typeof args.cost_per_worker === 'number' && args.cost_per_worker > 0 ? 'high' : 'inferred'
    confidence.source = args.source && args.source !== 'Unknown' ? 'high' : 'inferred'
    confidence.notes = args.notes && (args.notes as string).length > 5 ? 'high' : 'inferred'

    const proposal: JobProposal = {
      date: (args.date as string) || today,
      customerName: (args.customer_name as string).trim(),
      source: (args.source as string) || 'Unknown',
      revenue: args.revenue as number,
      labor: (args.labor as number) || 0,
      gas: (args.gas as number) || 0,
      dumpFee: (args.dump_fee as number) || 0,
      dumpsterRental: (args.dumpster_rental as number) || 0,
      additionalExpense: (args.additional_expense as number) || 0,
      numWorkers: (args.num_workers as number) || 1,
      costPerWorker: (args.cost_per_worker as number) || 0,
      notes: (args.notes as string) || '',
      confidence
    }

    const totalExpenses = proposal.labor + proposal.gas + proposal.dumpFee + 
                          proposal.dumpsterRental + proposal.additionalExpense +
                          (proposal.numWorkers * proposal.costPerWorker)
    const profit = proposal.revenue - totalExpenses
    const margin = proposal.revenue > 0 ? Math.round((profit / proposal.revenue) * 100) : 0

    return {
      success: true,
      data: { proposal, calculatedProfit: profit, calculatedMargin: margin, totalExpenses },
      message: `I've extracted the job details. Please review and confirm:`,
      pendingAction: { type: 'create_job', proposal }
    }
  } catch (error) {
    console.error('Error proposing job:', error)
    return { success: false, error: String(error), message: 'Failed to extract job details. Please try again.' }
  }
}

async function proposeQuote(args: Record<string, unknown>): Promise<HandlerResult> {
  try {
    // ── Validate critical fields ──
    const missingFields: string[] = []
    if (!args.customer_name || !(args.customer_name as string).trim()) missingFields.push('customer name')
    if (typeof args.estimate_low !== 'number' || args.estimate_low <= 0) missingFields.push('low end of the price range')
    if (typeof args.estimate_high !== 'number' || args.estimate_high <= 0) missingFields.push('high end of the price range')
    
    if (missingFields.length > 0) {
      return {
        success: false,
        message: `I need a few more details to create this quote. Can you tell me the **${missingFields.join('** and **')}**?`,
        data: { missingFields },
      }
    }

    // Build confidence levels
    const confidence: Partial<Record<keyof Omit<QuoteProposal, 'confidence'>, ConfidenceLevel>> = {}
    confidence.customerName = 'high'
    confidence.customerPhone = args.customer_phone && (args.customer_phone as string).length > 0 ? 'high' : 'inferred'
    confidence.customerEmail = args.customer_email && (args.customer_email as string).length > 0 ? 'high' : 'inferred'
    confidence.customerAddress = args.customer_address && (args.customer_address as string).length > 0 ? 'high' : 'inferred'
    confidence.jobDescription = args.job_description ? 'high' : 'medium'
    confidence.estimateLow = 'high'
    confidence.estimateHigh = 'high'

    const proposal: QuoteProposal = {
      customerName: (args.customer_name as string).trim(),
      customerPhone: (args.customer_phone as string) || '',
      customerEmail: (args.customer_email as string) || '',
      customerAddress: (args.customer_address as string) || '',
      jobDescription: (args.job_description as string) || '',
      estimateLow: args.estimate_low as number,
      estimateHigh: args.estimate_high as number,
      confidence
    }

    return {
      success: true,
      data: { proposal },
      message: `I've prepared the quote. Please review and confirm:`,
      pendingAction: { type: 'generate_quote', proposal }
    }
  } catch (error) {
    console.error('Error proposing quote:', error)
    return { success: false, error: String(error), message: 'Failed to extract quote details. Please try again.' }
  }
}

async function getUserContext(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const includeRecentJobs = Math.min(Math.max((args.include_recent_jobs as number) || 5, 0), 10)

    // Refresh user patterns in background (fire and forget)
    updateUserPatterns(dyiaUserId).catch(err => 
      console.error('[Patterns] Background update failed:', err)
    )

    // Get user profile for name
    const { data: userProfile } = await supabase
      .from('dyia_users')
      .select('first_name, last_name')
      .eq('id', dyiaUserId)
      .single()

    // Get user settings
    const { data: settings } = await supabase
      .from('dyia_settings')
      .select('*')
      .eq('user_id', dyiaUserId)
      .single()

    // Get default price template
    const { data: template } = await supabase
      .from('dyia_price_templates')
      .select('*')
      .eq('user_id', dyiaUserId)
      .eq('is_default', true)
      .single()

    // Get recent jobs
    const { data: jobs } = await supabase
      .from('dyia_jobs')
      .select('customer_name, revenue, date, source')
      .eq('user_id', dyiaUserId)
      .order('date', { ascending: false })
      .limit(includeRecentJobs)

    // Load cross-thread memories
    const { data: memories } = await supabase
      .from('dyia_user_memory')
      .select('category, content')
      .eq('user_id', dyiaUserId)
      .order('confidence', { ascending: false })
      .limit(30)

    // Get customer count
    const { count: customerCount } = await supabase
      .from('dyia_customers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dyiaUserId)

    // Get total pending follow-ups count
    const { count: pendingFollowUps } = await supabase
      .from('dyia_follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dyiaUserId)
      .in('status', ['pending', 'contacted'])

    // Get hot follow-ups count (quotes from last 3 days)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { count: hotFollowUps } = await supabase
      .from('dyia_follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dyiaUserId)
      .eq('status', 'pending')
      .gte('created_at', threeDaysAgo)

    // Determine missing fields that should be filled in
    const missingFields: string[] = []
    if (!settings?.business_name) missingFields.push('business_name')
    if (!settings?.business_phone) missingFields.push('business_phone')
    if (!settings?.business_email) missingFields.push('business_email')
    if (!settings?.business_address) missingFields.push('business_address')
    if (!settings?.tax_percentage) missingFields.push('tax_percentage')
    if (!settings?.monthly_goal) missingFields.push('monthly_goal')

    const userName = userProfile?.first_name || undefined

    // Extract metadata for AI personalization
    const metadata = settings?.metadata as Record<string, unknown> | null
    const businessType = (metadata?.business_type as string) || undefined
    const businessStage = (metadata?.business_stage as string) || undefined
    const biggestChallenge = (metadata?.biggest_challenge as string) || undefined
    const pricingPhilosophy = (metadata?.pricing_philosophy as string) || undefined
    const serviceArea = (metadata?.service_area as string) || undefined
    const yearsInBusiness = (metadata?.years_in_business as string) || undefined
    const weeklyJobCapacity = (metadata?.weekly_job_capacity as string) || undefined
    const averageJobRevenue = (metadata?.average_job_revenue as number) || undefined
    const marketingChannels = (metadata?.marketing_channels as string[]) || undefined
    const commonServices = (metadata?.common_services as string) || undefined

    const userContext: UserContext = {
      settings: {
        businessName: settings?.business_name || undefined,
        businessPhone: settings?.business_phone || undefined,
        businessEmail: settings?.business_email || undefined,
        businessAddress: settings?.business_address || undefined,
        taxPercentage: settings?.tax_percentage || 0,
        monthlyGoal: settings?.monthly_goal || 0
      },
      defaultPriceTemplate: template ? {
        id: template.id,
        name: template.name,
        isDefault: template.is_default,
        prices: template.prices
      } : undefined,
      recentJobs: (jobs || []).map(job => ({
        customerName: job.customer_name,
        revenue: parseFloat(job.revenue) || 0,
        date: job.date,
        source: job.source || undefined
      })),
      missingFields
    }

    // Build a friendly context message
    let contextMessage = ''
    
    // Personalized greeting
    if (userName) {
      contextMessage = `Hey ${userName}! `
    }
    
    // Business context summary
    if (userContext.settings.businessName) {
      contextMessage += `Here's the context for ${userContext.settings.businessName}:\n\n`
    } else {
      contextMessage += `Here's your business context:\n\n`
    }

    // Business profile context for AI personalization
    if (businessType) {
      const typeLabels: Record<string, string> = { junk_removal: 'Junk Removal', lawn_care: 'Lawn Care', cleaning: 'Cleaning', moving: 'Moving', handyman: 'Handyman' }
      contextMessage += `🏢 Business Type: ${typeLabels[businessType] || businessType}\n`
    }
    if (serviceArea) contextMessage += `📍 Service Area: ${serviceArea}\n`
    if (yearsInBusiness) contextMessage += `📅 Experience: ${yearsInBusiness} in business\n`
    if (businessStage) {
      const stageLabels: Record<string, string> = { starting: 'Just starting out', growing: 'Growing', established: 'Established' }
      contextMessage += `📈 Stage: ${stageLabels[businessStage] || businessStage}\n`
    }
    if (pricingPhilosophy) {
      const pricingLabels: Record<string, string> = { budget: 'Compete on price', value: 'Fair price, great service', premium: 'Premium service' }
      contextMessage += `💲 Pricing: ${pricingLabels[pricingPhilosophy] || pricingPhilosophy}\n`
    }
    if (biggestChallenge) {
      const challengeLabels: Record<string, string> = { getting_customers: 'Getting customers', pricing: 'Pricing right', time_management: 'Managing time', tracking_money: 'Tracking money', hiring: 'Hiring & team', marketing: 'Marketing' }
      contextMessage += `🎯 Focus: ${challengeLabels[biggestChallenge] || biggestChallenge}\n`
    }
    if (weeklyJobCapacity) contextMessage += `📋 Capacity: ~${weeklyJobCapacity} jobs/week\n`
    if (averageJobRevenue) contextMessage += `💵 Avg Job: $${averageJobRevenue}\n`
    if (commonServices) contextMessage += `🔧 Services: ${commonServices}\n`
    if (marketingChannels && marketingChannels.length > 0) contextMessage += `📣 Marketing: ${marketingChannels.join(', ')}\n`
    
    // Key stats
    if (userContext.settings.monthlyGoal > 0) {
      contextMessage += `\n🎯 Monthly Goal: $${userContext.settings.monthlyGoal.toLocaleString()}\n`
    }
    
    if (userContext.settings.taxPercentage > 0) {
      contextMessage += `💵 Tax Set-aside: ${userContext.settings.taxPercentage}%\n`
    }

    if (customerCount && customerCount > 0) {
      contextMessage += `👥 Customers: ${customerCount}\n`
    }

    if (userContext.recentJobs.length > 0) {
      const totalRecent = userContext.recentJobs.reduce((sum, j) => sum + j.revenue, 0)
      contextMessage += `📊 Recent Jobs: ${userContext.recentJobs.length} ($${totalRecent.toLocaleString()} revenue)\n`
    }

    // Follow-ups alert
    if ((pendingFollowUps || 0) > 0) {
      if ((hotFollowUps || 0) > 0) {
        contextMessage += `\n🔥 **${hotFollowUps} hot follow-ups** waiting (${pendingFollowUps} total pending)\n`
      } else {
        contextMessage += `\n📞 ${pendingFollowUps} pending follow-ups\n`
      }
    }

    // Cross-thread memories
    if (memories && memories.length > 0) {
      contextMessage += `\n🧠 **What I remember about you:**\n`
      for (const mem of memories) {
        contextMessage += `• [${mem.category}] ${mem.content}\n`
      }
    }

    // Missing info note
    if (missingFields.length > 0) {
      const friendlyFields = missingFields.map(f => f.replace(/_/g, ' ')).slice(0, 2)
      contextMessage += `\n💡 Tip: Add your ${friendlyFields.join(' and ')} to personalize quotes.`
    }

    return {
      success: true,
      data: { 
        context: userContext,
        userName,
        pendingFollowUps: pendingFollowUps || 0,
        hotFollowUps: hotFollowUps || 0
      },
      message: contextMessage
    }
  } catch (error) {
    console.error('Error getting user context:', error)
    return {
      success: false,
      error: String(error),
      message: 'Failed to load your business context.'
    }
  }
}

// =============================================
// SIMILARITY SEARCH HANDLER
// =============================================

async function findSimilarJobs(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const description = args.description as string
    const limit = Math.min(Math.max((args.limit as number) || 5, 1), 10)
    
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(description)
    
    // Format embedding as vector string for pgvector: '[0.1, 0.2, ...]'
    const vectorString = `[${queryEmbedding.join(',')}]`
    
    // Similarity search using pgvector's match_jobs function
    const { data: similarJobs, error } = await supabase.rpc('match_jobs', {
      query_embedding: vectorString,
      match_user_id: dyiaUserId,
      match_count: limit,
      match_threshold: 0.5 // Lower threshold to get more results
    })
    
    if (error) {
      console.error('Similarity search error:', error)
      // Fall back to keyword-based search if vector search fails
      const { data: fallbackJobs } = await supabase
        .from('dyia_jobs')
        .select('id, customer_name, notes, revenue, labor, gas, dump_fee, dumpster_rental, additional_expense, date, source')
        .eq('user_id', dyiaUserId)
        .ilike('notes', `%${description.split(' ')[0]}%`)
        .order('date', { ascending: false })
        .limit(limit)
      
      if (!fallbackJobs?.length) {
        return {
          success: true,
          data: { jobs: [], avgRevenue: 0, avgMargin: 0, searchMethod: 'fallback' },
          message: `No similar jobs found for "${description}". As you log more jobs, I'll be able to give you better suggestions based on your history.`
        }
      }
      
      const jobsWithMargin = fallbackJobs.map(j => {
        const expenses = (j.labor || 0) + (j.gas || 0) + (j.dump_fee || 0) + (j.dumpster_rental || 0) + (j.additional_expense || 0)
        const margin = j.revenue > 0 ? ((j.revenue - expenses) / j.revenue * 100) : 0
        return { ...j, profit_margin: margin, similarity: 0.5 }
      })
      
      const avgRevenue = jobsWithMargin.reduce((sum, j) => sum + j.revenue, 0) / jobsWithMargin.length
      const avgMargin = jobsWithMargin.reduce((sum, j) => sum + j.profit_margin, 0) / jobsWithMargin.length
      
      return {
        success: true,
        data: { jobs: jobsWithMargin, avgRevenue, avgMargin, searchMethod: 'keyword' },
        message: `Found ${jobsWithMargin.length} potentially similar jobs. Average revenue: **$${avgRevenue.toFixed(0)}**, Average margin: **${avgMargin.toFixed(0)}%**`
      }
    }
    
    if (!similarJobs?.length) {
      return {
        success: true,
        data: { jobs: [], avgRevenue: 0, avgMargin: 0, searchMethod: 'vector' },
        message: `No similar jobs found for "${description}". As you log more jobs with detailed notes, I'll be able to find better matches.`
      }
    }
    
    const avgRevenue = similarJobs.reduce((sum: number, j: { revenue: number }) => sum + Number(j.revenue), 0) / similarJobs.length
    const avgMargin = similarJobs.reduce((sum: number, j: { profit_margin: number }) => sum + Number(j.profit_margin), 0) / similarJobs.length
    
    // Build a nice response message
    const jobList = similarJobs.slice(0, 3).map((j: { customer_name: string; revenue: number; profit_margin: number; date: string }) => 
      `• ${j.customer_name}: $${Number(j.revenue).toLocaleString()} (${Number(j.profit_margin).toFixed(0)}% margin) - ${new Date(j.date).toLocaleDateString()}`
    ).join('\n')
    
    return {
      success: true,
      data: { jobs: similarJobs, avgRevenue, avgMargin, searchMethod: 'vector' },
      message: `Found **${similarJobs.length} similar jobs** 📊\n\n**Average revenue:** $${avgRevenue.toFixed(0)}\n**Average margin:** ${avgMargin.toFixed(0)}%\n\nTop matches:\n${jobList}`
    }
  } catch (error) {
    console.error('Error finding similar jobs:', error)
    return {
      success: false,
      error: String(error),
      message: 'Had trouble searching your job history. Try describing the job differently.'
    }
  }
}

// =============================================
// USER PATTERN CACHING (Internal Helper)
// =============================================

/**
 * Calculate and cache user patterns for faster lookups
 * Called internally when fetching context or on demand
 */
async function updateUserPatterns(dyiaUserId: string): Promise<void> {
  const supabase = getSupabase()
  
  try {
    // Get all user jobs from last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    const { data: jobs } = await supabase
      .from('dyia_jobs')
      .select('*')
      .eq('user_id', dyiaUserId)
      .gte('date', sixMonthsAgo.toISOString().split('T')[0])
    
    if (!jobs || jobs.length < 5) return // Not enough data
    
    // Calculate pricing patterns by source
    const sourceStats: Record<string, { count: number; totalRevenue: number; totalProfit: number }> = {}
    
    for (const job of jobs) {
      const source = job.source || 'Unknown'
      const revenue = Number(job.revenue) || 0
      const expenses = (Number(job.labor) || 0) + (Number(job.gas) || 0) + 
                       (Number(job.dump_fee) || 0) + (Number(job.dumpster_rental) || 0) + 
                       (Number(job.additional_expense) || 0)
      const profit = revenue - expenses
      
      if (!sourceStats[source]) {
        sourceStats[source] = { count: 0, totalRevenue: 0, totalProfit: 0 }
      }
      sourceStats[source].count++
      sourceStats[source].totalRevenue += revenue
      sourceStats[source].totalProfit += profit
    }
    
    // Calculate averages
    const pricingPatterns = Object.entries(sourceStats).map(([source, stats]) => ({
      source,
      jobCount: stats.count,
      avgRevenue: Math.round(stats.totalRevenue / stats.count),
      avgProfit: Math.round(stats.totalProfit / stats.count),
      avgMargin: Math.round((stats.totalProfit / stats.totalRevenue) * 100)
    })).sort((a, b) => b.jobCount - a.jobCount)
    
    // Calculate overall stats
    const totalRevenue = jobs.reduce((sum, j) => sum + (Number(j.revenue) || 0), 0)
    const avgJobRevenue = Math.round(totalRevenue / jobs.length)
    
    // Store pricing patterns
    await supabase
      .from('dyia_user_patterns')
      .upsert({
        user_id: dyiaUserId,
        pattern_type: 'pricing',
        pattern_data: {
          avgJobRevenue,
          totalJobs: jobs.length,
          bySource: pricingPatterns,
          lastUpdated: new Date().toISOString()
        },
        calculated_at: new Date().toISOString()
      }, { onConflict: 'user_id,pattern_type' })
    
    // Get follow-up data for conversion patterns
    const { data: followUps } = await supabase
      .from('dyia_follow_ups')
      .select('status, created_at, updated_at, contact_count')
      .eq('user_id', dyiaUserId)
    
    if (followUps && followUps.length >= 5) {
      const converted = followUps.filter(f => f.status === 'converted')
      const lost = followUps.filter(f => f.status === 'lost')
      const total = converted.length + lost.length
      
      const conversionPatterns = {
        conversionRate: total > 0 ? Math.round((converted.length / total) * 100) : 30,
        avgDaysToConvert: converted.length > 0 
          ? Math.round(converted.reduce((sum, f) => {
              const days = (new Date(f.updated_at).getTime() - new Date(f.created_at).getTime()) / (1000 * 60 * 60 * 24)
              return sum + days
            }, 0) / converted.length)
          : 5,
        avgContactsToConvert: converted.length > 0
          ? Math.round(converted.reduce((sum, f) => sum + (f.contact_count || 1), 0) / converted.length * 10) / 10
          : 2,
        totalConverted: converted.length,
        totalLost: lost.length,
        lastUpdated: new Date().toISOString()
      }
      
      await supabase
        .from('dyia_user_patterns')
        .upsert({
          user_id: dyiaUserId,
          pattern_type: 'conversions',
          pattern_data: conversionPatterns,
          calculated_at: new Date().toISOString()
        }, { onConflict: 'user_id,pattern_type' })
    }
  } catch (error) {
    console.error(`[Patterns] Failed to update patterns for user ${dyiaUserId}:`, error)
  }
}

// =============================================
// REVENUE FORECASTING HANDLER
// =============================================

async function getRevenueForecast(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const period = args.period as 'this_week' | 'this_month' | 'next_week' | 'next_month'
    const now = new Date()
    
    // Calculate date ranges for historical analysis
    const getWeekStart = (date: Date) => {
      const d = new Date(date)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      return new Date(d.setDate(diff))
    }
    
    const thisWeekStart = getWeekStart(now)
    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)
    const twoWeeksAgoStart = new Date(lastWeekStart)
    twoWeeksAgoStart.setDate(twoWeeksAgoStart.getDate() - 7)
    
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0)
    
    // Fetch historical job data (last 3 months)
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const { data: historicalJobs } = await supabase
      .from('dyia_jobs')
      .select('date, revenue')
      .eq('user_id', dyiaUserId)
      .gte('date', threeMonthsAgo.toISOString().split('T')[0])
      .order('date', { ascending: true })
    
    if (!historicalJobs || historicalJobs.length < 5) {
      return {
        success: true,
        data: { insufficient_data: true },
        message: `📊 **Not enough data for forecasting yet**\n\nI need at least 5 jobs to make predictions. You have ${historicalJobs?.length || 0} jobs in the last 3 months.\n\nKeep logging jobs and I'll be able to forecast your revenue soon!`
      }
    }
    
    // Calculate metrics by period
    const calcPeriodRevenue = (jobs: typeof historicalJobs, start: Date, end: Date) => {
      return jobs
        .filter(j => {
          const d = new Date(j.date)
          return d >= start && d <= end
        })
        .reduce((sum, j) => sum + Number(j.revenue), 0)
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _calcPeriodJobCount = (jobs: typeof historicalJobs, start: Date, end: Date) => {
      return jobs.filter(j => {
        const d = new Date(j.date)
        return d >= start && d <= end
      }).length
    }
    
    let forecastedRevenue: number
    let confidence: 'high' | 'medium' | 'low'
    let reasoning: string
    let currentProgress: number | null = null
    let daysRemaining: number | null = null
    
    if (period === 'this_week' || period === 'next_week') {
      // Weekly forecasting
      const lastWeekRevenue = calcPeriodRevenue(historicalJobs, lastWeekStart, thisWeekStart)
      const twoWeeksAgoRevenue = calcPeriodRevenue(historicalJobs, twoWeeksAgoStart, lastWeekStart)
      const thisWeekSoFar = calcPeriodRevenue(historicalJobs, thisWeekStart, now)
      
      // Average of last 2 weeks
      const weeklyAverage = (lastWeekRevenue + twoWeeksAgoRevenue) / 2
      
      // Trend (is revenue growing or shrinking?)
      const trend = lastWeekRevenue > 0 ? (lastWeekRevenue - twoWeeksAgoRevenue) / twoWeeksAgoRevenue : 0
      
      if (period === 'this_week') {
        // How many days into the week are we?
        const dayOfWeek = now.getDay() || 7 // Sunday = 7
        daysRemaining = 7 - dayOfWeek
        const daysPassed = dayOfWeek
        
        // Project based on current pace
        const dailyPace = daysPassed > 0 ? thisWeekSoFar / daysPassed : 0
        const pacedForecast = thisWeekSoFar + (dailyPace * daysRemaining)
        
        // Blend with historical average
        forecastedRevenue = Math.round((pacedForecast * 0.6) + (weeklyAverage * 0.4))
        currentProgress = thisWeekSoFar
        confidence = daysPassed >= 3 ? 'high' : 'medium'
        reasoning = `Based on your current pace ($${Math.round(dailyPace).toLocaleString()}/day) and last 2 weeks avg ($${Math.round(weeklyAverage).toLocaleString()})`
      } else {
        // Next week: use trend-adjusted average
        forecastedRevenue = Math.round(weeklyAverage * (1 + (trend * 0.5)))
        confidence = Math.abs(trend) < 0.2 ? 'medium' : 'low'
        reasoning = `Based on 2-week average${trend > 0.1 ? ' with upward trend' : trend < -0.1 ? ' with downward trend' : ''}`
      }
    } else {
      // Monthly forecasting
      const lastMonthRevenue = calcPeriodRevenue(historicalJobs, lastMonthStart, lastMonthEnd)
      const twoMonthsAgoRevenue = calcPeriodRevenue(historicalJobs, twoMonthsAgoStart, twoMonthsAgoEnd)
      const thisMonthSoFar = calcPeriodRevenue(historicalJobs, thisMonthStart, now)
      
      // Average of last 2 months
      const monthlyAverage = (lastMonthRevenue + twoMonthsAgoRevenue) / 2
      
      // Trend
      const trend = twoMonthsAgoRevenue > 0 ? (lastMonthRevenue - twoMonthsAgoRevenue) / twoMonthsAgoRevenue : 0
      
      if (period === 'this_month') {
        // How many days into the month are we?
        const dayOfMonth = now.getDate()
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        daysRemaining = daysInMonth - dayOfMonth
        
        // Project based on current pace
        const dailyPace = dayOfMonth > 0 ? thisMonthSoFar / dayOfMonth : 0
        const pacedForecast = thisMonthSoFar + (dailyPace * daysRemaining)
        
        // Blend with historical average (more weight to pace as month progresses)
        const paceWeight = Math.min(dayOfMonth / daysInMonth + 0.3, 0.8)
        forecastedRevenue = Math.round((pacedForecast * paceWeight) + (monthlyAverage * (1 - paceWeight)))
        currentProgress = thisMonthSoFar
        confidence = dayOfMonth >= 15 ? 'high' : dayOfMonth >= 7 ? 'medium' : 'low'
        reasoning = `Based on your current pace ($${Math.round(dailyPace * 30).toLocaleString()}/mo) and historical average`
      } else {
        // Next month: use trend-adjusted average
        forecastedRevenue = Math.round(monthlyAverage * (1 + (trend * 0.5)))
        confidence = Math.abs(trend) < 0.15 ? 'medium' : 'low'
        reasoning = `Based on 2-month average${trend > 0.1 ? ' with upward trend' : trend < -0.1 ? ' with downward trend' : ''}`
      }
    }
    
    // Build response message
    const confidenceEmoji = confidence === 'high' ? '🎯' : confidence === 'medium' ? '📊' : '🔮'
    const periodLabel = period.replace('_', ' ').replace('this', 'This').replace('next', 'Next')
    
    let message = `${confidenceEmoji} **${periodLabel} Forecast**\n\n`
    message += `**Projected Revenue:** $${forecastedRevenue.toLocaleString()}\n`
    
    if (currentProgress !== null) {
      message += `**So far:** $${currentProgress.toLocaleString()}\n`
      message += `**Remaining to hit forecast:** $${(forecastedRevenue - currentProgress).toLocaleString()}`
      if (daysRemaining !== null && daysRemaining > 0) {
        message += ` (${daysRemaining} days left)\n`
      } else {
        message += '\n'
      }
    }
    
    message += `\n*${reasoning}*\n`
    message += `\n**Confidence:** ${confidence.charAt(0).toUpperCase() + confidence.slice(1)}`
    
    return {
      success: true,
      data: {
        period,
        forecastedRevenue,
        currentProgress,
        daysRemaining,
        confidence,
        reasoning
      },
      message
    }
  } catch (error) {
    console.error('Error forecasting revenue:', error)
    return {
      success: false,
      error: String(error),
      message: 'Had trouble calculating the forecast. Try again in a moment.'
    }
  }
}

// =============================================
// FOLLOW-UP RISK ANALYSIS HANDLER
// =============================================

async function getFollowUpRiskAnalysis(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const includeAll = args.include_all as boolean
    
    // Get pending follow-ups with quote details
    const { data: followUps, error } = await supabase
      .from('dyia_follow_ups')
      .select(`
        id,
        status,
        created_at,
        contact_count,
        last_contact_at,
        notes,
        quote:dyia_quotes (
          id,
          customer_name,
          estimate_low,
          estimate_high,
          job_description,
          created_at
        )
      `)
      .eq('user_id', dyiaUserId)
      .in('status', ['pending', 'contacted', 'snoozed'])
      .order('created_at', { ascending: true })
    
    if (error) throw error
    
    if (!followUps || followUps.length === 0) {
      return {
        success: true,
        data: { followUps: [], summary: {} },
        message: '✅ **No pending follow-ups!**\n\nAll your quotes have been followed up on. Nice work staying on top of things!'
      }
    }
    
    // Get historical conversion data for this user
    const { data: convertedFollowUps } = await supabase
      .from('dyia_follow_ups')
      .select('created_at, updated_at, status, contact_count')
      .eq('user_id', dyiaUserId)
      .eq('status', 'converted')
    
    // Calculate user's average conversion metrics
    let avgDaysToConvert = 3 // default
    let avgContactsToConvert = 2 // default
    let conversionRate = 0.3 // default 30%
    
    if (convertedFollowUps && convertedFollowUps.length >= 3) {
      const conversionTimes = convertedFollowUps.map(f => {
        const created = new Date(f.created_at)
        const updated = new Date(f.updated_at)
        return (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
      })
      avgDaysToConvert = conversionTimes.reduce((a, b) => a + b, 0) / conversionTimes.length
      // Track contacts for future use
      avgContactsToConvert = convertedFollowUps.reduce((sum, f) => sum + (f.contact_count || 1), 0) / convertedFollowUps.length
      void avgContactsToConvert // Will be used when expanding conversion insights
      
      // Calculate conversion rate
      const { count: totalFollowUps } = await supabase
        .from('dyia_follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', dyiaUserId)
        .in('status', ['converted', 'lost'])
      
      if (totalFollowUps && totalFollowUps > 0) {
        conversionRate = convertedFollowUps.length / totalFollowUps
      }
    }
    
    // Analyze each follow-up for risk
    const now = new Date()
    type QuoteData = { id: string; customer_name: string; estimate_low: number; estimate_high: number; job_description: string; created_at: string }
    const analyzedFollowUps = followUps.map(f => {
      // Supabase returns the joined quote as a single object (not an array) for single relations
      const quoteData = f.quote as unknown as QuoteData | null
      const createdAt = new Date(f.created_at)
      const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      const contactCount = f.contact_count || 0
      
      // Calculate conversion probability
      // Decreases with time, increases with contact attempts (up to a point)
      let conversionProbability: number
      
      if (daysSinceCreated <= 3) {
        // Fresh quote - high probability
        conversionProbability = 0.6 - (daysSinceCreated * 0.05)
      } else if (daysSinceCreated <= 7) {
        // Warm quote - medium probability
        conversionProbability = 0.45 - ((daysSinceCreated - 3) * 0.05)
      } else if (daysSinceCreated <= 14) {
        // Getting cold
        conversionProbability = 0.2 - ((daysSinceCreated - 7) * 0.02)
      } else {
        // Cold quote
        conversionProbability = Math.max(0.05, 0.1 - ((daysSinceCreated - 14) * 0.005))
      }
      
      // Adjust for contact attempts
      if (contactCount > 0 && contactCount <= 3) {
        conversionProbability *= (1 + (contactCount * 0.1))
      } else if (contactCount > 3) {
        conversionProbability *= 0.8 // Over-contact penalty
      }
      
      // Adjust based on user's historical conversion rate
      conversionProbability *= (conversionRate / 0.3) // Normalize to their actual rate
      conversionProbability = Math.min(0.95, Math.max(0.02, conversionProbability))
      
      // Determine risk level
      let riskLevel: 'critical' | 'high' | 'medium' | 'low'
      if (daysSinceCreated > 10 || conversionProbability < 0.1) {
        riskLevel = 'critical'
      } else if (daysSinceCreated > 7 || conversionProbability < 0.2) {
        riskLevel = 'high'
      } else if (daysSinceCreated > 3 || conversionProbability < 0.4) {
        riskLevel = 'medium'
      } else {
        riskLevel = 'low'
      }
      
      return {
        ...f,
        quote: quoteData,
        daysSinceCreated: Math.round(daysSinceCreated),
        conversionProbability: Math.round(conversionProbability * 100),
        riskLevel,
        estimateValue: quoteData ? (quoteData.estimate_low + quoteData.estimate_high) / 2 : 0
      }
    })
    
    // Filter if not including all
    const filteredFollowUps = includeAll 
      ? analyzedFollowUps 
      : analyzedFollowUps.filter(f => f.riskLevel === 'critical' || f.riskLevel === 'high')
    
    // Sort by risk (critical first)
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    filteredFollowUps.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel])
    
    // Calculate summary stats
    const criticalCount = analyzedFollowUps.filter(f => f.riskLevel === 'critical').length
    const highRiskCount = analyzedFollowUps.filter(f => f.riskLevel === 'high').length
    const atRiskValue = analyzedFollowUps
      .filter(f => f.riskLevel === 'critical' || f.riskLevel === 'high')
      .reduce((sum, f) => sum + f.estimateValue, 0)
    
    // Build response message
    let message = '🎯 **Follow-Up Risk Analysis**\n\n'
    
    if (criticalCount > 0 || highRiskCount > 0) {
      message += `⚠️ **${criticalCount + highRiskCount} quotes at risk** ($${Math.round(atRiskValue).toLocaleString()} potential revenue)\n\n`
    }
    
    // Show top priority items
    const topItems = filteredFollowUps.slice(0, 5)
    for (const item of topItems) {
      const emoji = item.riskLevel === 'critical' ? '🔴' : item.riskLevel === 'high' ? '🟠' : item.riskLevel === 'medium' ? '🟡' : '🟢'
      const customerName = item.quote?.customer_name || 'Unknown'
      message += `${emoji} **${customerName}** - ${item.daysSinceCreated}d old, ${item.conversionProbability}% chance\n`
    }
    
    if (filteredFollowUps.length > 5) {
      message += `\n...and ${filteredFollowUps.length - 5} more\n`
    }
    
    message += `\n📊 **Your stats:** ${Math.round(conversionRate * 100)}% conversion rate, avg ${Math.round(avgDaysToConvert)} days to close`
    
    if (criticalCount > 0) {
      message += `\n\n💡 **Tip:** Call your critical leads TODAY - after 10 days, conversion drops to under 10%`
    }
    
    return {
      success: true,
      data: {
        followUps: filteredFollowUps,
        summary: {
          total: analyzedFollowUps.length,
          critical: criticalCount,
          highRisk: highRiskCount,
          atRiskValue,
          userConversionRate: Math.round(conversionRate * 100),
          avgDaysToConvert: Math.round(avgDaysToConvert)
        }
      },
      message
    }
  } catch (error) {
    console.error('Error analyzing follow-up risk:', error)
    return {
      success: false,
      error: String(error),
      message: 'Had trouble analyzing your follow-ups. Try again in a moment.'
    }
  }
}

// =============================================
// MEMORY HANDLER
// =============================================

async function saveMemory(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const category = args.category as string
    const content = (args.content as string)?.trim()

    if (!content || content.length < 5) {
      return { success: false, message: 'Memory content too short to save.', error: 'too_short' }
    }

    // Check if memory already exists (functional unique index on lower(content))
    const { data: existing } = await supabase
      .from('dyia_user_memory')
      .select('id')
      .eq('user_id', dyiaUserId)
      .ilike('content', content)
      .single()

    if (existing) {
      await supabase.from('dyia_user_memory').update({
        category,
        confidence: 1.0,
        last_referenced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      const { error } = await supabase.from('dyia_user_memory').insert({
        user_id: dyiaUserId,
        category,
        content,
        source: 'conversation',
        confidence: 1.0,
        last_referenced_at: new Date().toISOString(),
      })

      if (error && error.code !== '23505') throw error
    }

    return {
      success: true,
      data: { category, content },
      message: `Noted — I'll remember that.`
    }
  } catch (error) {
    console.error('Error saving memory:', error)
    return { success: false, error: String(error), message: 'Failed to save memory.' }
  }
}

// =============================================
// BATCH HANDLERS
// =============================================

async function batchStoreCustomers(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const customers = args.customers as Array<{
      name: string; phone: string; email: string; address: string; notes: string; tags: string[]
    }>

    if (!customers || customers.length === 0) {
      return { success: false, message: 'No customer data provided.', error: 'empty_array' }
    }

    let stored = 0
    let updated = 0
    let failed = 0
    const results: Array<{ customerId: string | null; name: string }> = []

    for (const c of customers) {
      if (!c.name?.trim()) { failed++; continue }

      try {
        const customerId = await ensureCustomer(supabase, dyiaUserId, c.name.trim(), {
          phone: c.phone || null,
          email: c.email || null,
          address: c.address || null,
          notes: c.notes || null,
          tags: c.tags?.length ? c.tags : undefined,
        })

        if (!customerId) { failed++; continue }

        const { data: existing } = await supabase
          .from('dyia_customers')
          .select('created_at, updated_at')
          .eq('id', customerId)
          .limit(1)

        if (existing?.[0] && existing[0].created_at !== existing[0].updated_at) {
          updated++
        } else {
          stored++
        }
        results.push({ customerId, name: c.name.trim() })
      } catch (err) {
        const error = err as { code?: string }
        if (error.code !== '23505') failed++
        else updated++
      }
    }

    const total = stored + updated
    let message = `✅ **${total} customer${total !== 1 ? 's' : ''} processed**\n\n`
    if (stored > 0) message += `• ${stored} new customer${stored !== 1 ? 's' : ''} added\n`
    if (updated > 0) message += `• ${updated} existing customer${updated !== 1 ? 's' : ''} updated\n`
    if (failed > 0) message += `• ${failed} skipped (missing name)\n`

    return {
      success: true,
      data: { stored, updated, failed, total, customers: results, customerNames: results.map(r => r.name) },
      message
    }
  } catch (error) {
    console.error('Error batch storing customers:', error)
    return { success: false, error: String(error), message: 'Failed to store customers. Please try again.' }
  }
}

async function batchCreateQuotes(args: Record<string, unknown>, dyiaUserId: string): Promise<HandlerResult> {
  const supabase = getSupabase()
  try {
    const quotes = args.quotes as Array<{
      customer_name: string; customer_phone: string; customer_email: string
      customer_address: string; job_description: string; estimate_low: number
      estimate_high: number; preferred_date: string; notes: string
    }>

    if (!quotes || quotes.length === 0) {
      return { success: false, message: 'No quote data provided.', error: 'empty_array' }
    }

    let created = 0
    let failed = 0
    const createdQuotes: Array<{ customer: string; range: string }> = []
    let totalValue = 0

    for (const q of quotes) {
      if (!q.customer_name?.trim()) { failed++; continue }

      try {
        const estimateLow = q.estimate_low || 0
        const estimateHigh = q.estimate_high || estimateLow
        const total = Math.round((estimateLow + estimateHigh) / 2)

        const noteParts = [q.job_description || '']
        if (q.preferred_date) noteParts.push(`Preferred date: ${q.preferred_date}`)
        if (q.notes) noteParts.push(q.notes)
        const fullDescription = noteParts.filter(Boolean).join(' | ')

        const customerId = await ensureCustomer(supabase, dyiaUserId, q.customer_name.trim(), {
          phone: q.customer_phone || null,
          email: q.customer_email || null,
          address: q.customer_address || null,
        })

        const { data, error } = await supabase
          .from('dyia_quotes')
          .insert({
            user_id: dyiaUserId,
            customer_id: customerId,
            customer_name: q.customer_name.trim(),
            customer_phone: q.customer_phone || null,
            customer_email: q.customer_email || null,
            customer_address: q.customer_address || null,
            job_description: fullDescription,
            pricing: {},
            estimate_low: estimateLow,
            estimate_high: estimateHigh,
            total,
            status: 'draft',
            photo_urls: []
          })
          .select('id')
          .single()

        if (error) throw error

        await supabase.from('dyia_follow_ups').insert({
          user_id: dyiaUserId,
          customer_id: customerId,
          quote_id: data.id,
          status: 'pending',
          contact_count: 0,
          ...(q.preferred_date ? { next_follow_up_at: q.preferred_date } : {})
        })

        created++
        totalValue += total
        createdQuotes.push({
          customer: q.customer_name.trim(),
          range: `$${estimateLow.toLocaleString()}-$${estimateHigh.toLocaleString()}`
        })
      } catch {
        failed++
      }
    }

    let message = `✅ **${created} quote${created !== 1 ? 's' : ''} created** (total value: ~$${totalValue.toLocaleString()})\n\n`

    for (const q of createdQuotes.slice(0, 10)) {
      message += `• **${q.customer}**: ${q.range}\n`
    }
    if (createdQuotes.length > 10) {
      message += `• ...and ${createdQuotes.length - 10} more\n`
    }

    if (failed > 0) message += `\n⚠️ ${failed} quote${failed !== 1 ? 's' : ''} failed to create.`
    message += `\n\n📍 Follow-ups have been auto-scheduled for all quotes.`

    return {
      success: true,
      data: { created, failed, totalValue, quotes: createdQuotes },
      message
    }
  } catch (error) {
    console.error('Error batch creating quotes:', error)
    return { success: false, error: String(error), message: 'Failed to create quotes. Please try again.' }
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
    // Proposal handlers (return data for user confirmation)
    case 'propose_job':
      return proposeJob(args)
    
    case 'propose_quote':
      return proposeQuote(args)

    // Direct execution handlers
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

    case 'get_user_context':
      return getUserContext(args, dyiaUserId)
    
    case 'find_similar_jobs':
      return findSimilarJobs(args, dyiaUserId)
    
    case 'get_revenue_forecast':
      return getRevenueForecast(args, dyiaUserId)
    
    case 'get_follow_up_risk_analysis':
      return getFollowUpRiskAnalysis(args, dyiaUserId)
    
    case 'batch_store_customers':
      return batchStoreCustomers(args, dyiaUserId)

    case 'batch_create_quotes':
      return batchCreateQuotes(args, dyiaUserId)

    case 'save_memory':
      return saveMemory(args, dyiaUserId)
    
    default:
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
        message: `I don't know how to handle that action yet.`
      }
  }
}
