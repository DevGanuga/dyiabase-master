import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getDyiaUserId(supabase: ReturnType<typeof createClient>, clerkUserId: string): Promise<string | null> {
  const { data } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return data?.id ?? null
}

/** GET: list marketing spend for the user. Query: month (YYYY-MM) optional. */
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month') // YYYY-MM

    let query = supabase
      .from('dyia_marketing_spend')
      .select('id, source, month, amount, notes, created_at, updated_at')
      .eq('user_id', dyiaUserId)
      .order('month', { ascending: false })

    if (month) {
      // month is stored as first day of month in DB
      const monthStart = `${month}-01`
      query = query.eq('month', monthStart)
    }

    const { data, error } = await query

    if (error) {
      console.error('Marketing spend GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const items = (data || []).map(row => ({
      id: row.id,
      source: row.source,
      month: row.month,
      amount: parseFloat(row.amount) || 0,
      notes: row.notes ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({ items })
  } catch (err) {
    console.error('Marketing spend GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/** POST: upsert one marketing spend row. Body: { source, month (YYYY-MM), amount, notes? } */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const dyiaUserId = await getDyiaUserId(supabase, clerkUserId)
    if (!dyiaUserId) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json()
    const { source, month, amount, notes } = body as { source?: string; month?: string; amount?: number; notes?: string }

    if (!source || typeof source !== 'string' || source.trim() === '') {
      return NextResponse.json({ error: 'source is required' }, { status: 400 })
    }
    if (!month || typeof month !== 'string') {
      return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 })
    }
    const monthStart = `${month.slice(0, 7)}-01`
    const amountNum = typeof amount === 'number' ? amount : parseFloat(amount)
    if (Number.isNaN(amountNum) || amountNum < 0) {
      return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('dyia_marketing_spend')
      .upsert(
        {
          user_id: dyiaUserId,
          source: source.trim(),
          month: monthStart,
          amount: amountNum,
          notes: notes != null ? String(notes).trim() || null : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,source,month' }
      )
      .select('id, source, month, amount, notes, created_at, updated_at')
      .single()

    if (error) {
      console.error('Marketing spend POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      item: {
        id: data.id,
        source: data.source,
        month: data.month,
        amount: parseFloat(data.amount) || 0,
        notes: data.notes ?? null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
    })
  } catch (err) {
    console.error('Marketing spend POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
