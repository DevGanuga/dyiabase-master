import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET - List user's email connections
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()

    // Get dyia user
    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get active connections
    const { data: connections, error } = await supabase
      .from('dyia_email_connections')
      .select('id, provider, email_address, is_active, connected_at, last_used_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('connected_at', { ascending: false })

    if (error) {
      console.error('Error fetching connections:', error)
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
    }

    return NextResponse.json({
      connections: connections.map(c => ({
        id: c.id,
        provider: c.provider,
        emailAddress: c.email_address,
        isActive: c.is_active,
        connectedAt: c.connected_at,
        lastUsedAt: c.last_used_at,
      }))
    })
  } catch (error) {
    console.error('Connections error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE - Disconnect an email provider
export async function DELETE(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId } = await request.json()
    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Get dyia user
    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Soft delete - set is_active to false
    const { error } = await supabase
      .from('dyia_email_connections')
      .update({ is_active: false })
      .eq('id', connectionId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error disconnecting:', error)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Disconnect error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
