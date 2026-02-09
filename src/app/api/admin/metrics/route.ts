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

/** GET /api/admin/metrics - Platform-wide stats */
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const supabase = getSupabase()
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { count: totalUsers },
      { count: activeSubscriptions },
      { count: trialingUsers },
      { count: newUsersThisWeek },
      { data: allUsers },
      { count: totalJobs },
      { count: totalQuotes },
    ] = await Promise.all([
      supabase.from('dyia_users').select('*', { count: 'exact', head: true }),
      supabase.from('dyia_users').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
      supabase.from('dyia_users').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
      supabase.from('dyia_users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('dyia_users').select('subscription_status, subscription_plan, created_at, updated_at'),
      supabase.from('dyia_jobs').select('*', { count: 'exact', head: true }),
      supabase.from('dyia_quotes').select('*', { count: 'exact', head: true }),
    ])

    // Calculate MRR (Monthly Recurring Revenue)
    const users = allUsers || []
    let mrr = 0
    for (const u of users) {
      if (u.subscription_status === 'active' || u.subscription_status === 'trialing') {
        if (u.subscription_plan === 'annual') mrr += 287 / 12 // ~$23.92/mo
        else mrr += 29.99
      }
    }

    // Trial conversion rate (users who went from trialing to active)
    const usersWithHistory = users.filter(u => u.subscription_status === 'active')
    const totalTrialsEver = users.filter(u => 
      u.subscription_status === 'active' || 
      u.subscription_status === 'trialing' || 
      u.subscription_status === 'canceled'
    ).length
    const conversionRate = totalTrialsEver > 0 
      ? Math.round((usersWithHistory.length / totalTrialsEver) * 100) 
      : 0

    // Churn (canceled in last 30 days)
    const canceledRecent = users.filter(u => 
      u.subscription_status === 'canceled' && 
      u.updated_at && new Date(u.updated_at) >= new Date(monthAgo)
    ).length
    const canceledTotal = users.filter(u => u.subscription_status === 'canceled').length

    // Churn rate (canceled last 30d / active+trialing at start of period)
    const payingStart = (activeSubscriptions || 0) + (trialingUsers || 0) + canceledRecent
    const churnRate = payingStart > 0 ? Math.round((canceledRecent / payingStart) * 100) : 0

    // ARR (Annual Recurring Revenue)
    const arr = Math.round(mrr * 12)

    // Average Revenue Per User
    const payingUsers = (activeSubscriptions || 0) + (trialingUsers || 0)
    const arpu = payingUsers > 0 ? Math.round((mrr / payingUsers) * 100) / 100 : 0

    // LTV estimate (ARPU / monthly churn rate)
    const monthlyChurnDecimal = churnRate / 100
    const ltv = monthlyChurnDecimal > 0 ? Math.round(arpu / monthlyChurnDecimal) : 0

    // Status breakdown
    const statusBreakdown: Record<string, number> = {}
    for (const u of users) {
      const s = u.subscription_status || 'inactive'
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1
    }

    // Signup trend (last 7 days)
    const signupsByDay: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      signupsByDay[key] = 0
    }
    for (const u of users) {
      const day = u.created_at?.split('T')[0]
      if (day && signupsByDay[day] !== undefined) {
        signupsByDay[day]++
      }
    }

    // Quiz funnel stats
    const { count: quizSubmissions } = await supabase
      .from('dyia_quiz_submissions')
      .select('*', { count: 'exact', head: true })

    const { count: quizStartedTrial } = await supabase
      .from('dyia_quiz_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('started_trial', true)

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeSubscriptions: activeSubscriptions || 0,
      trialingUsers: trialingUsers || 0,
      newUsersThisWeek: newUsersThisWeek || 0,
      mrr: Math.round(mrr * 100) / 100,
      arr,
      arpu,
      ltv,
      conversionRate,
      churnRate,
      canceledRecent,
      canceledTotal,
      payingUsers,
      totalJobs: totalJobs || 0,
      totalQuotes: totalQuotes || 0,
      statusBreakdown,
      signupsByDay,
      quizSubmissions: quizSubmissions || 0,
      quizStartedTrial: quizStartedTrial || 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin metrics GET:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
