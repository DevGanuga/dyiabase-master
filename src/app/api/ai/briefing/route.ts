import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: user } = await supabase
      .from('dyia_users')
      .select('id, first_name')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const now = new Date()
    const hour = now.getHours()
    const todayStr = now.toISOString().split('T')[0]
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    // Fetch data in parallel
    const [
      { data: todayJobs },
      { data: monthJobs },
      { count: pendingFollowUps },
      { count: hotFollowUps },
      { data: settings },
    ] = await Promise.all([
      // Today's jobs
      supabase
        .from('dyia_jobs')
        .select('customer_name, revenue')
        .eq('user_id', user.id)
        .eq('date', todayStr),
      // This month's jobs
      supabase
        .from('dyia_jobs')
        .select('revenue')
        .eq('user_id', user.id)
        .gte('date', monthStart),
      // Pending follow-ups
      supabase
        .from('dyia_follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['pending', 'contacted']),
      // Hot follow-ups (last 3 days)
      supabase
        .from('dyia_follow_ups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
      // Settings
      supabase
        .from('dyia_settings')
        .select('monthly_goal, metadata')
        .eq('user_id', user.id)
        .single(),
    ])

    const todayRevenue = (todayJobs || []).reduce((sum, j) => sum + (parseFloat(j.revenue) || 0), 0)
    const monthRevenue = (monthJobs || []).reduce((sum, j) => sum + (parseFloat(j.revenue) || 0), 0)
    const monthlyGoal = parseFloat(settings?.monthly_goal) || 0
    const goalProgress = monthlyGoal > 0 ? Math.round((monthRevenue / monthlyGoal) * 100) : 0
    const name = user.first_name || 'there'

    // Time-based greeting
    let timeGreeting: string
    if (hour < 12) timeGreeting = `Good morning, ${name}`
    else if (hour < 17) timeGreeting = `Hey, ${name}`
    else timeGreeting = `Good evening, ${name}`

    // Build briefing parts
    const parts: string[] = []

    // Today's work
    if ((todayJobs || []).length > 0) {
      parts.push(`${(todayJobs || []).length} job${(todayJobs || []).length !== 1 ? 's' : ''} today worth ${formatCurrency(todayRevenue)}`)
    }

    // Follow-ups
    if ((hotFollowUps || 0) > 0) {
      parts.push(`${hotFollowUps} hot follow-up${hotFollowUps !== 1 ? 's' : ''} need attention`)
    } else if ((pendingFollowUps || 0) > 0) {
      parts.push(`${pendingFollowUps} follow-up${pendingFollowUps !== 1 ? 's' : ''} pending`)
    }

    // Goal progress
    if (monthlyGoal > 0) {
      if (goalProgress >= 100) {
        parts.push(`you've hit your monthly goal!`)
      } else {
        parts.push(`${goalProgress}% to your monthly goal`)
      }
    }

    // Monthly summary
    if ((monthJobs || []).length > 0 && parts.length < 3) {
      parts.push(`${(monthJobs || []).length} jobs this month, ${formatCurrency(monthRevenue)} revenue`)
    }

    // Build the briefing message
    let briefing: string
    if (parts.length === 0) {
      briefing = hour < 12
        ? 'Ready to start logging jobs? I\u2019m here to help.'
        : 'Quiet day so far. Need to log a job or create a quote?'
    } else {
      briefing = parts.join('. ') + '.'
    }

    // Time-of-day specific coaching tips
    let tip: string | null = null
    if (hour >= 8 && hour < 11 && (hotFollowUps || 0) > 0) {
      tip = 'Morning is the best time to follow up. Customers are more responsive before noon.'
    } else if (hour >= 16 && hour < 19 && (todayJobs || []).length > 0) {
      tip = 'End of day - great time to log any jobs you haven\u2019t tracked yet.'
    }

    return NextResponse.json({
      greeting: timeGreeting,
      briefing,
      tip,
      stats: {
        todayJobs: (todayJobs || []).length,
        todayRevenue,
        monthRevenue,
        monthJobs: (monthJobs || []).length,
        pendingFollowUps: pendingFollowUps || 0,
        hotFollowUps: hotFollowUps || 0,
        goalProgress,
      },
    })
  } catch (error) {
    console.error('Briefing API error:', error)
    return NextResponse.json({ error: 'Failed to generate briefing' }, { status: 500 })
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}
