import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface QuickAction {
  id: string
  label: string
  prompt: string
  icon?: string
  priority: number // Lower = higher priority
}

/**
 * GET /api/ai/quick-actions
 * Returns dynamic, context-aware quick actions for the Dyia assistant
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    // 1. Auth check
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from('dyia_users')
      .select('id, subscription_status, first_name')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const dyiaUserId = userProfile.id
    const actions: QuickAction[] = []

    // 3. Check for pending follow-ups (HOT ones first)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    
    const { count: hotFollowUps } = await supabase
      .from('dyia_follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dyiaUserId)
      .eq('status', 'pending')
      .gte('created_at', threeDaysAgo)

    const { count: totalFollowUps } = await supabase
      .from('dyia_follow_ups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dyiaUserId)
      .in('status', ['pending', 'contacted'])

    if ((hotFollowUps || 0) > 0) {
      actions.push({
        id: 'hot-follow-ups',
        label: `${hotFollowUps} hot follow-up${hotFollowUps === 1 ? '' : 's'}`,
        prompt: 'Show me my hot follow-ups that need attention',
        icon: '🔥',
        priority: 1
      })
    } else if ((totalFollowUps || 0) > 0) {
      actions.push({
        id: 'pending-follow-ups',
        label: `${totalFollowUps} pending follow-up${totalFollowUps === 1 ? '' : 's'}`,
        prompt: 'Show me my pending follow-ups',
        icon: '📞',
        priority: 2
      })
    }

    // 4. Check if any jobs logged today
    const today = new Date().toISOString().split('T')[0]
    const { count: todayJobs } = await supabase
      .from('dyia_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dyiaUserId)
      .eq('date', today)

    if ((todayJobs || 0) === 0) {
      actions.push({
        id: 'log-job',
        label: "Log today's job",
        prompt: "I want to log a job I did today",
        icon: '📝',
        priority: 3
      })
    }

    // 5. Get day of week for context
    const dayOfWeek = new Date().getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isMonday = dayOfWeek === 1

    // Weekly stats on Monday or weekends (review time)
    if (isMonday || isWeekend) {
      actions.push({
        id: 'weekly-stats',
        label: "This week's stats",
        prompt: 'How did I do this week?',
        icon: '📊',
        priority: 4
      })
    }

    // 6. Always include some defaults based on priority
    // Stats (if not already added)
    if (!actions.find(a => a.id === 'weekly-stats')) {
      actions.push({
        id: 'performance',
        label: "How am I doing?",
        prompt: 'How did I do this month?',
        icon: '📈',
        priority: 5
      })
    }

    // Pricing help
    actions.push({
      id: 'pricing-help',
      label: 'Get a price suggestion',
      prompt: 'What should I charge for a full truck load?',
      icon: '💰',
      priority: 6
    })

    // Check for quotes needing creation
    const { count: recentQuotes } = await supabase
      .from('dyia_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dyiaUserId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if ((recentQuotes || 0) === 0) {
      actions.push({
        id: 'create-quote',
        label: 'Create a quote',
        prompt: 'Help me create a quote for a potential customer',
        icon: '📋',
        priority: 7
      })
    }

    // 7. Sort by priority and limit to 4 actions
    const sortedActions = actions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 4)
      .map(({ id, label, prompt, icon }) => ({ id, label, prompt, icon }))

    return NextResponse.json({
      actions: sortedActions,
      userName: userProfile.first_name || null
    })

  } catch (error) {
    console.error('[Quick Actions Error]', error)
    
    // Return default actions on error
    return NextResponse.json({
      actions: [
        { id: 'stats', label: "This week's stats", prompt: 'How did I do this week?', icon: '📊' },
        { id: 'follow-ups', label: 'Pending follow-ups', prompt: 'Show me pending follow-ups', icon: '📞' },
        { id: 'pricing', label: 'Suggest a price', prompt: 'What should I charge for a full truck load?', icon: '💰' },
        { id: 'summary', label: 'Monthly summary', prompt: 'Give me a business summary for this month', icon: '📋' }
      ],
      userName: null
    })
  }
}
