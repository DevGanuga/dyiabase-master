import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const getSupabase = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Fetch user's pending actions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()

    // Get dyia user ID
    const { data: userData } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userData) {
      return NextResponse.json({ pendingActions: [] })
    }

    // Fetch pending actions
    const { data: actions, error } = await supabase
      .from('dyia_pending_actions')
      .select('*')
      .eq('user_id', userData.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      pendingActions: actions || []
    })
  } catch (error) {
    console.error('Error fetching pending actions:', error)
    return NextResponse.json({ error: 'Failed to fetch pending actions' }, { status: 500 })
  }
}

// POST - Create a new pending action
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { actionType, proposalData, threadId, originalMessage, aiResponse } = body

    if (!actionType || !proposalData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Get dyia user ID
    const { data: userData } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Cancel any existing pending action for this thread
    if (threadId) {
      await supabase
        .from('dyia_pending_actions')
        .update({ status: 'cancelled' })
        .eq('user_id', userData.id)
        .eq('thread_id', threadId)
        .eq('status', 'pending')
    }

    // Create new pending action
    const { data: action, error } = await supabase
      .from('dyia_pending_actions')
      .insert({
        user_id: userData.id,
        thread_id: threadId || null,
        action_type: actionType,
        proposal_data: proposalData,
        original_message: originalMessage,
        ai_response: aiResponse,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ pendingAction: action })
  } catch (error) {
    console.error('Error creating pending action:', error)
    return NextResponse.json({ error: 'Failed to create pending action' }, { status: 500 })
  }
}

// PATCH - Update pending action status
export async function PATCH(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { actionId, status } = body

    if (!actionId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Get dyia user ID
    const { data: userData } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update the action
    const { data: action, error } = await supabase
      .from('dyia_pending_actions')
      .update({ status })
      .eq('id', actionId)
      .eq('user_id', userData.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ pendingAction: action })
  } catch (error) {
    console.error('Error updating pending action:', error)
    return NextResponse.json({ error: 'Failed to update pending action' }, { status: 500 })
  }
}
