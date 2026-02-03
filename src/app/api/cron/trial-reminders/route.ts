import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { trialEndingEmail } from '@/lib/resend/templates'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const DAYS_UNTIL_TRIAL_END = 2

/**
 * Cron: send trial-ending emails to users whose trial ends in DAYS_UNTIL_TRIAL_END days.
 * Call with: Authorization: Bearer CRON_SECRET
 * Schedule: daily (e.g. 9:00 UTC).
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

    const now = new Date()
    const reminderDate = new Date(now)
    reminderDate.setUTCDate(reminderDate.getUTCDate() + DAYS_UNTIL_TRIAL_END)
    const start = reminderDate.toISOString().slice(0, 10) + 'T00:00:00.000Z'
    const end = reminderDate.toISOString().slice(0, 10) + 'T23:59:59.999Z'

    const { data: users, error } = await supabase
      .from('dyia_users')
      .select('id, email, first_name')
      .eq('subscription_status', 'trialing')
      .gte('subscription_ends_at', start)
      .lte('subscription_ends_at', end)

    if (error) {
      console.error('Trial reminders fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let sent = 0
    for (const u of users || []) {
      if (!u.email) continue
      try {
        const result = await sendEmail(
          u.email,
          `Your Pro trial ends in ${DAYS_UNTIL_TRIAL_END} days`,
          trialEndingEmail(u.first_name || 'there', DAYS_UNTIL_TRIAL_END),
          'trial_ending'
        )
        if (result.success) sent++
      } catch (err) {
        console.error(`Trial reminder failed for ${u.id}:`, err)
      }
    }

    return NextResponse.json({ sent, total: (users || []).length })
  } catch (err) {
    console.error('Trial reminders cron:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
