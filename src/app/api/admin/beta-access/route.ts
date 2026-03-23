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

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const supabase = getSupabase()

    let query = supabase
      .from('dyia_beta_access_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,signup_email.ilike.%${search}%,google_email.ilike.%${search}%,business_name.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ requests: data || [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin beta access GET:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const { id, status, adminNotes } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Request id is required' }, { status: 400 })
    }

    const allowedStatuses = ['pending', 'approved', 'google_added', 'invited', 'rejected']
    const updates: Record<string, unknown> = {
      reviewed_at: new Date().toISOString(),
      reviewed_by_clerk_user_id: clerkUserId,
    }

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.status = status
    }

    if (adminNotes !== undefined) {
      if (typeof adminNotes !== 'string' || adminNotes.length > 2000) {
        return NextResponse.json({ error: 'Admin notes must be a string under 2000 characters.' }, { status: 400 })
      }
      updates.admin_notes = adminNotes.trim() || null
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('dyia_beta_access_requests')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ request: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin beta access PATCH:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
