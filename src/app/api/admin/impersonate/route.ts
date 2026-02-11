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

/** POST /api/admin/impersonate - Start impersonating a user */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const { targetUserId } = await req.json()
    if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })

    const supabase = getSupabase()

    // Verify target user exists
    const { data: targetUser } = await supabase
      .from('dyia_users')
      .select('id, email, first_name, last_name')
      .eq('id', targetUserId)
      .single()

    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Set impersonation cookie
    const response = NextResponse.json({ 
      success: true, 
      impersonating: {
        id: targetUser.id,
        email: targetUser.email,
        name: [targetUser.first_name, targetUser.last_name].filter(Boolean).join(' ') || targetUser.email,
      }
    })
    
    response.cookies.set('dyia_impersonate_user_id', targetUserId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 4, // 4 hours
      path: '/',
    })

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Forbidden')) return NextResponse.json({ error: message }, { status: 403 })
    console.error('Admin impersonate POST:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** DELETE /api/admin/impersonate - Stop impersonating */
export async function DELETE() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireAdmin(clerkUserId)

    const response = NextResponse.json({ success: true })
    response.cookies.delete('dyia_impersonate_user_id')
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Admin impersonate DELETE:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
