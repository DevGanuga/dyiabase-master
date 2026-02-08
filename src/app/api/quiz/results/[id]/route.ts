import { NextResponse } from 'next/server'
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('dyia_quiz_submissions')
      .select('id, first_name, email, created_at, calculated_loss, breakdown, viewed_results')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      user: { firstName: data.first_name, email: data.email },
      results: {
        totalLoss: data.calculated_loss,
        annualLoss: (data.calculated_loss as number) * 12,
        breakdown: (data.breakdown as Record<string, number>) || {},
      },
      createdAt: data.created_at,
      viewedResults: data.viewed_results,
    })
  } catch (e) {
    console.error('Quiz results GET:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const body = await req.json()
    const { viewedResults, startedTrial } = body

    const supabase = getSupabase()
    const updates: Record<string, boolean> = {}
    if (typeof viewedResults === 'boolean') updates.viewed_results = viewedResults
    if (typeof startedTrial === 'boolean') updates.started_trial = startedTrial
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase
      .from('dyia_quiz_submissions')
      .update(updates)
      .eq('id', id)

    if (error) {
      console.error('Quiz results PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Quiz results PATCH:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
