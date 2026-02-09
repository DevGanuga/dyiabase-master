import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** GET /api/admin/users - List all users with stats */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 50
    const offset = (page - 1) * limit

    let query = supabase
      .from('dyia_users')
      .select('id, clerk_user_id, email, first_name, last_name, role, subscription_status, subscription_plan, subscription_ends_at, ai_credits_balance, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`)
    }
    if (status) {
      query = query.eq('subscription_status', status)
    }

    const { data: users, count, error } = await query
    if (error) throw error

    // Get job counts per user
    const userIds = (users || []).map(u => u.id)
    const jobCounts: Record<string, number> = {}
    if (userIds.length > 0) {
      const { data: jobs } = await supabase
        .from('dyia_jobs')
        .select('user_id')
        .in('user_id', userIds)
      
      for (const job of (jobs || [])) {
        jobCounts[job.user_id] = (jobCounts[job.user_id] || 0) + 1
      }
    }

    const enriched = (users || []).map(u => ({
      ...u,
      jobCount: jobCounts[u.id] || 0,
    }))

    return NextResponse.json({ users: enriched, total: count || 0, page, limit })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin users GET:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
