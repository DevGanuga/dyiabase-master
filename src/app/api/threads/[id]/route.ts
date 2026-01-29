import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/threads/[id] - Get thread with messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: threadId } = await params

    // Get user profile
    const { data: userProfile } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get thread with messages
    const { data: thread, error: threadError } = await supabase
      .from('dyia_threads')
      .select('id, title, last_message_at, message_count, created_at')
      .eq('id', threadId)
      .eq('user_id', userProfile.id)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('dyia_messages')
      .select('id, role, content, tool_calls, tool_results, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (messagesError) throw messagesError

    return NextResponse.json({ thread, messages })

  } catch (error) {
    console.error('[Thread GET Error]', error)
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    )
  }
}

// DELETE /api/threads/[id] - Archive thread
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: threadId } = await params

    // Get user profile
    const { data: userProfile } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Archive thread (soft delete)
    const { error } = await supabase
      .from('dyia_threads')
      .update({ is_archived: true })
      .eq('id', threadId)
      .eq('user_id', userProfile.id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Thread DELETE Error]', error)
    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    )
  }
}

// PATCH /api/threads/[id] - Update thread title
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: threadId } = await params
    const { title } = await req.json()

    // Get user profile
    const { data: userProfile } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update thread
    const { data: thread, error } = await supabase
      .from('dyia_threads')
      .update({ title })
      .eq('id', threadId)
      .eq('user_id', userProfile.id)
      .select('id, title')
      .single()

    if (error) throw error

    return NextResponse.json({ thread })

  } catch (error) {
    console.error('[Thread PATCH Error]', error)
    return NextResponse.json(
      { error: 'Failed to update thread' },
      { status: 500 }
    )
  }
}
