import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/threads - List user's threads
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get threads
    const { data: threads, error } = await supabase
      .from('dyia_threads')
      .select('id, title, last_message_at, message_count, created_at')
      .eq('user_id', userProfile.id)
      .eq('is_archived', false)
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return NextResponse.json({ threads })

  } catch (error) {
    console.error('[Threads GET Error]', error)
    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    )
  }
}

// POST /api/threads - Create new thread
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { title } = await req.json()

    // Create thread
    const { data: thread, error } = await supabase
      .from('dyia_threads')
      .insert({
        user_id: userProfile.id,
        openai_thread_id: `local_${Date.now()}`, // Placeholder, will be updated on first message
        title: title || 'New Conversation',
        message_count: 0,
        last_message_at: new Date().toISOString()
      })
      .select('id, title, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({ thread })

  } catch (error) {
    console.error('[Threads POST Error]', error)
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}
