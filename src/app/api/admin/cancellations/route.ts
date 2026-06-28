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

const RETARGETING_STATUSES = new Set(['new', 'contacted', 'won_back', 'not_fit', 'do_not_contact'])

function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

/** GET /api/admin/cancellations - Cancellation feedback for retargeting. */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const supabase = getSupabase()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''

    let query = supabase
      .from('dyia_cancellation_feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (status && RETARGETING_STATUSES.has(status)) {
      query = query.eq('retargeting_status', status)
    }

    const { data: rows, error } = await query
    if (error) throw error

    const userIds = [...new Set((rows || []).map(row => row.user_id).filter(Boolean))]
    const jobCounts: Record<string, number> = {}
    const quoteCounts: Record<string, number> = {}

    if (userIds.length > 0) {
      const [jobsRes, quotesRes] = await Promise.all([
        supabase.from('dyia_jobs').select('user_id').in('user_id', userIds),
        supabase.from('dyia_quotes').select('user_id').in('user_id', userIds),
      ])
      for (const job of (jobsRes.data || [])) {
        jobCounts[job.user_id] = (jobCounts[job.user_id] || 0) + 1
      }
      for (const quote of (quotesRes.data || [])) {
        quoteCounts[quote.user_id] = (quoteCounts[quote.user_id] || 0) + 1
      }
    }

    const cancellations = (rows || []).map(row => ({
      ...row,
      jobCount: row.user_id ? jobCounts[row.user_id] || 0 : 0,
      quoteCount: row.user_id ? quoteCounts[row.user_id] || 0 : 0,
    }))

    return NextResponse.json({ cancellations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin cancellations GET:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** PATCH /api/admin/cancellations - Update retargeting status/notes. */
export async function PATCH(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const body = await req.json().catch(() => ({}))
    const id = cleanText(body.id, 80)
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.retargetingStatus !== undefined) {
      if (!RETARGETING_STATUSES.has(body.retargetingStatus)) {
        return NextResponse.json({ error: 'Invalid retargeting status' }, { status: 400 })
      }
      updates.retargeting_status = body.retargetingStatus
    }
    if (body.retargetingNotes !== undefined) {
      updates.retargeting_notes = cleanText(body.retargetingNotes, 2000)
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('dyia_cancellation_feedback')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ cancellation: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin cancellations PATCH:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

