import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { followUpReminderEmail, type FollowUpData } from '@/lib/resend/templates'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Cron: send follow-up reminder emails to users who have pending follow-ups.
 * Call with: Authorization: Bearer CRON_SECRET
 * Schedule: e.g. daily or weekly.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isResendConfigured()) {
    return NextResponse.json({ error: 'Resend not configured' }, { status: 503 })
  }

  try {
    const supabase = getSupabase()

    const { data: followUps, error: fuError } = await supabase
      .from('dyia_follow_ups')
      .select('id, user_id, quote_id, status, next_follow_up_at')
      .in('status', ['pending', 'contacted', 'snoozed'])

    if (fuError || !followUps?.length) {
      return NextResponse.json({ sent: 0, total: 0 })
    }

    const quoteIds = [...new Set((followUps as { quote_id: string }[]).map(f => f.quote_id))]
    const { data: quotes } = await supabase
      .from('dyia_quotes')
      .select('id, user_id, customer_name, estimate_low, estimate_high, total, job_description, created_at')
      .in('id', quoteIds)

    const quoteMap = new Map((quotes || []).map(q => [q.id, q]))
    const byUser = new Map<string, FollowUpData[]>()
    const now = new Date()

    for (const fu of followUps as { user_id: string; quote_id: string }[]) {
      const quote = quoteMap.get(fu.quote_id) as { customer_name: string; total: number; estimate_low?: number; estimate_high?: number; job_description?: string; created_at: string } | undefined
      if (!quote) continue
      const daysSince = Math.floor((now.getTime() - new Date(quote.created_at).getTime()) / (1000 * 60 * 60 * 24))
      const amount = quote.total
        ? `$${quote.total}`
        : (quote.estimate_low != null && quote.estimate_high != null)
          ? `$${quote.estimate_low}–$${quote.estimate_high}`
          : '—'
      const list = byUser.get(fu.user_id) || []
      list.push({
        customerName: quote.customer_name || 'Customer',
        quoteAmount: amount,
        daysSinceQuote: daysSince,
        jobDescription: quote.job_description || undefined,
      })
      byUser.set(fu.user_id, list)
    }

    const userIds = [...byUser.keys()]
    const { data: users } = await supabase
      .from('dyia_users')
      .select('id, email, first_name')
      .in('id', userIds)

    let sent = 0
    for (const u of users || []) {
      if (!u.email) continue
      const list = byUser.get(u.id)
      if (!list?.length) continue
      try {
        const result = await sendEmail(
          u.email,
          `You have ${list.length} quote${list.length > 1 ? 's' : ''} to follow up on`,
          followUpReminderEmail(u.first_name || 'there', list),
          'follow_up_reminder'
        )
        if (result.success) sent++
      } catch (err) {
        console.error(`Follow-up reminder failed for ${u.id}:`, err)
      }
    }

    return NextResponse.json({ sent, total: userIds.length })
  } catch (err) {
    console.error('Follow-up reminders cron:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
