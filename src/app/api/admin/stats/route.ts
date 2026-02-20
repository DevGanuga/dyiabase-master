import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** GET /api/admin/stats - Comprehensive admin dashboard data */
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const supabase = getSupabase()
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

    const [
      usersRes,
      jobsCountRes,
      quotesCountRes,
      customersCountRes,
      revenueRes,
      signups7Res,
      signups30Res,
      messageStatsRes,
      creditPurchasesRes,
      creditUsageRes,
      webhookSuccess7Res,
      webhookError7Res,
      webhookErrorsRecentRes,
      emailLogsRes,
      emailLogs7Res,
      campaignsRes,
      threadsByUserRes,
      recentCreditTxRes,
      jobsByUserRes,
      settingsRes,
      quotesByUserRes,
    ] = await Promise.all([
      supabase.from('dyia_users')
        .select('id, clerk_user_id, email, first_name, last_name, subscription_status, subscription_plan, subscription_ends_at, stripe_customer_id, stripe_subscription_id, ai_credits_balance, ai_credits_used_lifetime, is_admin, role, created_at, updated_at')
        .order('created_at', { ascending: false }),

      supabase.from('dyia_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('dyia_quotes').select('*', { count: 'exact', head: true }),
      safeCount(supabase, 'dyia_customers'),
      supabase.from('dyia_jobs').select('revenue'),

      supabase.from('dyia_users').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      supabase.from('dyia_users').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),

      supabase.from('dyia_messages').select('tokens_used'),
      supabase.from('dyia_credit_transactions').select('amount').eq('type', 'purchase'),
      supabase.from('dyia_credit_transactions').select('amount').eq('type', 'usage'),

      supabase.from('dyia_webhook_events').select('*', { count: 'exact', head: true }).eq('status', 'success').gte('created_at', sevenDaysAgo),
      supabase.from('dyia_webhook_events').select('*', { count: 'exact', head: true }).eq('status', 'error').gte('created_at', sevenDaysAgo),
      supabase.from('dyia_webhook_events').select('id, source, event_type, error_message, created_at').eq('status', 'error').order('created_at', { ascending: false }).limit(10),

      safeQuery(supabase, 'dyia_email_logs', 'email_type, status'),
      safeCountSince(supabase, 'dyia_email_logs', sevenDaysAgo),
      safeCount(supabase, 'dyia_email_campaigns'),

      supabase.from('dyia_threads').select('user_id, message_count'),
      supabase.from('dyia_credit_transactions')
        .select('id, user_id, type, amount, balance_after, description, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('dyia_jobs').select('user_id'),
      supabase.from('dyia_settings').select('user_id, onboarding_completed'),
      supabase.from('dyia_quotes').select('user_id'),
    ])

    const users = usersRes.data || []

    // Compute user status counts
    const statusCounts: Record<string, number> = { active: 0, trialing: 0, canceled: 0, past_due: 0, inactive: 0 }
    const planCounts: Record<string, Record<string, number>> = {
      active: { monthly: 0, annual: 0 },
      trialing: { monthly: 0, annual: 0 },
    }
    for (const u of users) {
      const s = u.subscription_status || 'inactive'
      statusCounts[s] = (statusCounts[s] || 0) + 1
      if ((s === 'active' || s === 'trialing') && u.subscription_plan) {
        planCounts[s][u.subscription_plan] = (planCounts[s]?.[u.subscription_plan] || 0) + 1
      }
    }

    // Platform GMV
    const platformGMV = (revenueRes.data || []).reduce((sum, j) => sum + (parseFloat(j.revenue) || 0), 0)

    // MRR estimate: monthly active * $29.99 + annual active * $24.99
    const estimatedMRR =
      (planCounts.active.monthly * 29.99) +
      (planCounts.active.annual * 24.99) +
      (planCounts.active.monthly === 0 && planCounts.active.annual === 0
        ? statusCounts.active * 29.99
        : 0)

    const conversionRate = users.length > 0
      ? Math.round((statusCounts.active / users.length) * 100)
      : 0

    const userMap = new Map(users.map(u => [u.id, u]))

    // AI stats
    const messageData = messageStatsRes.data || []
    const totalTokens = messageData.reduce((sum, m) => sum + (m.tokens_used || 0), 0)
    const totalCreditsPurchased = (creditPurchasesRes.data || []).reduce((sum, p) => sum + (p.amount || 0), 0)
    const totalCreditsUsed = (creditUsageRes.data || []).reduce((sum, u) => sum + Math.abs(u.amount || 0), 0)

    // Per-user AI usage (by thread message_count)
    const userAIUsage: Record<string, number> = {}
    for (const t of (threadsByUserRes.data || [])) {
      userAIUsage[t.user_id] = (userAIUsage[t.user_id] || 0) + (t.message_count || 0)
    }
    const topAIUsers = Object.entries(userAIUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, messageCount]) => {
        const u = userMap.get(userId)
        return {
          userId,
          email: u?.email || 'Unknown',
          name: [u?.first_name, u?.last_name].filter(Boolean).join(' ') || null,
          messageCount,
          creditsBalance: u?.ai_credits_balance || 0,
          creditsUsedLifetime: u?.ai_credits_used_lifetime || 0,
        }
      })

    // Per-user job and quote counts
    const jobCounts: Record<string, number> = {}
    for (const j of (jobsByUserRes.data || [])) {
      jobCounts[j.user_id] = (jobCounts[j.user_id] || 0) + 1
    }
    const quoteCounts: Record<string, number> = {}
    for (const q of (quotesByUserRes.data || [])) {
      quoteCounts[q.user_id] = (quoteCounts[q.user_id] || 0) + 1
    }

    // Onboarding status per user
    const onboardedUsers = new Set(
      (settingsRes.data || []).filter(s => s.onboarding_completed).map(s => s.user_id)
    )

    // Compute lifecycle stage per user
    // signed_up → subscribed → onboarded → activated → engaged → churned
    function getLifecycleStage(u: typeof users[0]): string {
      const status = u.subscription_status || 'inactive'
      if (status === 'canceled') return 'churned'
      if (status === 'inactive') return 'signed_up'
      const hasOnboarded = onboardedUsers.has(u.id)
      const hasJobs = (jobCounts[u.id] || 0) > 0
      const hasQuotes = (quoteCounts[u.id] || 0) > 0
      const hasAI = (userAIUsage[u.id] || 0) > 0
      if (hasJobs && (hasQuotes || hasAI)) return 'engaged'
      if (hasJobs) return 'activated'
      if (hasOnboarded) return 'onboarded'
      return 'subscribed'
    }

    const enrichedUsers = users.map(u => ({
      ...u,
      jobCount: jobCounts[u.id] || 0,
      quoteCount: quoteCounts[u.id] || 0,
      threadCount: userAIUsage[u.id] || 0,
      onboarded: onboardedUsers.has(u.id),
      lifecycleStage: getLifecycleStage(u),
    }))

    // Journey funnel counts
    const usersWithSub = users.filter(u => ['active', 'trialing', 'past_due', 'canceled'].includes(u.subscription_status || '')).length
    const usersOnboarded = onboardedUsers.size
    const usersWithJob = new Set(Object.keys(jobCounts)).size
    const usersWithQuote = new Set(Object.keys(quoteCounts)).size
    const usersWithAI = new Set(Object.keys(userAIUsage)).size
    const usersEngaged = enrichedUsers.filter(u => u.lifecycleStage === 'engaged').length

    // Recent activity feed
    const recentActivity: Array<{ type: string; description: string; timestamp: string; email?: string; userId?: string }> = []
    for (const u of users.slice(0, 15)) {
      recentActivity.push({
        type: 'signup',
        description: `${u.first_name || u.email} signed up`,
        timestamp: u.created_at,
        email: u.email,
        userId: u.id,
      })
    }
    for (const e of (webhookErrorsRecentRes.data || []).slice(0, 5)) {
      recentActivity.push({
        type: 'webhook_error',
        description: `${e.source}/${e.event_type} failed: ${e.error_message || 'Unknown'}`,
        timestamp: e.created_at,
      })
    }
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const recentCredits = (recentCreditTxRes.data || []).map(tx => {
      const u = userMap.get(tx.user_id)
      return {
        ...tx,
        userEmail: u?.email || 'Unknown',
        userName: [u?.first_name, u?.last_name].filter(Boolean).join(' ') || null,
      }
    })

    return NextResponse.json({
      overview: {
        totalUsers: users.length,
        activeSubscriptions: statusCounts.active,
        trialingUsers: statusCounts.trialing,
        canceledUsers: statusCounts.canceled,
        pastDueUsers: statusCounts.past_due,
        inactiveUsers: statusCounts.inactive,
        totalJobs: jobsCountRes.count || 0,
        totalQuotes: quotesCountRes.count || 0,
        totalCustomers: customersCountRes,
        platformGMV,
        estimatedMRR: Math.round(estimatedMRR * 100) / 100,
        signupsLast7Days: signups7Res.count || 0,
        signupsLast30Days: signups30Res.count || 0,
        conversionRate,
      },
      ai: {
        totalThreads: (threadsByUserRes.data || []).length,
        totalMessages: messageData.length,
        totalTokensUsed: totalTokens,
        totalCreditsPurchased,
        totalCreditsUsed,
        estimatedOpenAICost: Math.round((totalTokens / 1000) * 0.015 * 100) / 100,
        topUsers: topAIUsers,
        recentTransactions: recentCredits,
      },
      subscriptions: {
        monthlyActive: planCounts.active.monthly,
        annualActive: planCounts.active.annual,
        monthlyTrialing: planCounts.trialing.monthly,
        annualTrialing: planCounts.trialing.annual,
        statusCounts,
      },
      system: {
        webhooksLast7Days: {
          success: webhookSuccess7Res.count || 0,
          error: webhookError7Res.count || 0,
        },
        recentErrors: (webhookErrorsRecentRes.data || []).map(e => ({
          id: e.id,
          source: e.source,
          eventType: e.event_type,
          errorMessage: e.error_message,
          createdAt: e.created_at,
        })),
        emails: (() => {
          const logs = emailLogsRes as Array<{ email_type: string; status: string }>
          const total = logs.length
          const sent = logs.filter(l => l.status === 'sent').length
          const failed = logs.filter(l => l.status === 'failed').length
          const byType: Record<string, number> = {}
          for (const l of logs) {
            byType[l.email_type] = (byType[l.email_type] || 0) + 1
          }
          return { total, sent, failed, last7Days: emailLogs7Res, byType, campaigns: campaignsRes }
        })(),
      },
      journey: {
        signedUp: users.length,
        subscribed: usersWithSub,
        onboarded: usersOnboarded,
        firstJob: usersWithJob,
        firstQuote: usersWithQuote,
        usedAI: usersWithAI,
        engaged: usersEngaged,
      },
      users: enrichedUsers,
      recentActivity: recentActivity.slice(0, 20),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin stats error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery(supabase: any, table: string, columns: string): Promise<Array<Record<string, string>>> {
  try {
    const { data } = await supabase.from(table).select(columns)
    return data || []
  } catch { return [] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(supabase: any, table: string): Promise<number> {
  try {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    return count || 0
  } catch { return 0 }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCountSince(supabase: any, table: string, since: string): Promise<number> {
  try {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).gte('created_at', since)
    return count || 0
  } catch { return 0 }
}
