import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase env not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getDyiaUserId(supabase: SupabaseClient, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return (data as { id: string } | null)?.id ?? null
}

/** GET: list review requests for the user. Query: quoteId optional. */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const quoteId = searchParams.get('quoteId')
    const customerName = searchParams.get('customerName')

    let query = supabase
      .from('dyia_review_requests')
      .select('id, quote_id, customer_name, platform, requested_at')
      .eq('user_id', dyiaUserId)
      .order('requested_at', { ascending: false })

    if (quoteId) query = query.eq('quote_id', quoteId)
    if (customerName?.trim()) query = query.ilike('customer_name', customerName.trim())

    const { data, error } = await query

    if (error) {
      console.error('Review requests GET:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const items = (data || []).map(row => ({
      id: row.id,
      quoteId: row.quote_id,
      customerName: row.customer_name,
      platform: row.platform,
      requestedAt: row.requested_at,
    }))

    return NextResponse.json({ items })
  } catch (err) {
    console.error('Review requests GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/** POST: record a review request. Body: { quoteId?, customerName, platform } */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json()
    const { quoteId, customerName, platform } = body as { quoteId?: string; customerName?: string; platform?: string }

    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return NextResponse.json({ error: 'customerName is required' }, { status: 400 })
    }
    if (!platform || typeof platform !== 'string' || !platform.trim()) {
      return NextResponse.json({ error: 'platform is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dyia_review_requests')
      .insert({
        user_id: dyiaUserId,
        quote_id: quoteId && quoteId.trim() ? quoteId.trim() : null,
        customer_name: customerName.trim(),
        platform: platform.trim(),
      })
      .select('id, quote_id, customer_name, platform, requested_at')
      .single()

    if (error) {
      console.error('Review requests POST:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      item: {
        id: data.id,
        quoteId: data.quote_id,
        customerName: data.customer_name,
        platform: data.platform,
        requestedAt: data.requested_at,
      },
    })
  } catch (err) {
    console.error('Review requests POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
