/**
 * GET /api/cron/intel-monthly
 * Monthly cron job — runs on the 1st of each month.
 * Generates fresh competitive intelligence scans for all active subscribers.
 * Authorization: Bearer CRON_SECRET
 *
 * Retry logic: if a user's scan fails, retries once after processing all others.
 * If retry also fails, logs error for owner alert.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runIntelAgent } from '@/lib/intel/agent'
import { generateActionPlan } from '@/lib/intel/action-plan'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface UserToScan {
  userId: string
  businessName: string
  websiteUrl: string | null
  zipCode: string
  industry: string
  radiusMiles: number
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date()
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  try {
    // Get all active subscribers
    const { data: users, error: usersError } = await supabase
      .from('dyia_users')
      .select('id')
      .in('subscription_status', ['active', 'trialing'])

    if (usersError || !users) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // For each user, get their business info and most recent scan settings
    const usersToScan: UserToScan[] = []

    for (const u of users) {
      // Check if already scanned this month
      const { data: existing } = await supabase
        .from('dyia_intel_monthly_status')
        .select('id, job_status')
        .eq('user_id', u.id)
        .eq('month_year', monthYear)
        .single()

      if (existing?.job_status === 'complete') continue

      // Get business settings
      const { data: settings } = await supabase
        .from('dyia_settings')
        .select('business_name, business_address')
        .eq('user_id', u.id)
        .single()

      if (!settings?.business_name) continue

      // Get previous scan for industry/zip defaults
      const { data: prevScan } = await supabase
        .from('dyia_intel_scans')
        .select('industry, zip_code, radius_miles, website_url')
        .eq('user_id', u.id)
        .eq('source', 'crm_monthly')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!prevScan) continue // No prior scan — user needs to set up Intel first

      usersToScan.push({
        userId: u.id,
        businessName: settings.business_name,
        websiteUrl: prevScan.website_url,
        zipCode: prevScan.zip_code,
        industry: prevScan.industry,
        radiusMiles: prevScan.radius_miles || 25,
      })
    }

    const results = { total: usersToScan.length, success: 0, failed: 0, retried: 0 }
    const failedUsers: UserToScan[] = []

    // Process each user
    for (const userInfo of usersToScan) {
      const ok = await processSingleUser(supabase, userInfo, monthYear)
      if (ok) {
        results.success++
      } else {
        failedUsers.push(userInfo)
        results.failed++
      }
    }

    // Retry failed users once
    for (const userInfo of failedUsers) {
      // Wait a moment before retry
      await new Promise(r => setTimeout(r, 5000))

      const ok = await processSingleUser(supabase, userInfo, monthYear)
      if (ok) {
        results.success++
        results.failed--
        results.retried++
      } else {
        // Final failure — log for owner alert
        console.error(
          `[INTEL CRON] FINAL FAILURE for user ${userInfo.userId} (${userInfo.businessName}). ` +
          `Owner alert needed.`
        )
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Intel monthly cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function processSingleUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userInfo: UserToScan,
  monthYear: string
): Promise<boolean> {
  try {
    // Upsert monthly status to 'running'
    await supabase
      .from('dyia_intel_monthly_status')
      .upsert(
        {
          user_id: userInfo.userId,
          month_year: monthYear,
          job_status: 'running',
          viewed_at: null,
        },
        { onConflict: 'user_id,month_year' }
      )

    // Run agent
    const scanData = await runIntelAgent({
      businessName: userInfo.businessName,
      websiteUrl: userInfo.websiteUrl || undefined,
      zipCode: userInfo.zipCode,
      industry: userInfo.industry,
      radiusMiles: userInfo.radiusMiles,
    })

    // Generate action plan
    const actionPlan = await generateActionPlan(scanData, userInfo.businessName)

    // Store scan
    const { data: scan, error: scanError } = await supabase
      .from('dyia_intel_scans')
      .insert({
        user_id: userInfo.userId,
        business_name: userInfo.businessName,
        website_url: userInfo.websiteUrl,
        zip_code: userInfo.zipCode,
        industry: userInfo.industry,
        radius_miles: userInfo.radiusMiles,
        scan_data: scanData,
        action_plan: actionPlan,
        source: 'crm_monthly',
      })
      .select('id')
      .single()

    if (scanError || !scan) {
      throw new Error(`Failed to store scan: ${scanError?.message}`)
    }

    // Update monthly status to 'complete'
    await supabase
      .from('dyia_intel_monthly_status')
      .update({ scan_id: scan.id, job_status: 'complete' })
      .eq('user_id', userInfo.userId)
      .eq('month_year', monthYear)

    return true
  } catch (error) {
    console.error(`[INTEL CRON] Failed for user ${userInfo.userId}:`, error)

    // Mark as failed
    await supabase
      .from('dyia_intel_monthly_status')
      .upsert(
        {
          user_id: userInfo.userId,
          month_year: monthYear,
          job_status: 'failed',
        },
        { onConflict: 'user_id,month_year' }
      )
      .catch(() => {})

    return false
  }
}
