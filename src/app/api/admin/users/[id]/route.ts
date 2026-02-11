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

/** GET /api/admin/users/[id] - Get user detail */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const { id } = await params
    const supabase = getSupabase()

    const { data: user, error } = await supabase
      .from('dyia_users')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Get settings
    const { data: settings } = await supabase
      .from('dyia_settings')
      .select('*')
      .eq('user_id', id)
      .single()

    // Get stats
    const [jobsRes, quotesRes, threadsRes] = await Promise.all([
      supabase.from('dyia_jobs').select('id, revenue, date', { count: 'exact' }).eq('user_id', id),
      supabase.from('dyia_quotes').select('id', { count: 'exact' }).eq('user_id', id),
      supabase.from('dyia_threads').select('id', { count: 'exact' }).eq('user_id', id),
    ])

    const totalRevenue = (jobsRes.data || []).reduce((s, j) => s + (parseFloat(j.revenue) || 0), 0)

    return NextResponse.json({
      user,
      settings,
      stats: {
        jobCount: jobsRes.count || 0,
        quoteCount: quotesRes.count || 0,
        threadCount: threadsRes.count || 0,
        totalRevenue,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin user GET:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH /api/admin/users/[id] - Update user (role, subscription) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const { id } = await params
    const body = await req.json()
    const supabase = getSupabase()

    // Only allow updating specific fields
    const allowedFields = ['role', 'subscription_status', 'subscription_plan', 'subscription_ends_at', 'ai_credits_balance']
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dyia_users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ user: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin user PATCH:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
